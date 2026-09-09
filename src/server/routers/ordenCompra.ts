import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';
import { diasDeCoberturaDeCompra } from '../parametros-servidor';
import {
  ESTADOS_ORDEN,
  type MovimientoComputable,
  insumoConCobertura,
  insumosAReponer,
  ventanaDeConsumo,
} from '@/lib/inventario';
import { mensajeDeError } from '../errores';

/**
 * M10 · Órdenes de compra (CUS06).
 *
 * El ciclo es borrador → enviada → recibida, con `parcialmente_recibida` en el
 * medio porque una entrega incompleta es corriente con proveedores de forraje
 * (decisión 1.11). Tres cosas conviene tener presentes al leer este archivo:
 *
 * 1. **El estado no se elige.** Salvo `enviar` y `anular`, que son actos del
 *    dueño, el estado lo escribe el disparador `trg_estado_orden` a partir de lo
 *    que llegó de cada renglón. Acá no hay ningún `update` que lo fije a
 *    `recibida`: si estuviera, tarde o temprano diría algo distinto del detalle.
 *
 * 2. **Cada recepción informa lo que llegó ESA VEZ, no el acumulado.** Es como
 *    llega el dato -un remito por entrega- y es lo que hace que dos entregas
 *    parciales sumen sin que nadie tenga que restar de cabeza. El acumulado lo
 *    lleva `cantidad_recibida`, y el asiento en existencias lo lleva cada
 *    entrega por separado, fechado el día que la mercadería entró al depósito.
 *
 * 3. **El ingreso a existencias lo escribe este router y no un disparador**,
 *    igual que el consumo de M9. Una recepción mal cargada es cosa de todos los
 *    días, y un movimiento generado automáticamente desde la base no se corrige
 *    sin pelear contra la base.
 */

const renglon = z.object({
  insumoId: z.uuid(),
  cantidad: z.number().positive('La cantidad pedida tiene que ser mayor que cero.'),
  precioUnitario: z.number().min(0, 'El precio no puede ser negativo.'),
});

const SELECT_ORDEN = `id, anio, numero, fecha_emision, estado, total,
   proveedor:proveedor_id (id, razon_social, cuit, telefono, email)` as const;

const SELECT_DETALLE = `id, cantidad, cantidad_recibida, precio_unitario,
   insumo:insumo_id (id, nombre, unidad, categoria)` as const;

export const routerOrdenCompra = crearRouter({
  listar: procedimientoAdmin
    .input(
      z
        .object({
          estado: z.enum(ESTADOS_ORDEN).optional(),
          /** Sin esto, la lista se llena de anuladas y recibidas de hace un año. */
          soloAbiertas: z.boolean().default(false),
          limite: z.int().min(1).max(200).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      let consulta = ctx.supabase
        .from('orden_compra')
        .select(SELECT_ORDEN)
        .order('anio', { ascending: false })
        .order('numero', { ascending: false })
        .limit(input?.limite ?? 50);

      if (input?.estado) consulta = consulta.eq('estado', input.estado);
      if (input?.soloAbiertas) {
        consulta = consulta.in('estado', ['borrador', 'enviada', 'parcialmente_recibida']);
      }

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return data ?? [];
    }),

  ver: procedimientoAdmin.input(z.object({ ordenId: z.uuid() })).query(async ({ ctx, input }) => {
    const [{ data: orden, error }, { data: detalle }, { data: ingresos }] = await Promise.all([
      ctx.supabase.from('orden_compra').select(SELECT_ORDEN).eq('id', input.ordenId).maybeSingle(),
      ctx.supabase
        .from('detalle_orden_compra')
        .select(SELECT_DETALLE)
        .eq('orden_compra_id', input.ordenId)
        // `id` desempata: los renglones de una orden entran en una sola
        // inserción, así que comparten `creado_en` al milisegundo y sin segundo
        // criterio Postgres los devuelve en el orden que se le antoja. Se nota
        // recién en el navegador, cuando las filas se reacomodan solas entre una
        // recepción y la siguiente.
        .order('creado_en')
        .order('id'),
      // Las entregas, una por remito. Es lo que `cantidad_recibida` resume y lo
      // que permite reconstruir cuándo llegó cada cosa.
      ctx.supabase
        .from('movimiento_stock')
        .select('id, insumo_id, cantidad, ocurrido_en, motivo')
        .eq('orden_compra_id', input.ordenId)
        .order('ocurrido_en', { ascending: false }),
    ]);

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
    if (!orden) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa orden.' });

    return { orden, detalle: detalle ?? [], entregas: ingresos ?? [] };
  }),

  /**
   * Arma una orden nueva, siempre en borrador.
   *
   * El estado inicial no es un parámetro: una orden nace sin enviar, se revisa y
   * recién ahí sale. Poder crearla ya enviada ahorraría un clic y sacaría del
   * medio el único momento en que alguien mira las cantidades antes de que el
   * proveedor las lea.
   */
  crear: procedimientoAdmin
    .input(
      z.object({
        proveedorId: z.uuid(),
        fechaEmision: z.iso.date().optional(),
        renglones: z.array(renglon).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: orden, error } = await ctx.supabase
        .from('orden_compra')
        .insert({
          proveedor_id: input.proveedorId,
          fecha_emision: input.fechaEmision ?? new Date().toISOString().slice(0, 10),
        })
        .select('id, anio, numero')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      if (input.renglones.length > 0) {
        const { error: errorDetalle } = await ctx.supabase.from('detalle_orden_compra').insert(
          input.renglones.map((r) => ({
            orden_compra_id: orden.id,
            insumo_id: r.insumoId,
            cantidad: r.cantidad,
            precio_unitario: r.precioUnitario,
            // Explícito y no por omisión: en una inserción de varias filas
            // PostgREST unifica las claves y escribe nulo donde una fila no
            // trae la columna. Acá el nulo es el valor que se quiere -todavía
            // no llegó nada-, pero dejarlo implícito es la trampa que M8 ya
            // documentó y conviene no volver a pisar.
            cantidad_recibida: null,
          })),
        );

        if (errorDetalle) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorDetalle) });
        }
      }

      return { id: orden.id, anio: orden.anio, numero: orden.numero };
    }),

  /**
   * La orden que el sistema propone con lo que hay que reponer (CUS06, paso 4).
   *
   * Nace en borrador como cualquier otra, y por eso es una sugerencia y no una
   * compra: el dueño la abre, corrige cantidades, saca lo que no quiere y recién
   * ahí la envía. El precio arranca en cero porque no se conoce hasta que el
   * proveedor lo pasa —congelarlo del último precio pagado sería inventar una
   * lista de precios que el sistema no tiene—.
   */
  sugerida: procedimientoAdmin
    .input(z.object({ proveedorId: z.uuid(), hasta: z.iso.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const hasta = input.hasta ?? new Date().toISOString().slice(0, 10);
      const ventana = ventanaDeConsumo(hasta);

      const [{ data: insumos }, { data: movimientos }, diasDeCobertura] = await Promise.all([
        ctx.supabase
          .from('insumo')
          .select('id, nombre, categoria, unidad, stock_actual, stock_minimo')
          .eq('activo', true)
          .order('nombre'),
        ctx.supabase
          .from('movimiento_stock')
          .select('insumo_id, tipo, cantidad, ocurrido_en')
          .gte('ocurrido_en', `${ventana.desde}T00:00:00-03:00`)
          .lte('ocurrido_en', `${hasta}T23:59:59.999-03:00`),
        diasDeCoberturaDeCompra(ctx.supabase),
      ]);

      const porInsumo = new Map<string, MovimientoComputable[]>();
      for (const m of movimientos ?? []) {
        const lista = porInsumo.get(m.insumo_id) ?? [];
        lista.push({ tipo: m.tipo, cantidad: m.cantidad, ocurridoEn: m.ocurrido_en });
        porInsumo.set(m.insumo_id, lista);
      }

      const filas = (insumos ?? []).map((i) =>
        insumoConCobertura(
          {
            id: i.id,
            nombre: i.nombre,
            categoria: i.categoria,
            unidad: i.unidad,
            stockActual: i.stock_actual,
            stockMinimo: i.stock_minimo,
          },
          porInsumo.get(i.id) ?? [],
          ventana.desde,
          hasta,
        ),
      );

      const aReponer = insumosAReponer(filas, diasDeCobertura);
      if (aReponer.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No hay nada por reponer: ningún insumo está bajo mínimo ni cerca de agotarse.',
        });
      }

      const { data: orden, error } = await ctx.supabase
        .from('orden_compra')
        .insert({
          proveedor_id: input.proveedorId,
          fecha_emision: new Date().toISOString().slice(0, 10),
        })
        .select('id, anio, numero')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const { error: errorDetalle } = await ctx.supabase.from('detalle_orden_compra').insert(
        aReponer.map((r) => ({
          orden_compra_id: orden.id,
          insumo_id: r.insumo.id,
          cantidad: r.cantidad,
          precio_unitario: 0,
          cantidad_recibida: null,
        })),
      );

      if (errorDetalle) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorDetalle) });
      }

      return {
        id: orden.id,
        anio: orden.anio,
        numero: orden.numero,
        renglones: aReponer.length,
      };
    }),

  /**
   * Agrega o cambia un renglón del borrador.
   *
   * Es un `upsert` sobre `(orden_compra_id, insumo_id)` y no un alta: la
   * restricción `detalle_insumo_unico` ya impide que el mismo insumo aparezca
   * dos veces en la misma orden, y agregarlo de nuevo es, en la cabeza de quien
   * lo hace, corregir la cantidad. Que la base lo rechazara con un choque de
   * clave sería técnicamente correcto e inútil.
   */
  guardarRenglon: procedimientoAdmin
    .input(renglon.extend({ ordenId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('detalle_orden_compra').upsert(
        {
          orden_compra_id: input.ordenId,
          insumo_id: input.insumoId,
          cantidad: input.cantidad,
          precio_unitario: input.precioUnitario,
          actualizado_en: new Date().toISOString(),
        },
        { onConflict: 'orden_compra_id,insumo_id' },
      );

      if (error) {
        // El disparador `trg_detalle_segun_estado` es el que se planta cuando la
        // orden ya salió, y su mensaje ya explica el motivo.
        throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(error) });
      }
      return { ok: true as const };
    }),

  quitarRenglon: procedimientoAdmin
    .input(z.object({ detalleId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('detalle_orden_compra')
        .delete()
        .eq('id', input.detalleId);

      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /** El borrador sale. A partir de acá el detalle queda congelado. */
  enviar: procedimientoAdmin
    .input(z.object({ ordenId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: detalle } = await ctx.supabase
        .from('detalle_orden_compra')
        .select('id')
        .eq('orden_compra_id', input.ordenId);

      if (!detalle?.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La orden no tiene renglones: no hay nada que pedir.',
        });
      }

      const { data, error } = await ctx.supabase
        .from('orden_compra')
        .update({ estado: 'enviada', actualizado_en: new Date().toISOString() })
        .eq('id', input.ordenId)
        .eq('estado', 'borrador')
        .select('id');

      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(error) });
      if (!data?.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa orden ya había salido.' });
      }
      return { ok: true as const };
    }),

  /**
   * Registra una entrega (CUS06, pasos 6 y 7).
   *
   * Cada renglón informa **lo que llegó en esta entrega**. El acumulado se suma
   * sobre lo que ya había, y cada entrega deja su propio ingreso en el libro de
   * existencias, fechado el día en que la mercadería entró y no el día en que
   * alguien la cargó: son dos fechas distintas cuando el remito se carga al día
   * siguiente, y confundirlas manda el ingreso al mes equivocado.
   *
   * El estado de la orden no se toca acá. Lo escribe el disparador a partir de
   * lo que quedó en el detalle, y por eso una entrega que completa la orden la
   * deja recibida sin que este código lo sepa.
   */
  recibir: procedimientoAdmin
    .input(
      z.object({
        ordenId: z.uuid(),
        ocurridoEn: z.iso.datetime().optional(),
        renglones: z
          .array(
            z.object({
              detalleId: z.uuid(),
              cantidad: z.number().positive('Una entrega de cero no es una entrega.'),
            }),
          )
          .min(1, 'No hay nada que recibir.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: orden } = await ctx.supabase
        .from('orden_compra')
        .select('id, estado')
        .eq('id', input.ordenId)
        .maybeSingle();

      if (!orden) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa orden.' });
      if (orden.estado === 'borrador') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La orden todavía no salió: no se puede recibir lo que no se pidió.',
        });
      }
      if (orden.estado === 'anulada') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa orden está anulada.' });
      }

      const { data: detalle, error } = await ctx.supabase
        .from('detalle_orden_compra')
        .select('id, insumo_id, cantidad, cantidad_recibida')
        .eq('orden_compra_id', input.ordenId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const porId = new Map((detalle ?? []).map((d) => [d.id, d]));
      const ocurridoEn = input.ocurridoEn ?? new Date().toISOString();

      for (const r of input.renglones) {
        const d = porId.get(r.detalleId);
        if (!d) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Uno de los renglones no pertenece a esta orden.',
          });
        }

        const acumulado = Number(((d.cantidad_recibida ?? 0) + r.cantidad).toFixed(2));

        const { error: errorDetalle } = await ctx.supabase
          .from('detalle_orden_compra')
          .update({ cantidad_recibida: acumulado, actualizado_en: ocurridoEn })
          .eq('id', d.id);

        if (errorDetalle) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(errorDetalle) });
        }

        const { error: errorStock } = await ctx.supabase.from('movimiento_stock').insert({
          insumo_id: d.insumo_id,
          tipo: 'ingreso',
          cantidad: r.cantidad,
          motivo: 'Recepción de orden de compra',
          registro_cuidado_id: null,
          orden_compra_id: input.ordenId,
          ocurrido_en: ocurridoEn,
        });

        if (errorStock) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorStock) });
        }
      }

      const { data: despues } = await ctx.supabase
        .from('orden_compra')
        .select('estado')
        .eq('id', input.ordenId)
        .maybeSingle();

      return { recibidos: input.renglones.length, estado: despues?.estado ?? orden.estado };
    }),

  /**
   * Anula la orden. No borra nada.
   *
   * Lo que ya se recibió sigue en existencias y tiene que seguir: la mercadería
   * entró al depósito, y que después se decida no seguir con la orden no la hace
   * desaparecer del galpón. Anular cierra la orden, no revierte el pasado.
   */
  anular: procedimientoAdmin
    .input(z.object({ ordenId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('orden_compra')
        .update({ estado: 'anulada', actualizado_en: new Date().toISOString() })
        .eq('id', input.ordenId)
        .neq('estado', 'anulada')
        .select('id');

      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(error) });
      if (!data?.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa orden ya estaba anulada.' });
      }
      return { ok: true as const };
    }),

  /** Un borrador que no llegó a salir sí se borra: no es un documento todavía. */
  eliminarBorrador: procedimientoAdmin
    .input(z.object({ ordenId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('orden_compra')
        .delete()
        .eq('id', input.ordenId)
        .eq('estado', 'borrador')
        .select('id');

      if (error) throw new TRPCError({ code: 'BAD_REQUEST', message: mensajeDeError(error) });
      if (!data?.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Sólo se borra un borrador. Una orden que salió se anula, para que quede.',
        });
      }
      return { ok: true as const };
    }),
});

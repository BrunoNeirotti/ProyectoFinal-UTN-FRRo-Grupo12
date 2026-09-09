import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { diasDeCoberturaDeCompra } from '../parametros-servidor';
import {
  CATEGORIAS_INSUMO,
  DIAS_DE_CONSUMO,
  type MovimientoComputable,
  insumoConCobertura,
  insumosAReponer,
  ventanaDeConsumo,
} from '@/lib/inventario';

/**
 * M10 · Insumos y existencias.
 *
 * El router arrancó en M9 con `listar` y nada más, para que el peón pudiera
 * elegir contra qué existencia imputa lo que consume. Lo que agrega M10 es el
 * resto: el alta, el mínimo, el ajuste por conteo físico y el panel con el que
 * se decide una compra.
 *
 * Dos cosas que valen para todo el archivo:
 *
 * 1. **Nadie escribe `stock_actual`.** Ni siquiera este módulo. Cada operación
 *    que mueve la existencia asienta un `movimiento_stock` y el disparador de
 *    0003 recalcula el saldo. Es lo que permite que el consumo de M9, la
 *    recepción de una orden y un ajuste manual convivan sin coordinarse.
 *
 * 2. **La lectura es de todo el personal y la escritura es del dueño**, tal cual
 *    lo dicen las políticas `insumo_lectura` / `insumo_escritura`. El peón tiene
 *    que poder ver contra qué imputa; decidir qué se compra y corregir una
 *    existencia son decisiones de gerencia.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');

const categoria = z.enum(CATEGORIAS_INSUMO);

const datosDeInsumo = z.object({
  nombre: z.string().trim().min(1, 'El insumo necesita un nombre.').max(80),
  categoria,
  unidad: z.string().trim().min(1, 'Falta la unidad: kg, bolsa, dosis, fardo.').max(20),
  stockMinimo: z.number().min(0, 'El mínimo no puede ser negativo.'),
});

export const routerInsumo = crearRouter({
  /**
   * La nómina, para elegir contra qué existencia se imputa un consumo.
   *
   * Es la consulta de M9 y se mantiene tal cual: la usa la planilla del peón,
   * que necesita la lista corta y no el panel entero.
   */
  listar: procedimientoLectura
    .input(z.object({ categoria: categoria.optional() }).optional())
    .query(async ({ ctx, input }) => {
      let consulta = ctx.supabase
        .from('insumo')
        .select('id, nombre, categoria, unidad, stock_actual, stock_minimo')
        .eq('activo', true)
        .order('nombre');

      if (input?.categoria) consulta = consulta.eq('categoria', input.categoria);

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // `bajoMinimo` se deriva y no se guarda, igual que todo lo que M8 informa:
      // una marca almacenada obliga a un proceso que la recalcule, y el día que
      // falla la pantalla muestra un dato viejo con toda confianza.
      return (data ?? []).map((i) => ({
        ...i,
        bajoMinimo: i.stock_actual < i.stock_minimo,
      }));
    }),

  /**
   * El panel de Inventario: existencia, consumo y cobertura de cada insumo, más
   * la reposición que el sistema propone (CUS06, pasos 1 a 3).
   *
   * Los movimientos de los noventa días se traen enteros y el promedio se hace
   * en memoria, en vez de pedirle a PostgREST un agregado por insumo. Son unos
   * pocos miles de filas para un haras y la cuenta ya está probada en
   * `inventario.test.ts`; resolverla en la base obligaría a una vista o a una
   * función, y a que el promedio quedara escrito en dos lenguajes.
   */
  panel: procedimientoLectura
    .input(z.object({ hasta: z.iso.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const hasta = input?.hasta ?? new Date().toISOString().slice(0, 10);
      const ventana = ventanaDeConsumo(hasta);

      const [{ data: insumos, error }, { data: movimientos }, diasDeCobertura] = await Promise.all([
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

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

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

      return {
        ventana: { ...ventana, dias: DIAS_DE_CONSUMO },
        diasDeCobertura,
        insumos: filas,
        bajoMinimo: filas.filter((i) => i.bajoMinimo).length,
        aReponer: insumosAReponer(filas, diasDeCobertura),
      };
    }),

  /** El libro de existencias de un insumo, que es de dónde salió su saldo. */
  movimientos: procedimientoLectura
    .input(z.object({ insumoId: z.uuid(), limite: z.int().min(1).max(200).default(50) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('movimiento_stock')
        .select(
          `id, tipo, cantidad, motivo, ocurrido_en, registro_cuidado_id,
           orden:orden_compra_id (id, anio, numero)`,
        )
        .eq('insumo_id', input.insumoId)
        .order('ocurrido_en', { ascending: false })
        .limit(input.limite);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  crear: procedimientoAdmin.input(datosDeInsumo).mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from('insumo')
      .insert({
        nombre: input.nombre,
        categoria: input.categoria,
        unidad: input.unidad,
        stock_minimo: input.stockMinimo,
      })
      .select('id')
      .single();

    if (error) {
      // `insumo.nombre` es único: dos «Viruta» distintas con existencias
      // separadas es cómo se pierde la cuenta de lo que hay.
      if (error.code === '23505') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe un insumo con ese nombre.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }
    return { id: data.id };
  }),

  /**
   * Cambia los datos del insumo. La existencia no está entre ellos: se mueve
   * con un ajuste, que deja constancia de por qué cambió.
   */
  editar: procedimientoAdmin
    .input(datosDeInsumo.extend({ insumoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('insumo')
        .update({
          nombre: input.nombre,
          categoria: input.categoria,
          unidad: input.unidad,
          stock_minimo: input.stockMinimo,
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', input.insumoId);

      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Ya existe un insumo con ese nombre.' });
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }
      return { ok: true as const };
    }),

  /**
   * Saca un insumo de circulación sin borrarlo.
   *
   * Borrarlo no es una opción y la base tampoco lo permitiría: sus movimientos
   * y los renglones de las órdenes lo referencian con `on delete restrict`. Un
   * insumo que dejó de usarse sigue explicando el consumo del año pasado.
   */
  desactivar: procedimientoAdmin
    .input(z.object({ insumoId: z.uuid(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('insumo')
        .update({ activo: input.activo, actualizado_en: new Date().toISOString() })
        .eq('id', input.insumoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  /**
   * Conteo físico: el ajuste que concilia lo contado con lo registrado
   * (CUS06, camino 3.a).
   *
   * Recibe **lo que se contó**, no la diferencia, porque es lo que la persona
   * tiene delante: cuenta 28 bolsas y escribe 28. La diferencia la calcula el
   * sistema contra el saldo del momento, que es justamente la cuenta que hoy se
   * hace mal en una planilla aparte.
   *
   * El motivo es obligatorio y no por prolijidad: un ajuste sin explicación es
   * indistinguible de un error de carga, y el que audita el mes que viene no
   * tiene cómo saber si faltaron doce bolsas porque se rompieron o porque
   * alguien tipeó mal.
   *
   * Contar lo mismo que decía el sistema no asienta nada. Un movimiento de cero
   * no mueve nada y la base lo rechaza; que el conteo haya coincidido es una
   * buena noticia, no un asiento en el libro.
   */
  ajustar: procedimientoAdmin
    .input(
      z.object({
        insumoId: z.uuid(),
        contado: z.number().min(0, 'Un conteo no puede dar negativo.'),
        motivo: z.string().trim().min(1, 'Un ajuste sin motivo no se puede auditar.').max(200),
        ocurridoEn: z.iso.datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: insumo, error: errorInsumo } = await ctx.supabase
        .from('insumo')
        .select('id, nombre, unidad, stock_actual')
        .eq('id', input.insumoId)
        .maybeSingle();

      if (errorInsumo) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorInsumo.message });
      }
      if (!insumo) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese insumo.' });

      const diferencia = Number((input.contado - insumo.stock_actual).toFixed(2));

      if (diferencia === 0) {
        return { ajustado: false as const, diferencia: 0, stockAnterior: insumo.stock_actual };
      }

      const { error } = await ctx.supabase.from('movimiento_stock').insert({
        insumo_id: input.insumoId,
        tipo: 'ajuste',
        cantidad: diferencia,
        motivo: input.motivo,
        registro_cuidado_id: null,
        orden_compra_id: null,
        ocurrido_en: input.ocurridoEn ?? new Date().toISOString(),
      });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return { ajustado: true as const, diferencia, stockAnterior: insumo.stock_actual };
    }),

  /**
   * Un movimiento suelto, para lo que entra o sale sin orden ni registro de
   * cuidado: una donación, una bolsa que se rompió, el forraje que se compró en
   * el momento y sin orden.
   */
  mover: procedimientoAdmin
    .input(
      z.object({
        insumoId: z.uuid(),
        // Sin `ajuste`: ese entra por `ajustar`, que pide el conteo y no la
        // diferencia, y es lo que impide corregir una existencia sin decir por qué.
        tipo: z.enum(['ingreso', 'egreso']),
        cantidad: z.number().positive('La cantidad tiene que ser mayor que cero.'),
        motivo: z.string().trim().min(1, 'Falta decir de qué se trata.').max(200),
        ocurridoEn: z.iso.datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('movimiento_stock').insert({
        insumo_id: input.insumoId,
        tipo: input.tipo,
        cantidad: input.cantidad,
        motivo: input.motivo,
        registro_cuidado_id: null,
        orden_compra_id: null,
        ocurrido_en: input.ocurridoEn ?? new Date().toISOString(),
      });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

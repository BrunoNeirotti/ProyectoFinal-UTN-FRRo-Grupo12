import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/lib/supabase/tipos-generados';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import {
  MOMENTOS,
  type PlanComputable,
  TIPOS_CUIDADO,
  fechaCorrida,
  momentoDe,
  tareasDeAlimentacion,
} from '@/lib/bienestar';

/**
 * M9 · Registro de cuidado.
 *
 * La entidad que más se escribe del sistema. Tres propiedades la gobiernan y
 * ninguna es negociable:
 *
 * 1. **El identificador lo trae el cliente** (decisión 1.6). La tabla no tiene
 *    `default` en la clave primaria a propósito: cuando M14 sincronice la cola,
 *    reintentar un envío chocará con la clave y no duplicará. Hoy, en línea, el
 *    formulario ya lo genera igual, así que el camino es el mismo y M14 no
 *    tendrá que cambiar esta firma.
 *
 * 2. **El consumo de insumos cuelga del registro** (decisión 1.7). Servir la
 *    ración descuenta la existencia, y el `movimiento_stock` que lo hace apunta
 *    de vuelta al registro que lo originó. Es la unión entre Bienestar e
 *    Inventario que el árbol de problemas señalaba como rota.
 *
 * 3. **La existencia negativa se permite** (CUS02, camino 5.a). Si el peón
 *    informa que sirvió 20 kg y el sistema creía que quedaban 15, se imputan los
 *    20: el consumo físico ya ocurrió y negarlo sólo lograría que el registro no
 *    exista. La existencia queda en rojo y se regulariza con un ajuste, que es
 *    justamente el dato que hoy no se tiene.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');
const procedimientoEscritura = procedimientoDeArea('bienestar');

const momento = z.enum(MOMENTOS);

/**
 * Lo que la pantalla envía por caballo o por box. El `id` viene del cliente.
 *
 * `caballoId` es nulo cuando el cuidado es de la instalación y no de un animal:
 * la higiene de un box desocupado (CUS03, camino 2.a). La base exige que al
 * menos uno de los dos vínculos esté (`registro_cuidado_sobre_algo`).
 */
const registro = z.object({
  id: z.uuid(),
  caballoId: z.uuid().nullable(),
  instalacionId: z.uuid().nullable(),
  ocurridoEn: z.iso.datetime(),
  registradoEn: z.iso.datetime(),
  observaciones: z.string().trim().min(1).optional(),
  /** Qué se consumió. Sin insumo no hay movimiento de existencias. */
  insumoId: z.uuid().nullable(),
  cantidad: z.number().positive('La cantidad tiene que ser mayor que cero.').nullable(),
});

type Registro = z.infer<typeof registro>;

/**
 * Persiste los registros y su consumo, en ese orden.
 *
 * `sincronizado_en` se escribe explícitamente y no por omisión: la fila que
 * llega al servidor está sincronizada por definición, y en una inserción de
 * varias filas PostgREST unifica las claves y escribe nulo donde una fila no
 * trae la columna, pisando cualquier valor por omisión de la tabla.
 */
async function persistir(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
  tipo: (typeof TIPOS_CUIDADO)[number],
  registros: readonly Registro[],
) {
  const ahora = new Date().toISOString();

  const filas = registros.map((r) => ({
    id: r.id,
    caballo_id: r.caballoId,
    instalacion_id: r.instalacionId,
    tipo,
    usuario_id: usuarioId,
    ocurrido_en: r.ocurridoEn,
    registrado_en: r.registradoEn,
    sincronizado_en: ahora,
    observaciones: r.observaciones ?? null,
  }));

  // `upsert` y no `insert` por la idempotencia de la decisión 1.6: un reintento
  // trae los mismos identificadores y tiene que terminar bien, no en un choque
  // de clave primaria que la pantalla no sabría distinguir de un error real.
  const { error, data } = await supabase
    .from('registro_cuidado')
    .upsert(filas, { onConflict: 'id', ignoreDuplicates: true })
    .select('id');

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

  const nuevos = new Set((data ?? []).map((f) => f.id as string));

  // El consumo se imputa sólo de lo que se insertó ahora. Un reintento no vuelve
  // a descontar: si el registro ya estaba, su movimiento también.
  const consumos = registros
    .filter((r) => nuevos.has(r.id) && r.insumoId !== null && r.cantidad !== null)
    .map((r) => ({
      insumo_id: r.insumoId!,
      tipo: 'egreso' as const,
      cantidad: r.cantidad!,
      motivo: tipo === 'alimentacion' ? 'Ración servida' : 'Material repuesto',
      registro_cuidado_id: r.id,
      orden_compra_id: null,
      ocurrido_en: r.ocurridoEn,
    }));

  if (consumos.length > 0) {
    const { error: errorStock } = await supabase.from('movimiento_stock').insert(consumos);
    if (errorStock) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorStock.message });
    }
  }

  return { registrados: nuevos.size, repetidos: registros.length - nuevos.size };
}

export const routerRegistroCuidado = crearRouter({
  /**
   * La jornada del peón: qué falta servir en este momento del día.
   *
   * Se resuelve por diferencia contra los registros de hoy y no por una marca de
   * completado. Reabrir el turno es gratis y no hay nada que mantener: si la
   * fila está, la tarea está.
   */
  tareasDelTurno: procedimientoLectura
    .input(z.object({ momento: momento.optional(), fecha: z.iso.date().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const ahora = new Date();
      const elMomento = input?.momento ?? momentoDe(ahora);
      const fecha = input?.fecha ?? ahora.toISOString().slice(0, 10);

      const [{ data: caballos, error }, { data: planes }, { data: registros }] = await Promise.all([
        ctx.supabase
          .from('caballo')
          .select('id, nombre, estado, peso_kg, instalacion:instalacion_id (id, nombre)')
          .neq('estado', 'retirado')
          .order('nombre'),
        ctx.supabase
          .from('plan_alimentario')
          .select('id, caballo_id, momento, descripcion, cantidad_kg, vigente_desde, insumo_id, insumo:insumo_id (nombre, unidad)')
          .lte('vigente_desde', fecha),
        ctx.supabase
          .from('registro_cuidado')
          .select('caballo_id, tipo, ocurrido_en')
          .gte('ocurrido_en', `${fecha}T00:00:00-03:00`)
          .lt('ocurrido_en', `${fecha}T23:59:59.999-03:00`),
      ]);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const porCaballo = new Map<string, PlanComputable[]>();
      const insumoDePlan = new Map<string, { nombre: string; unidad: string } | null>();

      for (const p of planes ?? []) {
        const lista = porCaballo.get(p.caballo_id) ?? [];
        lista.push({
          id: p.id,
          momento: p.momento,
          descripcion: p.descripcion,
          cantidadKg: p.cantidad_kg,
          insumoId: p.insumo_id,
          vigenteDesde: p.vigente_desde,
        });
        porCaballo.set(p.caballo_id, lista);
        insumoDePlan.set(p.id, p.insumo ?? null);
      }

      const tareas = tareasDeAlimentacion(
        (caballos ?? []).map((c) => ({
          id: c.id,
          nombre: c.nombre,
          estado: c.estado,
          pesoKg: c.peso_kg,
          instalacionId: c.instalacion?.id ?? null,
          instalacionNombre: c.instalacion?.nombre ?? null,
        })),
        porCaballo,
        (registros ?? []).map((r) => ({
          caballoId: r.caballo_id,
          tipo: r.tipo,
          ocurridoEn: r.ocurrido_en,
        })),
        elMomento,
        fecha,
      );

      return {
        momento: elMomento,
        fecha,
        tareas: tareas.map((t) => ({
          ...t,
          insumo: t.plan ? (insumoDePlan.get(t.plan.id) ?? null) : null,
        })),
        pendientes: tareas.filter((t) => !t.hecho).length,
      };
    }),

  /**
   * Los boxes con su caballo y la última reposición de material (CUS03, paso 2).
   *
   * El box desocupado aparece igual: la higiene se registra contra la
   * instalación aunque no haya animal adentro (camino 2.a).
   */
  boxesParaHigiene: procedimientoLectura.query(async ({ ctx }) => {
    const [{ data: boxes, error }, { data: alojados }, { data: ultimos }] = await Promise.all([
      ctx.supabase
        .from('instalacion')
        .select('id, nombre, tipo')
        .eq('tipo', 'box')
        .eq('activo', true)
        .order('nombre'),
      ctx.supabase
        .from('caballo')
        .select('id, nombre, instalacion_id')
        .neq('estado', 'retirado')
        .not('instalacion_id', 'is', null),
      ctx.supabase
        .from('registro_cuidado')
        .select('instalacion_id, ocurrido_en')
        .eq('tipo', 'higiene')
        .not('instalacion_id', 'is', null)
        .order('ocurrido_en', { ascending: false })
        .limit(500),
    ]);

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    const caballoDeBox = new Map((alojados ?? []).map((c) => [c.instalacion_id!, c]));

    // La primera aparición de cada box es la más reciente: la consulta ya vino
    // ordenada por fecha descendente sobre la tabla principal, no embebida.
    const ultimaHigiene = new Map<string, string>();
    for (const r of ultimos ?? []) {
      if (!ultimaHigiene.has(r.instalacion_id!)) ultimaHigiene.set(r.instalacion_id!, r.ocurrido_en);
    }

    return (boxes ?? []).map((box) => ({
      instalacionId: box.id,
      nombre: box.nombre,
      caballo: caballoDeBox.get(box.id) ?? null,
      ultimaHigiene: ultimaHigiene.get(box.id) ?? null,
    }));
  }),

  /**
   * Los registros de un período. Sin fechas, los últimos 30 días.
   *
   * El período por omisión se resuelve acá y no en la pantalla porque «los
   * últimos treinta días» es parte de la consulta, no de cómo se dibuja: una
   * ficha que calculara la ventana en el render dependería del reloj del
   * proceso que la renderiza.
   */
  listar: procedimientoLectura
    .input(
      z.object({
        caballoId: z.uuid().optional(),
        tipo: z.enum(TIPOS_CUIDADO).optional(),
        desde: z.iso.date().optional(),
        hasta: z.iso.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasta = input.hasta ?? new Date().toISOString().slice(0, 10);
      const desde = input.desde ?? fechaCorrida(hasta, -30);

      let consulta = ctx.supabase
        .from('registro_cuidado')
        .select(
          `id, tipo, ocurrido_en, registrado_en, sincronizado_en, observaciones,
           caballo:caballo_id (id, nombre),
           instalacion:instalacion_id (id, nombre),
           usuario:usuario_id (id, persona:persona_id (nombre, apellido))`,
        )
        .gte('ocurrido_en', `${desde}T00:00:00-03:00`)
        .lte('ocurrido_en', `${hasta}T23:59:59.999-03:00`)
        .order('ocurrido_en', { ascending: false });

      if (input.caballoId) consulta = consulta.eq('caballo_id', input.caballoId);
      if (input.tipo) consulta = consulta.eq('tipo', input.tipo);

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  /** La alimentación siempre es de un animal: sin caballo no hay a quién servirle. */
  registrarAlimentacion: procedimientoEscritura
    .input(
      z.object({
        registros: z
          .array(registro.extend({ caballoId: z.uuid() }))
          .min(1, 'No hay nada que registrar.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return persistir(ctx.supabase, ctx.sesion.usuarioId, 'alimentacion', input.registros);
    }),

  /** La higiene es del box: el caballo va si lo hay, y la instalación es obligatoria. */
  registrarHigiene: procedimientoEscritura
    .input(
      z.object({
        registros: z
          .array(registro.extend({ instalacionId: z.uuid() }))
          .min(1, 'No hay nada que registrar.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return persistir(ctx.supabase, ctx.sesion.usuarioId, 'higiene', input.registros);
    }),

  /**
   * Corrige la observación o el instante de un registro propio.
   *
   * Lo que no se corrige acá es el consumo: rectificar una existencia es un
   * ajuste de inventario, que deja rastro de por qué cambió. Sobrescribir el
   * movimiento original haría desaparecer el error en lugar de explicarlo.
   */
  corregir: procedimientoEscritura
    .input(
      z.object({
        registroId: z.uuid(),
        ocurridoEn: z.iso.datetime(),
        observaciones: z.string().trim().min(1).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // RLS `cuidado_propio` deja corregir lo propio, y al administrador todo.
      const { data, error } = await ctx.supabase
        .from('registro_cuidado')
        .update({ ocurrido_en: input.ocurridoEn, observaciones: input.observaciones })
        .eq('id', input.registroId)
        .select('id');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!data?.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Sólo se puede corregir un registro propio.',
        });
      }
      return { ok: true as const };
    }),

  eliminar: procedimientoAdmin
    .input(z.object({ registroId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('registro_cuidado')
        .delete()
        .eq('id', input.registroId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

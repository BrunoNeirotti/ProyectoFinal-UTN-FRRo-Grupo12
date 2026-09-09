import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { MOMENTOS, planesVigentesEn } from '@/lib/bienestar';
import { mensajeDeError } from '../errores';

/**
 * M9 · Plan alimentario.
 *
 * Qué come cada caballo en cada momento del día. Lo lee todo el personal
 * (RLS: `plan_lectura`), porque es lo que el peón necesita para servir; lo
 * escribe el administrador (RLS: `plan_escritura`), porque cambiar la ración es
 * una decisión de manejo.
 *
 * **El plan no se edita: se supersede.** `vigente_desde` convierte cada cambio
 * en una fila nueva y la anterior queda como historia. Es el mismo criterio de
 * la tarifa (decisión 1.4) y por el mismo motivo: si se pisara la fila, un
 * registro de cuidado viejo pasaría a decir que se sirvió una ración que en ese
 * momento no existía. `modificar` corrige una fila mal cargada; cambiar la
 * ración es dar de alta la que rige desde ahora.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');

const momento = z.enum(MOMENTOS);

export const routerPlanAlimentario = crearRouter({
  /** Los planes de un caballo, con el vigente de cada momento señalado. */
  porCaballo: procedimientoLectura
    .input(z.object({ caballoId: z.uuid(), fecha: z.iso.date().optional() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('plan_alimentario')
        .select(
          `id, momento, descripcion, cantidad_kg, vigente_desde, insumo_id,
           insumo:insumo_id (id, nombre, unidad, stock_actual)`,
        )
        .eq('caballo_id', input.caballoId)
        .order('vigente_desde', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const planes = data ?? [];
      const vigentes = planesVigentesEn(
        planes.map((p) => ({
          id: p.id,
          momento: p.momento,
          descripcion: p.descripcion,
          cantidadKg: p.cantidad_kg,
          insumoId: p.insumo_id,
          vigenteDesde: p.vigente_desde,
        })),
        input.fecha ?? new Date(),
      );

      const idsVigentes = new Set([...vigentes.values()].map((p) => p.id));

      return {
        planes: planes.map((p) => ({ ...p, vigente: idsVigentes.has(p.id) })),
        vigentesPorMomento: Object.fromEntries(
          MOMENTOS.map((m) => [m, vigentes.get(m)?.id ?? null]),
        ) as Record<(typeof MOMENTOS)[number], string | null>,
      };
    }),

  crear: procedimientoAdmin
    .input(
      z.object({
        caballoId: z.uuid(),
        momento,
        descripcion: z.string().trim().min(1, 'Hay que describir qué se le da.'),
        cantidadKg: z.number().positive('La cantidad tiene que ser mayor que cero.').nullable(),
        insumoId: z.uuid().nullable(),
        vigenteDesde: z.iso.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('plan_alimentario')
        .insert({
          caballo_id: input.caballoId,
          momento: input.momento,
          descripcion: input.descripcion,
          cantidad_kg: input.cantidadKg,
          insumo_id: input.insumoId,
          vigente_desde: input.vigenteDesde,
        })
        .select('id')
        .single();

      // `plan_unico_por_momento` impide dos planes del mismo momento con la
      // misma fecha de vigencia. Es un choque previsible -se guarda dos veces el
      // mismo formulario- y merece un mensaje, no un error de base.
      if (error?.code === '23505') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ya hay un plan para ese momento con esa misma fecha de vigencia.',
        });
      }
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      return { planId: data.id as string };
    }),

  /** Corrige una fila mal cargada. Para cambiar la ración se da de alta otra. */
  modificar: procedimientoAdmin
    .input(
      z.object({
        planId: z.uuid(),
        descripcion: z.string().trim().min(1, 'Hay que describir qué se le da.'),
        cantidadKg: z.number().positive('La cantidad tiene que ser mayor que cero.').nullable(),
        insumoId: z.uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('plan_alimentario')
        .update({
          descripcion: input.descripcion,
          cantidad_kg: input.cantidadKg,
          insumo_id: input.insumoId,
        })
        .eq('id', input.planId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),
});

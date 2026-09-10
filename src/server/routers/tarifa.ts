import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';
import { mensajeDeError } from '../errores';

/**
 * M1 · Alta de tarifa (decisión 1.4: los precios se versionan, no se pisan).
 *
 * No hay `modificar`: actualizar un precio siempre es un alta nueva con su
 * propia `vigente_desde`. Es la única forma de que un estado de cuenta ya
 * emitido se pueda recalcular con el importe que regía ese mes.
 *
 * M11 (CUS07, alt. 8.a) agrega la otra restricción de fecha: no puede regir
 * desde dentro de un período ya liquidado. La aplica el disparador
 * `trg_tarifa_no_retroactiva`, y acá se la traduce como cualquier otro error
 * de la base.
 */
export const routerTarifa = crearRouter({
  crear: procedimientoAdmin
    .input(
      z.object({
        servicioId: z.uuid(),
        importe: z.number().min(0, 'El importe no puede ser negativo.'),
        vigenteDesde: z.iso.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('tarifa').insert({
        servicio_id: input.servicioId,
        importe: input.importe,
        vigente_desde: input.vigenteDesde,
      });

      if (error) {
        // Unique (servicio_id, vigente_desde): dos altas el mismo día para el
        // mismo servicio son casi siempre un doble clic, no dos precios reales.
        const duplicada = error.code === '23505';
        // P0001 con este origen es el disparador de retroactividad: rechazo de
        // negocio, no una falla del servidor.
        const retroactiva = error.code === 'P0001';
        throw new TRPCError({
          code: duplicada ? 'CONFLICT' : retroactiva ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
          message: duplicada
            ? 'Ya existe una tarifa de este servicio con esa fecha de vigencia.'
            : mensajeDeError(error),
        });
      }

      return { ok: true as const };
    }),
});

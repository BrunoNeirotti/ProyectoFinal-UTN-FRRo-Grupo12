import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';

/**
 * M1 · Alta de tarifa (decisión 1.4: los precios se versionan, no se pisan).
 *
 * No hay `modificar`: actualizar un precio siempre es un alta nueva con su
 * propia `vigente_desde`. Es la única forma de que un estado de cuenta ya
 * emitido se pueda recalcular con el importe que regía ese mes.
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
        throw new TRPCError({
          code: duplicada ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicada
            ? 'Ya existe una tarifa de este servicio con esa fecha de vigencia.'
            : error.message,
        });
      }

      return { ok: true as const };
    }),
});

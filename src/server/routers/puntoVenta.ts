import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';

/**
 * M6 · Puntos de venta (RN-03).
 *
 * ARCA prohíbe compartir un punto de venta entre el facturador manual («en
 * línea») y un servicio web: el del sistema tiene que ser uno nuevo, dado de
 * alta como `web_service`. Registrar acá el punto manual también (si existe)
 * es sólo para que la pantalla lo muestre y nadie confunda uno con otro; el
 * sistema nunca emite contra él.
 */
const procedimiento = procedimientoDeArea('gerencia');

export const routerPuntoVenta = crearRouter({
  listar: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('punto_venta')
      .select('id, numero, descripcion, modo, activo')
      .order('numero', { ascending: true });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  crear: procedimientoAdmin
    .input(
      z.object({
        numero: z.int().positive('El número de punto de venta tiene que ser positivo.'),
        descripcion: z.string().trim().min(1, 'Hace falta una descripción.'),
        modo: z.enum(['web_service', 'en_linea']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('punto_venta').insert({
        numero: input.numero,
        descripcion: input.descripcion,
        modo: input.modo,
      });

      if (error) {
        const duplicado = error.code === '23505';
        throw new TRPCError({
          code: duplicado ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicado ? 'Ya existe un punto de venta con ese número.' : error.message,
        });
      }
      return { ok: true as const };
    }),

  /** Baja lógica: un punto de venta no se borra (la numeración de ARCA lo recuerda igual). */
  desactivar: procedimientoAdmin.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabase.from('punto_venta').update({ activo: false }).eq('id', input.id);
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return { ok: true as const };
  }),
});

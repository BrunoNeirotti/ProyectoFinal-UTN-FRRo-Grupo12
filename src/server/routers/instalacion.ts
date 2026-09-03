import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';

/**
 * M1 · Boxes, piquetes, pistas y picaderos.
 *
 * Boxes y pistas viven en la misma tabla a propósito (03-modelo-de-datos.md
 * § 4): ambos son recursos escasos sobre los que hay que detectar conflictos.
 * La lectura alcanza a todo el personal (RLS: `instalacion_lectura` exige
 * `es_personal()`); el alta y la baja son del administrador.
 */
export const routerInstalacion = crearRouter({
  listar: procedimientoDeArea('bienestar').query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('instalacion')
      .select('id, nombre, tipo, capacidad, activo')
      .order('tipo')
      .order('nombre');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  crear: procedimientoAdmin
    .input(
      z.object({
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        tipo: z.enum(['box', 'piquete', 'pista', 'picadero']),
        capacidad: z.int().min(1, 'La capacidad tiene que ser al menos 1.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('instalacion').insert({
        nombre: input.nombre,
        tipo: input.tipo,
        capacidad: input.capacidad,
      });

      if (error) {
        const duplicada = error.code === '23505';
        throw new TRPCError({
          code: duplicada ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicada ? 'Ya existe una instalación con ese nombre.' : error.message,
        });
      }

      return { ok: true as const };
    }),

  modificar: procedimientoAdmin
    .input(
      z.object({
        instalacionId: z.uuid(),
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        tipo: z.enum(['box', 'piquete', 'pista', 'picadero']),
        capacidad: z.int().min(1, 'La capacidad tiene que ser al menos 1.'),
        activo: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('instalacion')
        .update({
          nombre: input.nombre,
          tipo: input.tipo,
          capacidad: input.capacidad,
          activo: input.activo,
        })
        .eq('id', input.instalacionId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

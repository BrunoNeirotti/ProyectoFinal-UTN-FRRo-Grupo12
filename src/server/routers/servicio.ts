import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoAutenticado } from '../trpc';
import { tarifaVigenteEn } from '@/lib/tarifas';
import { mensajeDeError } from '../errores';

/**
 * M1 · Catálogo de servicios y sus tarifas.
 *
 * El catálogo lo ve cualquier autenticado (RLS: `servicio_lectura using(true)`):
 * el cliente tiene que poder entender de dónde sale su cargo. Sólo el
 * administrador da de alta o modifica.
 */

export const routerServicio = crearRouter({
  /** Listado con la tarifa vigente resuelta, no la última cargada. */
  listar: procedimientoAutenticado.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('servicio')
      .select('id, nombre, unidad, aplica_a, modalidad, activo, tarifa(importe, vigente_desde)')
      .order('nombre');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    return (data ?? []).map((s) => {
      const vigente = tarifaVigenteEn(
        (s.tarifa ?? []).map((t) => ({ importe: Number(t.importe), vigenteDesde: t.vigente_desde })),
      );
      return {
        id: s.id,
        nombre: s.nombre,
        unidad: s.unidad,
        aplicaA: s.aplica_a,
        modalidad: s.modalidad,
        activo: s.activo,
        tarifaVigente: vigente,
      };
    });
  }),

  crear: procedimientoAdmin
    .input(
      z.object({
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        unidad: z.enum(['mensual', 'por_clase', 'por_evento']),
        aplicaA: z.enum(['caballo', 'alumno']),
        // RN-14: sólo tiene sentido en los servicios de clase; el resto queda sin modalidad.
        modalidad: z.enum(['individual', 'grupal']).nullable(),
        importeInicial: z.number().min(0, 'El importe no puede ser negativo.'),
        vigenteDesde: z.iso.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: servicio, error: errorServicio } = await ctx.supabase
        .from('servicio')
        .insert({
          nombre: input.nombre,
          unidad: input.unidad,
          aplica_a: input.aplicaA,
          modalidad: input.modalidad,
        })
        .select('id')
        .single();

      if (errorServicio) {
        const duplicado = errorServicio.code === '23505';
        throw new TRPCError({
          code: duplicado ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicado ? 'Ya existe un servicio con ese nombre.' : errorServicio.message,
        });
      }

      const { error: errorTarifa } = await ctx.supabase.from('tarifa').insert({
        servicio_id: servicio.id,
        importe: input.importeInicial,
        vigente_desde: input.vigenteDesde,
      });

      if (errorTarifa) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorTarifa) });
      }

      return { servicioId: servicio.id as string };
    }),

  modificar: procedimientoAdmin
    .input(
      z.object({
        servicioId: z.uuid(),
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        unidad: z.enum(['mensual', 'por_clase', 'por_evento']),
        modalidad: z.enum(['individual', 'grupal']).nullable(),
        activo: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // `aplica_a` no se edita: cambiarlo dejaría contratos existentes apuntando
      // al objeto equivocado (caballo vs. alumno) sin que nada lo detecte.
      const { error } = await ctx.supabase
        .from('servicio')
        .update({
          nombre: input.nombre,
          unidad: input.unidad,
          modalidad: input.modalidad,
          activo: input.activo,
        })
        .eq('id', input.servicioId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),
});

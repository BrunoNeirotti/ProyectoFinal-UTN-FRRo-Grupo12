import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { mensajeDeError } from '../errores';

/**
 * M2 · Contratos.
 *
 * El vínculo comercial concreto: este cliente, este servicio, por este caballo
 * o este alumno. La base ya impide el contrato huérfano —el disparador
 * `validar_objeto_del_contrato` exige exactamente uno de `caballo_id` /
 * `alumno_id`, según `servicio.aplica_a`—; acá se repite la validación para
 * devolver un mensaje entendible antes de llegar a la base.
 */

const procedimiento = procedimientoDeArea('clientes');

const objeto = z
  .object({ caballoId: z.uuid().optional(), alumnoId: z.uuid().optional() })
  .refine((o) => (o.caballoId != null) !== (o.alumnoId != null), {
    message: 'El contrato tiene que aplicarse a un caballo o a un alumno, exactamente uno de los dos.',
  });

export const routerContrato = crearRouter({
  crear: procedimiento
    .input(
      z
        .object({
          clienteId: z.uuid(),
          servicioId: z.uuid(),
          fechaInicio: z.iso.date(),
          importePactado: z.number().min(0).optional(),
        })
        .and(objeto),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: servicio, error: errorServicio } = await ctx.supabase
        .from('servicio')
        .select('aplica_a')
        .eq('id', input.servicioId)
        .single();

      if (errorServicio) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'El servicio indicado no existe.' });
      }
      if (servicio.aplica_a === 'caballo' && !input.caballoId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este servicio se presta sobre un caballo: falta indicar cuál.',
        });
      }
      if (servicio.aplica_a === 'alumno' && !input.alumnoId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este servicio se presta sobre un alumno: falta indicar cuál.',
        });
      }

      const { data, error } = await ctx.supabase
        .from('contrato')
        .insert({
          cliente_id: input.clienteId,
          servicio_id: input.servicioId,
          caballo_id: input.caballoId ?? null,
          alumno_id: input.alumnoId ?? null,
          fecha_inicio: input.fechaInicio,
          importe_pactado: input.importePactado ?? null,
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { contratoId: data.id as string };
    }),

  modificar: procedimiento
    .input(
      z.object({
        contratoId: z.uuid(),
        fechaFin: z.iso.date().nullable(),
        importePactado: z.number().min(0).nullable(),
        estado: z.enum(['vigente', 'suspendido', 'finalizado']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('contrato')
        .update({
          fecha_fin: input.fechaFin,
          importe_pactado: input.importePactado,
          estado: input.estado,
        })
        .eq('id', input.contratoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  darDeBaja: procedimiento
    .input(z.object({ contratoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('contrato')
        .update({ estado: 'finalizado', fecha_fin: new Date().toISOString().slice(0, 10) })
        .eq('id', input.contratoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /**
   * Aviso de contratos por vencer.
   *
   * Un contrato con `fecha_fin` cargada y próxima es casi siempre uno que hay
   * que renovar o dar de baja a tiempo: sin este aviso, se descubre recién
   * cuando el mes siguiente no generó el cargo esperado.
   */
  porVencer: procedimiento
    .input(z.object({ dentroDeDias: z.int().min(1).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const hoy = new Date();
      const limite = new Date(hoy);
      limite.setUTCDate(limite.getUTCDate() + input.dentroDeDias);

      const { data, error } = await ctx.supabase
        .from('contrato')
        .select(
          'id, fecha_fin, cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido)), servicio:servicio_id (nombre)',
        )
        .eq('estado', 'vigente')
        .not('fecha_fin', 'is', null)
        .gte('fecha_fin', hoy.toISOString().slice(0, 10))
        .lte('fecha_fin', limite.toISOString().slice(0, 10))
        .order('fecha_fin');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return data ?? [];
    }),
});

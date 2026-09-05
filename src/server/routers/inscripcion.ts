import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { cancelacionEnTermino, cupoDeClase } from '@/lib/agenda';
import { antelacionMinimaDeCancelacion } from '../parametros-servidor';

/**
 * M7 · Inscripciones a una clase.
 *
 * Router propio y no parte de `clase` porque son operaciones de distinto sujeto:
 * la clase la programa el establecimiento, la inscripción la protagoniza el
 * alumno, y en M13 el propio cliente va a anotar a los suyos desde el portal
 * (la política `inscripcion_del_cliente` ya lo contempla en la base).
 *
 * Dos reglas que valen la pena leer juntas, porque parecen la misma y no lo son:
 *
 *   * **El cupo completo sí frena** la inscripción (CUS05, camino 4.a). Es un
 *     límite físico: la pista y el instructor no dan para más.
 *   * **La falta de contrato vigente no frena**: advierte (camino 4.b). Es un
 *     asunto comercial, y el instructor no es quien lo resuelve. Lo que no puede
 *     pasar es que se dicte la clase y después nadie sepa que no tenía respaldo.
 */

const procedimiento = procedimientoDeArea('ensenanza');

export const routerInscripcion = crearRouter({
  /** Inscribir un alumno en una clase (EI). */
  inscribir: procedimiento
    .input(
      z.object({
        claseId: z.uuid(),
        alumnoId: z.uuid(),
        /** El caballo PREVISTO al programar (decisión 1.11), no con el que montó. */
        caballoId: z.uuid().nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: clase, error: errorClase } = await ctx.supabase
        .from('clase')
        .select('id, estado, cupo, servicio:servicio_id (id, nombre, modalidad)')
        .eq('id', input.claseId)
        .maybeSingle();

      if (errorClase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorClase.message });
      if (!clase) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });
      if (clase.estado === 'cancelada') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase está suspendida: no admite inscripciones.' });
      }
      if (clase.estado === 'dictada') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La clase ya se dictó: no admite inscripciones.' });
      }

      const { data: anotados, error: errorAnotados } = await ctx.supabase
        .from('inscripcion')
        .select('id, alumno_id, estado')
        .eq('clase_id', input.claseId);

      if (errorAnotados) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorAnotados.message });

      const activos = (anotados ?? []).filter((i) => i.estado === 'inscripto');
      const cupo = cupoDeClase(clase.servicio?.modalidad ?? null, clase.cupo, activos.length);

      if (activos.some((i) => i.alumno_id === input.alumnoId)) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Ese alumno ya está inscripto en esta clase.' });
      }
      if (cupo.completo) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            clase.servicio?.modalidad === 'individual'
              ? 'Es una clase individual y ya tiene su alumno.'
              : `La clase está completa: ${cupo.ocupados} de ${cupo.limite}.`,
        });
      }

      // CUS05 camino 4.b: se advierte, no se impide. La respuesta la da una
      // función de la base, porque el instructor no puede leer los contratos.
      const { data: respaldado } = await ctx.supabase.rpc('tiene_contrato_vigente', {
        p_alumno: input.alumnoId,
        p_servicio: clase.servicio?.id ?? '',
      });

      // Una inscripción cancelada se reactiva en lugar de duplicarse: la base
      // tiene `inscripcion_unica (clase_id, alumno_id)`, así que un alumno que
      // se dio de baja y se vuelve a anotar no puede entrar como fila nueva.
      const previa = (anotados ?? []).find((i) => i.alumno_id === input.alumnoId);

      const { error } = previa
        ? await ctx.supabase
            .from('inscripcion')
            .update({
              estado: 'inscripto',
              cancelado_en: null,
              caballo_id: input.caballoId,
              inscripto_en: new Date().toISOString(),
            })
            .eq('id', previa.id)
        : await ctx.supabase.from('inscripcion').insert({
            clase_id: input.claseId,
            alumno_id: input.alumnoId,
            caballo_id: input.caballoId,
          });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return {
        ok: true as const,
        /** Falso: la clase se va a dictar sin contrato que la respalde. */
        conContratoVigente: respaldado === true,
      };
    }),

  /**
   * Cancelar una inscripción (EI).
   *
   * `cancelado_en` es lo que después permite evaluar la antelación contra
   * `cancelacion_clase_dias` (decisión 1.11). La cancelación fuera de término se
   * registra igual y se informa: si el sistema la rechazara, el alumno faltaría
   * sin avisar y el establecimiento perdería el dato, que es peor.
   */
  cancelar: procedimiento
    .input(z.object({ inscripcionId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: inscripcion, error: errorInscripcion } = await ctx.supabase
        .from('inscripcion')
        .select('id, estado, clase:clase_id (inicia_en, estado)')
        .eq('id', input.inscripcionId)
        .maybeSingle();

      if (errorInscripcion) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorInscripcion.message });
      }
      if (!inscripcion) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa inscripción.' });
      if (inscripcion.estado === 'cancelado') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Esa inscripción ya estaba cancelada.' });
      }
      if (inscripcion.clase?.estado === 'dictada') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La clase ya se dictó: la ausencia se registra en la asistencia, no cancelando la inscripción.',
        });
      }

      const diasMinimos = await antelacionMinimaDeCancelacion(ctx.supabase);
      const ahora = new Date();
      const enTermino = inscripcion.clase
        ? cancelacionEnTermino(inscripcion.clase.inicia_en, ahora, diasMinimos)
        : true;

      const { error } = await ctx.supabase
        .from('inscripcion')
        .update({ estado: 'cancelado', cancelado_en: ahora.toISOString() })
        .eq('id', input.inscripcionId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      return { ok: true as const, enTermino, diasMinimos };
    }),
});

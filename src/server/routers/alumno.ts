import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { esMenorDeEdad } from '@/lib/personas';
import type { Database } from '@/lib/supabase/tipos-generados';
import { mensajeDeError } from '../errores';

/**
 * M2 · Alumnos.
 *
 * Quien monta puede no ser quien paga (decisión 1.1): `alumno.persona_id` es el
 * chico o adulto que toma la clase, `alumno.cliente_id` es quién factura por él.
 * El menor de edad exige responsable y consentimiento explícito (decisión 1.3,
 * Ley 25.326): sin los dos, la promesa legal de la factibilidad no tiene
 * sustento en el sistema, así que se valida acá y no sólo en la pantalla.
 */

const procedimiento = procedimientoDeArea('clientes');

const datosPersona = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
  apellido: z.string().trim().min(1, 'El apellido no puede quedar vacío.'),
  tipoDocumento: z.enum(['dni', 'cuit', 'cuil', 'pasaporte']),
  numeroDocumento: z.string().trim().min(6, 'El documento parece incompleto.'),
  fechaNacimiento: z.iso.date(),
});

// El responsable es mayor por definición: no hace falta pedirle la fecha de
// nacimiento para darlo de alta, y no hay que inventarle una.
const datosPersonaAdulta = datosPersona.omit({ fechaNacimiento: true });

async function personaIdempotente(
  supabase: SupabaseClient<Database>,
  datos: z.infer<typeof datosPersonaAdulta> & { fechaNacimiento?: string },
) {
  const { data: existente } = await supabase
    .from('persona')
    .select('id')
    .eq('tipo_documento', datos.tipoDocumento)
    .eq('numero_documento', datos.numeroDocumento)
    .maybeSingle();

  if (existente) return existente.id as string;

  const { data: nueva, error } = await supabase
    .from('persona')
    .insert({
      nombre: datos.nombre,
      apellido: datos.apellido,
      tipo_documento: datos.tipoDocumento,
      numero_documento: datos.numeroDocumento,
      fecha_nacimiento: datos.fechaNacimiento ?? null,
    })
    .select('id')
    .single();

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
  return nueva.id as string;
}

/** Decisión 1.3: sin responsable ni consentimiento, un menor no puede darse de alta. */
function exigirResponsableSiEsMenor(input: {
  fechaNacimiento: string;
  responsable?: z.infer<typeof datosPersonaAdulta>;
  consentimientoTutorEn?: string;
}) {
  if (!esMenorDeEdad(input.fechaNacimiento)) return;

  if (!input.responsable) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Es menor de edad: hace falta cargar el responsable.',
    });
  }
  if (!input.consentimientoTutorEn) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Es menor de edad: hace falta registrar el consentimiento del tutor (Ley 25.326).',
    });
  }
}

export const routerAlumno = crearRouter({
  listar: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('alumno')
      .select(
        `id, nivel, activo, consentimiento_tutor_en,
         persona:persona_id (nombre, apellido, fecha_nacimiento),
         responsable:responsable_id (id, nombre, apellido),
         cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))`,
      )
      .order('activo', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
    return data ?? [];
  }),

  crear: procedimiento
    .input(
      z.object({
        persona: datosPersona,
        clienteId: z.uuid(),
        nivel: z.enum(['inicial', 'nivel_1', 'nivel_2', 'nivel_3']).nullable().default(null),
        observacionesMedicas: z.string().trim().optional(),
        responsable: datosPersonaAdulta.optional(),
        consentimientoTutorEn: z.iso.datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      exigirResponsableSiEsMenor({
        fechaNacimiento: input.persona.fechaNacimiento,
        responsable: input.responsable,
        consentimientoTutorEn: input.consentimientoTutorEn,
      });

      const personaId = await personaIdempotente(ctx.supabase, input.persona);
      const responsableId = input.responsable
        ? await personaIdempotente(ctx.supabase, input.responsable)
        : null;

      const { data, error } = await ctx.supabase
        .from('alumno')
        .insert({
          persona_id: personaId,
          cliente_id: input.clienteId,
          responsable_id: responsableId,
          consentimiento_tutor_en: input.consentimientoTutorEn ?? null,
          nivel: input.nivel,
          observaciones_medicas: input.observacionesMedicas ?? null,
        })
        .select('id')
        .single();

      if (error) {
        const duplicado = error.code === '23505';
        throw new TRPCError({
          code: duplicado ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicado ? 'Esa persona ya está dada de alta como alumno.' : error.message,
        });
      }

      return { alumnoId: data.id as string };
    }),

  modificar: procedimiento
    .input(
      z.object({
        alumnoId: z.uuid(),
        nivel: z.enum(['inicial', 'nivel_1', 'nivel_2', 'nivel_3']).nullable(),
        observacionesMedicas: z.string().trim().optional(),
        responsableId: z.uuid().nullable(),
        consentimientoTutorEn: z.iso.datetime().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('alumno')
        .update({
          nivel: input.nivel,
          observaciones_medicas: input.observacionesMedicas ?? null,
          responsable_id: input.responsableId,
          consentimiento_tutor_en: input.consentimientoTutorEn,
        })
        .eq('id', input.alumnoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  desactivar: procedimiento
    .input(z.object({ alumnoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('alumno')
        .update({ activo: false })
        .eq('id', input.alumnoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),
});

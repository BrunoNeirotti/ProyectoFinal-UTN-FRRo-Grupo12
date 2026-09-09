import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoAutenticado } from '../trpc';
import { verificarLimitesWhatsapp } from '@/lib/mensajeria';
import { mensajeDeError } from '../errores';

/**
 * M5 · Plantillas de mensajes.
 *
 * La lee todo el personal (RLS: `plantilla_lectura` con `es_personal()`),
 * porque instructores y peones también disparan avisos (confirmación de
 * clase, clase suspendida). Sólo el administrador da de alta o modifica.
 *
 * `estado_aprobacion` no lo cambia este router: lo actualiza quien registra
 * el resultado de la revisión de Meta (procedimiento separado, más abajo),
 * porque es un evento distinto de editar el texto.
 */
const procedimiento = procedimientoAutenticado;

export const routerPlantillaMensaje = crearRouter({
  listar: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('plantilla_mensaje')
      .select(
        'id, codigo, canal, asunto, cuerpo, activa, nombre_meta, categoria, idioma, estado_aprobacion, revisada_en, motivo_rechazo, firmante_origen',
      )
      .order('codigo');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
    return data ?? [];
  }),

  crear: procedimientoAdmin
    .input(
      z.object({
        codigo: z
          .string()
          .trim()
          .regex(/^[a-z0-9_]+$/, 'El código va en minúsculas, sin espacios (usar guión bajo).'),
        canal: z.enum(['whatsapp', 'email']),
        asunto: z.string().trim().optional(), // sólo email
        cuerpo: z.string().trim().min(1, 'El cuerpo no puede quedar vacío.'),
        categoria: z.enum(['utility', 'marketing']).nullable().default(null),
        firmanteOrigen: z
          .enum(['responsable_cobranza', 'instructor_clase', 'quien_envia'])
          .default('quien_envia'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // RN-18: el pie no admite variables en WhatsApp, así que se valida el
      // cuerpo con el pie vacío (no se modela `pie` como columna propia: las
      // plantillas de este haras lo llevan fijo dentro del cuerpo, al final).
      if (input.canal === 'whatsapp') {
        const problemas = verificarLimitesWhatsapp(input.cuerpo);
        if (problemas.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: problemas.map((p) => p.motivo).join(' ') });
        }
      }

      const { error } = await ctx.supabase.from('plantilla_mensaje').insert({
        codigo: input.codigo,
        canal: input.canal,
        asunto: input.canal === 'email' ? (input.asunto ?? null) : null,
        cuerpo: input.cuerpo,
        categoria: input.categoria,
        firmante_origen: input.firmanteOrigen,
      });

      if (error) {
        const duplicada = error.code === '23505';
        throw new TRPCError({
          code: duplicada ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
          message: duplicada ? 'Ya existe una plantilla con ese código en ese canal.' : error.message,
        });
      }

      return { ok: true as const };
    }),

  modificar: procedimientoAdmin
    .input(
      z.object({
        plantillaId: z.uuid(),
        asunto: z.string().trim().optional(),
        cuerpo: z.string().trim().min(1, 'El cuerpo no puede quedar vacío.'),
        activa: z.boolean(),
        firmanteOrigen: z.enum(['responsable_cobranza', 'instructor_clase', 'quien_envia']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: actual } = await ctx.supabase
        .from('plantilla_mensaje')
        .select('canal')
        .eq('id', input.plantillaId)
        .single();

      if (actual?.canal === 'whatsapp') {
        const problemas = verificarLimitesWhatsapp(input.cuerpo);
        if (problemas.length > 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: problemas.map((p) => p.motivo).join(' ') });
        }
      }

      // Editar el cuerpo vuelve la plantilla a borrador: un texto editado a
      // último momento no sale hasta que Meta lo apruebe de nuevo.
      const { error } = await ctx.supabase
        .from('plantilla_mensaje')
        .update({
          asunto: input.asunto ?? null,
          cuerpo: input.cuerpo,
          activa: input.activa,
          firmante_origen: input.firmanteOrigen,
          estado_aprobacion: 'borrador',
          revisada_en: null,
          motivo_rechazo: null,
        })
        .eq('id', input.plantillaId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),

  /** Registrar el resultado de la revisión de Meta (EI). */
  registrarRevisionMeta: procedimientoAdmin
    .input(
      z.object({
        plantillaId: z.uuid(),
        estadoAprobacion: z.enum(['en_revision', 'aprobada', 'rechazada', 'pausada']),
        nombreMeta: z.string().trim().optional(),
        motivoRechazo: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.estadoAprobacion === 'rechazada' && !input.motivoRechazo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Una plantilla rechazada necesita el motivo, para saber qué corregir.',
        });
      }

      const { error } = await ctx.supabase
        .from('plantilla_mensaje')
        .update({
          estado_aprobacion: input.estadoAprobacion,
          nombre_meta: input.nombreMeta ?? null,
          motivo_rechazo: input.estadoAprobacion === 'rechazada' ? (input.motivoRechazo ?? null) : null,
          revisada_en: new Date().toISOString().slice(0, 10),
        })
        .eq('id', input.plantillaId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const };
    }),
});

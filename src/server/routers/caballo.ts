import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';

/**
 * M2 · Caballos.
 *
 * La lectura alcanza a todo el personal (RLS: `caballo_lectura` con
 * `es_personal()`), porque instructores y peones lo necesitan en el campo. El
 * alta, la edición y la baja son del administrador (RLS: `caballo_escritura`).
 *
 * La ficha consolidada de la Pantalla 11 suma pestañas de Sanidad, Alimentación
 * e Historial que dependen de `evento_sanitario`, `plan_alimentario` y
 * `registro_cuidado` (M9), todavía sin construir. Esta ficha muestra lo que M2
 * ya sostiene —identidad, alojamiento, propietario y contratos— y las demás
 * secciones se enganchan acá cuando M9 esté listo, sin mover esta pantalla.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');

export const routerCaballo = crearRouter({
  listar: procedimientoLectura.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('caballo')
      .select(
        `id, nombre, raza, sexo, estado, fecha_nacimiento,
         instalacion:instalacion_id (nombre, tipo),
         propietario:propietario_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))`,
      )
      .order('nombre');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  ficha: procedimientoLectura
    .input(z.object({ caballoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: caballo, error } = await ctx.supabase
        .from('caballo')
        .select(
          `id, nombre, raza, sexo, pelaje, fecha_nacimiento, peso_kg, fecha_ingreso, estado, foto_url,
           instalacion:instalacion_id (id, nombre, tipo),
           propietario:propietario_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))`,
        )
        .eq('id', input.caballoId)
        .maybeSingle();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      if (!caballo) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese caballo.' });

      const { data: contratos } = await ctx.supabase
        .from('contrato')
        .select('id, fecha_inicio, fecha_fin, estado, importe_pactado, servicio:servicio_id (nombre, unidad)')
        .eq('caballo_id', input.caballoId)
        .order('fecha_inicio', { ascending: false });

      return { caballo, contratos: contratos ?? [] };
    }),

  crear: procedimientoAdmin
    .input(
      z.object({
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        propietarioId: z.uuid().nullable(),
        instalacionId: z.uuid().nullable(),
        raza: z.string().trim().optional(),
        sexo: z.enum(['macho', 'macho_castrado', 'hembra']).optional(),
        pelaje: z.string().trim().optional(),
        fechaNacimiento: z.iso.date().optional(),
        pesoKg: z.number().positive('El peso tiene que ser mayor que cero.').optional(),
        fechaIngreso: z.iso.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('caballo')
        .insert({
          nombre: input.nombre,
          propietario_id: input.propietarioId,
          instalacion_id: input.instalacionId,
          raza: input.raza ?? null,
          sexo: input.sexo ?? null,
          pelaje: input.pelaje ?? null,
          fecha_nacimiento: input.fechaNacimiento ?? null,
          peso_kg: input.pesoKg ?? null,
          fecha_ingreso: input.fechaIngreso ?? null,
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { caballoId: data.id as string };
    }),

  modificar: procedimientoAdmin
    .input(
      z.object({
        caballoId: z.uuid(),
        nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
        propietarioId: z.uuid().nullable(),
        instalacionId: z.uuid().nullable(),
        raza: z.string().trim().optional(),
        sexo: z.enum(['macho', 'macho_castrado', 'hembra']).optional(),
        pelaje: z.string().trim().optional(),
        pesoKg: z.number().positive('El peso tiene que ser mayor que cero.').optional(),
        estado: z.enum(['activo', 'en_tratamiento', 'retirado']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('caballo')
        .update({
          nombre: input.nombre,
          propietario_id: input.propietarioId,
          instalacion_id: input.instalacionId,
          raza: input.raza ?? null,
          sexo: input.sexo ?? null,
          pelaje: input.pelaje ?? null,
          peso_kg: input.pesoKg ?? null,
          estado: input.estado,
        })
        .eq('id', input.caballoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  darDeBaja: procedimientoAdmin
    .input(z.object({ caballoId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('caballo')
        .update({ estado: 'retirado' })
        .eq('id', input.caballoId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

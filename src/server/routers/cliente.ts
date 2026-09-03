import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { validarDatosFiscales } from '@/lib/clientes';
import type { Database } from '@/lib/supabase/tipos-generados';

/**
 * M2 · Clientes.
 *
 * `cliente` es la unidad de facturación (decisión 1.2): guarda los datos
 * fiscales y de contacto para la cobranza, separada de `persona`, que es quien
 * de hecho existe. Toda el área `clientes` del sitemap es del administrador
 * (`lib/roles.ts`), y las políticas RLS lo exigen otra vez del lado de la base.
 */

const procedimiento = procedimientoDeArea('clientes');

const datosPersonaFisica = z.object({
  nombre: z.string().trim().min(1, 'El nombre no puede quedar vacío.'),
  apellido: z.string().trim().min(1, 'El apellido no puede quedar vacío.'),
  tipoDocumento: z.enum(['dni', 'cuit', 'cuil', 'pasaporte']),
  numeroDocumento: z.string().trim().min(6, 'El documento parece incompleto.'),
  telefono: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'El teléfono va en formato internacional, por ejemplo +5493415550188.')
    .optional(),
  email: z.email('El correo no tiene un formato válido.').optional(),
  domicilio: z.string().trim().optional(),
});

const datosFiscalesYContacto = z.object({
  requiereFactura: z.boolean(),
  cuit: z.string().trim().optional(),
  condicionIva: z
    .enum(['responsable_inscripto', 'monotributo', 'consumidor_final', 'exento'])
    .optional(),
  canalPreferido: z.enum(['whatsapp', 'email']).default('whatsapp'),
  diaVencimiento: z.int().min(1).max(28).optional(),
});

function validarFiscalYLanzar(input: {
  requiereFactura: boolean;
  cuit?: string;
  condicionIva?: string;
}) {
  const v = validarDatosFiscales({
    requiereFactura: input.requiereFactura,
    cuit: input.cuit ?? null,
    condicionIva: input.condicionIva ?? null,
  });
  if (!v.valido) throw new TRPCError({ code: 'BAD_REQUEST', message: v.motivo });
}

/** Busca una persona por documento y la reutiliza; si no existe, la crea. */
async function personaIdempotente(
  supabase: SupabaseClient<Database>,
  datos: z.infer<typeof datosPersonaFisica>,
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
      telefono: datos.telefono ?? null,
      email: datos.email ?? null,
      domicilio: datos.domicilio ?? null,
    })
    .select('id')
    .single();

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  return nueva.id as string;
}

export const routerCliente = crearRouter({
  /** Padrón, con el conteo de lo que cada cliente tiene enganchado. */
  listar: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('cliente')
      .select(
        'id, tipo, razon_social, activo, canal_preferido, persona:persona_id (nombre, apellido), contrato(count), caballo(count), alumno(count)',
      )
      .order('activo', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    return (data ?? []).map((c) => ({
      id: c.id,
      tipo: c.tipo,
      nombre:
        c.tipo === 'persona_juridica'
          ? c.razon_social
          : `${c.persona?.apellido ?? ''}, ${c.persona?.nombre ?? ''}`,
      activo: c.activo,
      canalPreferido: c.canal_preferido,
      contratos: c.contrato?.[0]?.count ?? 0,
      caballos: c.caballo?.[0]?.count ?? 0,
      alumnos: c.alumno?.[0]?.count ?? 0,
    }));
  }),

  /** Ficha del cliente con sus contratos, sus caballos y sus alumnos. */
  ficha: procedimiento.input(z.object({ clienteId: z.uuid() })).query(async ({ ctx, input }) => {
    const { data: cliente, error } = await ctx.supabase
      .from('cliente')
      .select(
        `id, tipo, razon_social, cuit, condicion_iva, requiere_factura, canal_preferido,
         dia_vencimiento, consentimiento_en, consentimiento_medio, consentimiento_revocado_en,
         activo, persona:persona_id (nombre, apellido, telefono, email, tipo_documento, numero_documento)`,
      )
      .eq('id', input.clienteId)
      .maybeSingle();

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    if (!cliente) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese cliente.' });

    const { data: contratos } = await ctx.supabase
      .from('contrato')
      .select(
        'id, fecha_inicio, fecha_fin, importe_pactado, estado, servicio:servicio_id (nombre, unidad), caballo:caballo_id (id, nombre), alumno:alumno_id (id, persona:persona_id (nombre, apellido))',
      )
      .eq('cliente_id', input.clienteId)
      .order('fecha_inicio', { ascending: false });

    const { data: caballos } = await ctx.supabase
      .from('caballo')
      .select('id, nombre, estado, instalacion:instalacion_id (nombre)')
      .eq('propietario_id', input.clienteId);

    const { data: alumnos } = await ctx.supabase
      .from('alumno')
      .select('id, nivel, consentimiento_tutor_en, persona:persona_id (nombre, apellido, fecha_nacimiento)')
      .eq('cliente_id', input.clienteId);

    return { cliente, contratos: contratos ?? [], caballos: caballos ?? [], alumnos: alumnos ?? [] };
  }),

  crear: procedimiento
    .input(
      z.discriminatedUnion('tipo', [
        z.object({ tipo: z.literal('persona_fisica'), persona: datosPersonaFisica }).extend(
          datosFiscalesYContacto.shape,
        ),
        z
          .object({
            tipo: z.literal('persona_juridica'),
            razonSocial: z.string().trim().min(1, 'La razón social no puede quedar vacía.'),
          })
          .extend(datosFiscalesYContacto.shape),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      validarFiscalYLanzar(input);

      const personaId =
        input.tipo === 'persona_fisica' ? await personaIdempotente(ctx.supabase, input.persona) : null;

      const { data, error } = await ctx.supabase
        .from('cliente')
        .insert({
          tipo: input.tipo,
          persona_id: personaId,
          razon_social: input.tipo === 'persona_juridica' ? input.razonSocial : null,
          requiere_factura: input.requiereFactura,
          cuit: input.cuit ?? null,
          condicion_iva: input.condicionIva ?? null,
          canal_preferido: input.canalPreferido,
          dia_vencimiento: input.diaVencimiento ?? null,
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Todo cliente tiene cuenta corriente desde que existe (decisión 1.5):
      // M3 posta los cargos ahí, y sin esto no habría dónde.
      const { error: errorCuenta } = await ctx.supabase
        .from('cuenta_corriente')
        .insert({ cliente_id: data.id });
      if (errorCuenta) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: errorCuenta.message });
      }

      return { clienteId: data.id as string };
    }),

  modificar: procedimiento
    .input(
      z.object({
        clienteId: z.uuid(),
        razonSocial: z.string().trim().optional(),
      }).extend(datosFiscalesYContacto.shape),
    )
    .mutation(async ({ ctx, input }) => {
      validarFiscalYLanzar(input);

      const { error } = await ctx.supabase
        .from('cliente')
        .update({
          razon_social: input.razonSocial ?? null,
          requiere_factura: input.requiereFactura,
          cuit: input.cuit ?? null,
          condicion_iva: input.condicionIva ?? null,
          canal_preferido: input.canalPreferido,
          dia_vencimiento: input.diaVencimiento ?? null,
        })
        .eq('id', input.clienteId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  desactivar: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('cliente')
        .update({ activo: false })
        .eq('id', input.clienteId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  /** RN-19: hay que poder demostrar cómo y cuándo se obtuvo el consentimiento. */
  registrarConsentimiento: procedimiento
    .input(z.object({ clienteId: z.uuid(), medio: z.string().trim().min(1, 'Falta indicar el medio.') }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('cliente')
        .update({
          consentimiento_en: new Date().toISOString(),
          consentimiento_medio: input.medio,
          consentimiento_revocado_en: null,
        })
        .eq('id', input.clienteId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  revocarConsentimiento: procedimiento
    .input(z.object({ clienteId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('cliente')
        .update({ consentimiento_revocado_en: new Date().toISOString() })
        .eq('id', input.clienteId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';
import { aplicarPlantilla } from '@/lib/mensajeria';

/**
 * M5 · Envío y trazabilidad de mensajes.
 *
 * **Límite honesto de esta versión.** El sistema no tiene todavía credenciales
 * reales de WhatsApp Cloud API ni de un proveedor de correo (`07-dependencias-
 * externas.md`: no bloquean el desarrollo, sí la producción). `enviarIndividual`
 * valida todo lo que puede validarse hoy —consentimiento, destino, variables
 * completas— y deja el mensaje en `pendiente`: es el mismo estado con el que
 * ya se representa un mensaje encolado fuera de la ventana de RN-17. Conectar
 * un proveedor real es lo que movería el estado a `enviado`; mientras tanto,
 * `registrarEstadoDeEntrega` es el punto donde un webhook real (o, para
 * demostrarlo, un administrador) actualiza ese estado.
 *
 * Todo el router queda detrás de `procedimientoAdmin`: hoy sólo existe la
 * pantalla del administrador (M7/M8/M13 no están construidos), así que un
 * instructor o un cliente no tienen desde dónde llegar acá todavía. Cuando
 * se construya el perfil de campo, `confirmación de clase` y `clase
 * suspendida` (firmante `instructor_clase`) necesitan su propio guarda.
 */
export const routerMensaje = crearRouter({
  /** Historial de mensajes de un cliente (EQ). */
  historialDeCliente: procedimientoAdmin
    .input(z.object({ clienteId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('mensaje')
        .select('id, canal, destino, estado, error, enviado_en, creado_en, plantilla:plantilla_id (codigo, canal)')
        .eq('cliente_id', input.clienteId)
        .order('creado_en', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  /** Reporte de entregabilidad del período (EO): conteo por canal y estado. */
  reporteEntregabilidad: procedimientoAdmin
    .input(z.object({ dias: z.int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const desde = new Date();
      desde.setDate(desde.getDate() - input.dias);

      const { data, error } = await ctx.supabase
        .from('mensaje')
        .select('canal, estado')
        .gte('creado_en', desde.toISOString());

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const conteo: Record<string, number> = {};
      for (const m of data ?? []) {
        const clave = `${m.canal}:${m.estado}`;
        conteo[clave] = (conteo[clave] ?? 0) + 1;
      }
      return { total: (data ?? []).length, porCanalYEstado: conteo };
    }),

  /** Enviar un mensaje individual (EI). */
  enviarIndividual: procedimientoAdmin
    .input(
      z.object({
        plantillaId: z.uuid(),
        clienteId: z.uuid(),
        valores: z.record(z.string(), z.string()).default({}),
        estadoCuentaId: z.uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: plantilla, error: errorPlantilla } = await ctx.supabase
        .from('plantilla_mensaje')
        .select('canal, cuerpo, activa, estado_aprobacion')
        .eq('id', input.plantillaId)
        .single();

      if (errorPlantilla || !plantilla) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa plantilla.' });
      }
      if (!plantilla.activa) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'La plantilla está inactiva.' });
      }
      if (plantilla.canal === 'whatsapp' && plantilla.estado_aprobacion !== 'aprobada') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Meta todavía no aprobó esta plantilla: no se puede enviar por WhatsApp.',
        });
      }

      const { data: cliente, error: errorCliente } = await ctx.supabase
        .from('cliente')
        .select(
          'consentimiento_en, consentimiento_revocado_en, persona:persona_id (telefono, email)',
        )
        .eq('id', input.clienteId)
        .single();

      if (errorCliente || !cliente) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese cliente.' });
      }

      // RN-19: el número nuevo (RN-16) nunca recibió un mensaje del cliente
      // primero, así que no hay margen para asumir el consentimiento.
      if (plantilla.canal === 'whatsapp') {
        const vigente = cliente.consentimiento_en && !cliente.consentimiento_revocado_en;
        if (!vigente) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El cliente no tiene consentimiento de mensajería vigente.',
          });
        }
      }

      const destino = plantilla.canal === 'whatsapp' ? cliente.persona?.telefono : cliente.persona?.email;
      if (!destino) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: plantilla.canal === 'whatsapp' ? 'El cliente no tiene teléfono cargado.' : 'El cliente no tiene correo cargado.',
        });
      }

      const { faltantes } = aplicarPlantilla(plantilla.cuerpo, input.valores);
      if (faltantes.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Faltan datos para: ${faltantes.join(', ')}.`,
        });
      }

      const { data, error } = await ctx.supabase
        .from('mensaje')
        .insert({
          plantilla_id: input.plantillaId,
          cliente_id: input.clienteId,
          canal: plantilla.canal,
          destino,
          estado_cuenta_id: input.estadoCuentaId ?? null,
          estado: 'pendiente',
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { mensajeId: data.id as string };
    }),

  /** Registrar el estado de entrega (EI): lo alimentará un webhook real; hoy es manual. */
  registrarEstadoDeEntrega: procedimientoAdmin
    .input(
      z.object({
        mensajeId: z.uuid(),
        estado: z.enum(['enviado', 'entregado', 'leido', 'fallido']),
        error: z.string().trim().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('mensaje')
        .update({
          estado: input.estado,
          error: input.estado === 'fallido' ? (input.error ?? null) : null,
          enviado_en: input.estado === 'enviado' ? new Date().toISOString() : undefined,
        })
        .eq('id', input.mensajeId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

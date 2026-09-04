import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { identidadFiscalVigenteEn } from '@/lib/arca';

/**
 * M6 · Identidad fiscal del emisor (RN-01, RN-04).
 *
 * El haras factura hoy como monotributista y va a pasar a ser una asociación
 * civil: la condición fiscal del emisor es un dato configurable, con
 * vigencia, no una constante. No hay `modificar`, igual que `tarifa` (1.4):
 * un cambio siempre es un alta nueva, porque un comprobante ya emitido copia
 * la identidad del momento (RN-04) y no puede depender de la fila vigente hoy.
 */
const procedimiento = procedimientoDeArea('gerencia');

export const routerIdentidadFiscal = crearRouter({
  /** Historial completo, más reciente primero (EQ). */
  listar: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('identidad_fiscal')
      .select('id, razon_social, cuit, condicion_iva, vigente_desde, domicilio_fiscal, ingresos_brutos, inicio_actividades')
      .order('vigente_desde', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  /** La identidad vigente hoy, o null si todavía no se cargó ninguna. */
  vigente: procedimiento.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('identidad_fiscal')
      .select('id, razon_social, cuit, condicion_iva, vigente_desde, domicilio_fiscal, ingresos_brutos, inicio_actividades');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    return identidadFiscalVigenteEn(
      (data ?? []).map((i) => ({
        id: i.id,
        razonSocial: i.razon_social,
        cuit: i.cuit,
        condicionIva: i.condicion_iva,
        vigenteDesde: i.vigente_desde,
        domicilioFiscal: i.domicilio_fiscal,
        ingresosBrutos: i.ingresos_brutos,
        inicioActividades: i.inicio_actividades,
      })),
    );
  }),

  /** Alta de identidad fiscal con vigencia (EI). */
  crear: procedimientoAdmin
    .input(
      z.object({
        razonSocial: z.string().trim().min(1, 'La razón social no puede quedar vacía.'),
        cuit: z.string().trim().regex(/^\d{11}$/, 'El CUIT va sin guiones, 11 dígitos.'),
        condicionIva: z.enum(['monotributo', 'exento', 'responsable_inscripto']),
        vigenteDesde: z.iso.date(),
        domicilioFiscal: z.string().trim().min(1, 'El domicilio fiscal no puede quedar vacío.'),
        ingresosBrutos: z.string().trim().optional(),
        inicioActividades: z.iso.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('identidad_fiscal').insert({
        razon_social: input.razonSocial,
        cuit: input.cuit,
        condicion_iva: input.condicionIva,
        vigente_desde: input.vigenteDesde,
        domicilio_fiscal: input.domicilioFiscal,
        ingresos_brutos: input.ingresosBrutos || null,
        inicio_actividades: input.inicioActividades,
      });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

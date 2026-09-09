import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoDeArea } from '../trpc';
import { alertasSanitarias, rotacionDeDroga } from '@/lib/bienestar';
import { antelacionDeAvisoSanitario } from '../parametros-servidor';
import { mensajeDeError } from '../errores';

/**
 * M9 · Eventos sanitarios.
 *
 * Desparasitación, vacunación, herrador y visita veterinaria. Lo escribe el
 * administrador (RLS: `sanitario_escritura`); lo lee todo el personal y también
 * el cliente, pero sólo de sus propios caballos (RLS: `sanitario_lectura`).
 *
 * **El ciclo se planifica antes de aplicarse** (decisión 1.11). `estado` separa
 * tres cosas que antes eran indistinguibles: lo que está agendado (`previsto`),
 * lo que efectivamente se hizo (`aplicado`) y lo que se decidió no hacer
 * (`omitido`, con el motivo en `observaciones` —una indicación veterinaria de
 * excluir a un animal es un dato clínico, no un hueco—).
 *
 * De ahí sale una regla que atraviesa el router: **el vencimiento lo fija lo
 * aplicado.** Un evento previsto no vence, porque avisar de algo que ya está
 * agendado es ruido; y uno omitido no vence tampoco, porque un ciclo salteado no
 * se arregla esperando la fecha siguiente y se informa por otro lado.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');

const TIPOS = ['desparasitacion', 'vacunacion', 'herrador', 'veterinario', 'otro'] as const;

const datosDeAplicacion = {
  producto: z.string().trim().min(1).optional(),
  dosis: z.string().trim().min(1).optional(),
  profesional: z.string().trim().min(1).optional(),
  proximaFecha: z.iso.date().nullable(),
  observaciones: z.string().trim().min(1).optional(),
  costo: z.number().nonnegative('El costo no puede ser negativo.').optional(),
};

export const routerEventoSanitario = crearRouter({
  /** Historial sanitario de un caballo, con la secuencia de drogas aplicadas. */
  porCaballo: procedimientoLectura
    .input(z.object({ caballoId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('evento_sanitario')
        .select(
          `id, tipo, estado, fecha, producto, dosis, profesional, proxima_fecha,
           observaciones, costo, registro_cuidado_id`,
        )
        .eq('caballo_id', input.caballoId)
        .order('fecha', { ascending: false });

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const eventos = data ?? [];

      return {
        eventos,
        rotacion: rotacionDeDroga(
          eventos
            .filter((e) => e.tipo === 'desparasitacion')
            .map((e) => ({ fecha: e.fecha, estado: e.estado, producto: e.producto })),
        ),
      };
    }),

  /**
   * Los vencimientos que ameritan aviso, del más urgente al menos.
   *
   * Se traen los eventos con `proxima_fecha` cargada y la clasificación se hace
   * acá y no en SQL a propósito: es la misma función que usa la ficha del
   * caballo, así que el tablero y la ficha no pueden pintar de rojo animales
   * distintos.
   */
  alertas: procedimientoLectura.query(async ({ ctx }) => {
    const diasDeAviso = await antelacionDeAvisoSanitario(ctx.supabase);

    const { data, error } = await ctx.supabase
      .from('evento_sanitario')
      .select('caballo_id, tipo, estado, proxima_fecha, caballo:caballo_id (id, nombre, estado)')
      .not('proxima_fecha', 'is', null);

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const filas = data ?? [];
    const hoy = new Date().toISOString().slice(0, 10);

    const alertas = alertasSanitarias(
      filas.map((f) => ({
        caballoId: f.caballo_id,
        tipo: f.tipo,
        estado: f.estado,
        proximaFecha: f.proxima_fecha,
      })),
      hoy,
      diasDeAviso,
    );

    // El caballo retirado ya no está en el establecimiento: su vencimiento no es
    // una tarea pendiente de nadie.
    const caballos = new Map(filas.map((f) => [f.caballo_id, f.caballo]));

    return {
      diasDeAviso,
      alertas: alertas
        .filter((a) => caballos.get(a.caballoId)?.estado !== 'retirado')
        .map((a) => ({ ...a, caballoNombre: caballos.get(a.caballoId)?.nombre ?? null })),
    };
  }),

  /** El cronograma: lo agendado y todavía sin aplicar, del más próximo al menos. */
  previstos: procedimientoLectura.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('evento_sanitario')
      .select('id, tipo, fecha, producto, dosis, profesional, observaciones, caballo:caballo_id (id, nombre)')
      .eq('estado', 'previsto')
      .order('fecha');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
    return data ?? [];
  }),

  /** Registra un hecho que ya ocurrió. */
  registrar: procedimientoAdmin
    .input(
      z.object({
        caballoId: z.uuid(),
        tipo: z.enum(TIPOS),
        fecha: z.iso.date(),
        registroCuidadoId: z.uuid().nullable().optional(),
        ...datosDeAplicacion,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('evento_sanitario')
        .insert({
          caballo_id: input.caballoId,
          tipo: input.tipo,
          estado: 'aplicado',
          fecha: input.fecha,
          producto: input.producto ?? null,
          dosis: input.dosis ?? null,
          profesional: input.profesional ?? null,
          proxima_fecha: input.proximaFecha,
          observaciones: input.observaciones ?? null,
          costo: input.costo ?? null,
          registro_cuidado_id: input.registroCuidadoId ?? null,
        })
        .select('id')
        .single();

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { eventoId: data.id as string };
    }),

  /**
   * Agenda un ciclo para una fecha futura, sin aplicarlo.
   *
   * Acepta varios caballos de una vez porque así ocurre: la desparasitación es
   * estacional y se programa para el lote, no animal por animal (CUS04).
   */
  programar: procedimientoAdmin
    .input(
      z.object({
        caballoIds: z.array(z.uuid()).min(1, 'Hay que elegir al menos un caballo.'),
        tipo: z.enum(TIPOS),
        fecha: z.iso.date(),
        producto: z.string().trim().min(1).optional(),
        dosis: z.string().trim().min(1).optional(),
        profesional: z.string().trim().min(1).optional(),
        observaciones: z.string().trim().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Toda columna va explícita en cada fila: en una inserción de varias filas
      // PostgREST unifica las claves y escribe nulo donde una fila no la trae,
      // pisando el valor por omisión de la tabla.
      const filas = input.caballoIds.map((caballoId) => ({
        caballo_id: caballoId,
        tipo: input.tipo,
        estado: 'previsto' as const,
        fecha: input.fecha,
        producto: input.producto ?? null,
        dosis: input.dosis ?? null,
        profesional: input.profesional ?? null,
        proxima_fecha: null,
        observaciones: input.observaciones ?? null,
        costo: null,
        registro_cuidado_id: null,
      }));

      const { data, error } = await ctx.supabase.from('evento_sanitario').insert(filas).select('id');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { programados: data?.length ?? 0 };
    }),

  /**
   * Cierra un ciclo previsto.
   *
   * La fecha que queda es la de aplicación efectiva, no la que se había
   * agendado: el dato que sirve para calcular el próximo vencimiento es cuándo
   * se aplicó de verdad.
   */
  aplicar: procedimientoAdmin
    .input(z.object({ eventoId: z.uuid(), fecha: z.iso.date(), ...datosDeAplicacion }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('evento_sanitario')
        .update({
          estado: 'aplicado',
          fecha: input.fecha,
          producto: input.producto ?? null,
          dosis: input.dosis ?? null,
          profesional: input.profesional ?? null,
          proxima_fecha: input.proximaFecha,
          observaciones: input.observaciones ?? null,
          costo: input.costo ?? null,
        })
        .eq('id', input.eventoId)
        .eq('estado', 'previsto') // no se reabre lo ya cerrado
        .select('id');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      if (!data?.length) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ese evento ya no está previsto: alguien lo aplicó u omitió antes.',
        });
      }
      return { ok: true as const };
    }),

  /**
   * Da por no aplicado un ciclo previsto.
   *
   * El motivo es obligatorio y no es burocracia: la razón corriente de saltear a
   * un animal es una indicación veterinaria -una yegua preñada, un caballo
   * medicado- y eso hay que poder leerlo después.
   */
  omitir: procedimientoAdmin
    .input(
      z.object({
        eventoId: z.uuid(),
        motivo: z.string().trim().min(1, 'Hay que decir por qué no se aplicó.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('evento_sanitario')
        .update({ estado: 'omitido', observaciones: input.motivo })
        .eq('id', input.eventoId)
        .eq('estado', 'previsto')
        .select('id');

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      if (!data?.length) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Ese evento ya no está previsto: alguien lo aplicó u omitió antes.',
        });
      }
      return { ok: true as const };
    }),
});

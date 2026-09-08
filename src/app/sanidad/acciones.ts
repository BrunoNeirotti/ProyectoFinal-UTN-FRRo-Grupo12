'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

function opcional(datos: FormData, campo: string): string | undefined {
  return texto(datos, campo) || undefined;
}

function refrescar(caballoId?: string) {
  revalidatePath('/sanidad');
  revalidatePath('/campo/hoy');
  revalidatePath('/caballos');
  if (caballoId) revalidatePath(`/caballos/${caballoId}`);
}

/**
 * Programa un ciclo para un lote de caballos (CUS04).
 *
 * Los caballos llegan como una lista de casillas con el mismo nombre, así que
 * `getAll` devuelve exactamente los tildados. Es el único formulario del sistema
 * que opera sobre varios animales a la vez, y lo hace porque así ocurre: la
 * desparasitación es estacional y se decide para el conjunto.
 */
export async function programarCiclo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const caballoIds = datos.getAll('caballo').map(String).filter(Boolean);
  if (caballoIds.length === 0) {
    return { estado: 'error', mensaje: 'Hay que elegir al menos un caballo.' };
  }

  try {
    const api = await llamador();
    const r = await api.eventoSanitario.programar({
      caballoIds,
      tipo: texto(datos, 'tipo') as 'desparasitacion',
      fecha: texto(datos, 'fecha'),
      producto: opcional(datos, 'producto'),
      dosis: opcional(datos, 'dosis'),
      profesional: opcional(datos, 'profesional'),
      observaciones: opcional(datos, 'observaciones'),
    });

    refrescar();
    return { estado: 'ok', guardados: r.programados };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo programar el ciclo.' };
  }
}

/** Cierra un ciclo previsto con lo que efectivamente se aplicó. */
export async function aplicarCiclo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.eventoSanitario.aplicar({
      eventoId: texto(datos, 'eventoId'),
      fecha: texto(datos, 'fecha'),
      producto: opcional(datos, 'producto'),
      dosis: opcional(datos, 'dosis'),
      profesional: opcional(datos, 'profesional'),
      observaciones: opcional(datos, 'observaciones'),
      proximaFecha: texto(datos, 'proximaFecha') || null,
      costo: texto(datos, 'costo') ? Number(texto(datos, 'costo').replace(',', '.')) : undefined,
    });

    refrescar(texto(datos, 'caballoId'));
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la aplicación.' };
  }
}

/** Da por no aplicado un ciclo previsto. El motivo es obligatorio. */
export async function omitirCiclo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.eventoSanitario.omitir({
      eventoId: texto(datos, 'eventoId'),
      motivo: texto(datos, 'motivo'),
    });

    refrescar(texto(datos, 'caballoId'));
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo omitir el ciclo.' };
  }
}

/** Registra un hecho sanitario que ya ocurrió, sin haber estado programado. */
export async function registrarEvento(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.eventoSanitario.registrar({
      caballoId: texto(datos, 'caballoId'),
      tipo: texto(datos, 'tipo') as 'veterinario',
      fecha: texto(datos, 'fecha'),
      producto: opcional(datos, 'producto'),
      dosis: opcional(datos, 'dosis'),
      profesional: opcional(datos, 'profesional'),
      observaciones: opcional(datos, 'observaciones'),
      proximaFecha: texto(datos, 'proximaFecha') || null,
      costo: texto(datos, 'costo') ? Number(texto(datos, 'costo').replace(',', '.')) : undefined,
    });

    refrescar(texto(datos, 'caballoId'));
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar el evento.' };
  }
}

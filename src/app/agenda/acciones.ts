'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

type Nivel = 'inicial' | 'nivel_1' | 'nivel_2' | 'nivel_3';

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

function nivelOpcional(datos: FormData): Nivel | null {
  const valor = texto(datos, 'nivel');
  return valor === '' ? null : (valor as Nivel);
}

function cupoOpcional(datos: FormData): number | null {
  const valor = texto(datos, 'cupo');
  return valor === '' ? null : Number(valor);
}

/**
 * Consulta previa de disponibilidad (EO «detección de conflicto de
 * instalación»).
 *
 * Existe aparte del alta porque contesta antes de guardar: el instructor prueba
 * un horario, ve contra qué choca y corrige, en lugar de completar el
 * formulario entero para que se lo rechacen. El alta vuelve a preguntar igual,
 * porque entre una cosa y la otra alguien pudo tomar la franja.
 */
export type ResultadoDeDisponibilidad =
  | { estado: 'inicial' }
  | { estado: 'libre' }
  | { estado: 'ocupado'; mensaje: string }
  | { estado: 'error'; mensaje: string };

export async function verificarDisponibilidad(
  _previo: ResultadoDeDisponibilidad,
  datos: FormData,
): Promise<ResultadoDeDisponibilidad> {
  try {
    const api = await llamador();
    const r = await api.clase.verificarConflicto({
      instalacionId: texto(datos, 'instalacionId'),
      instructorId: texto(datos, 'instructorId'),
      fecha: texto(datos, 'fecha'),
      hora: texto(datos, 'hora'),
      duracionMin: Number(datos.get('duracionMin') ?? 60),
      claseId: texto(datos, 'claseId') || undefined,
    });

    return r.libre ? { estado: 'libre' } : { estado: 'ocupado', mensaje: r.mensaje ?? '' };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo verificar la disponibilidad.' };
  }
}

export async function programarClase(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.clase.crear({
      servicioId: texto(datos, 'servicioId'),
      instructorId: texto(datos, 'instructorId'),
      instalacionId: texto(datos, 'instalacionId'),
      fecha: texto(datos, 'fecha'),
      hora: texto(datos, 'hora'),
      duracionMin: Number(datos.get('duracionMin') ?? 60),
      cupo: cupoOpcional(datos),
      nivel: nivelOpcional(datos),
    });
    revalidatePath('/agenda');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo programar la clase.' };
  }
}

export async function modificarClase(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const claseId = texto(datos, 'claseId');
  try {
    const api = await llamador();
    await api.clase.modificar({
      claseId,
      instructorId: texto(datos, 'instructorId'),
      instalacionId: texto(datos, 'instalacionId'),
      fecha: texto(datos, 'fecha'),
      hora: texto(datos, 'hora'),
      duracionMin: Number(datos.get('duracionMin') ?? 60),
      cupo: cupoOpcional(datos),
      nivel: nivelOpcional(datos),
    });
    revalidatePath('/agenda');
    revalidatePath(`/agenda/${claseId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar la clase.' };
  }
}

export async function suspenderClase(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const claseId = texto(datos, 'claseId');
  try {
    const api = await llamador();
    await api.clase.suspender({ claseId, motivo: texto(datos, 'motivo') });
    revalidatePath('/agenda');
    revalidatePath(`/agenda/${claseId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo suspender la clase.' };
  }
}

/**
 * La inscripción tiene un resultado propio porque puede salir bien y aun así
 * tener algo que decir: el alumno quedó anotado sin contrato vigente del
 * servicio (CUS05, camino 4.b). Devolver eso como error sería mentir —la
 * inscripción existe— y callarlo dejaría la clase sin respaldo contractual al
 * liquidarse, que es justo lo que la advertencia evita.
 */
export type ResultadoDeInscripcion =
  | { estado: 'inicial' }
  | { estado: 'ok'; advertencia: string | null }
  | { estado: 'error'; mensaje: string };

export async function inscribirAlumno(
  _previo: ResultadoDeInscripcion,
  datos: FormData,
): Promise<ResultadoDeInscripcion> {
  const claseId = texto(datos, 'claseId');
  try {
    const api = await llamador();
    const r = await api.inscripcion.inscribir({
      claseId,
      alumnoId: texto(datos, 'alumnoId'),
      caballoId: texto(datos, 'caballoId') || null,
    });

    revalidatePath('/agenda');
    revalidatePath(`/agenda/${claseId}`);

    return {
      estado: 'ok',
      advertencia: r.conContratoVigente
        ? null
        : 'Quedó inscripto, pero no tiene contrato vigente de este servicio: la clase se dictaría sin respaldo contractual.',
    };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo inscribir al alumno.' };
  }
}

/** La cancelación siempre se registra; lo que cambia es si entró en término. */
export type ResultadoDeCancelacion =
  | { estado: 'inicial' }
  | { estado: 'ok'; enTermino: boolean; diasMinimos: number }
  | { estado: 'error'; mensaje: string };

export async function cancelarInscripcion(
  _previo: ResultadoDeCancelacion,
  datos: FormData,
): Promise<ResultadoDeCancelacion> {
  const claseId = texto(datos, 'claseId');
  try {
    const api = await llamador();
    const r = await api.inscripcion.cancelar({ inscripcionId: texto(datos, 'inscripcionId') });

    revalidatePath('/agenda');
    revalidatePath(`/agenda/${claseId}`);

    return { estado: 'ok', enTermino: r.enTermino, diasMinimos: r.diasMinimos };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo cancelar la inscripción.' };
  }
}

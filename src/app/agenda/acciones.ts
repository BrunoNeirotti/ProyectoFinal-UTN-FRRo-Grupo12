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
 * Alta de clase y consulta previa de disponibilidad, en una sola acción.
 *
 * Van juntas porque comparten formulario y, sobre todo, porque comparten
 * cartel: con dos estados separados quedaba el «Clase programada» de la vez
 * anterior arriba del conflicto que se acababa de detectar. Un formulario dice
 * una cosa por vez, y es la última que pasó.
 *
 * La consulta previa (EO «detección de conflicto de instalación») contesta
 * antes de guardar, para que el instructor pruebe un horario y corrija en lugar
 * de completar todo y que se lo rechacen. El alta vuelve a preguntar igual:
 * entre una cosa y la otra alguien pudo tomar la franja.
 */
export type ResultadoDeAltaDeClase =
  | { estado: 'inicial' }
  | { estado: 'programada' }
  | { estado: 'libre' }
  | { estado: 'ocupado'; mensaje: string }
  | { estado: 'error'; mensaje: string };

export async function programarOVerificar(
  _previo: ResultadoDeAltaDeClase,
  datos: FormData,
): Promise<ResultadoDeAltaDeClase> {
  const soloVerificar = texto(datos, 'accion') === 'verificar';

  const horario = {
    instructorId: texto(datos, 'instructorId'),
    instalacionId: texto(datos, 'instalacionId'),
    fecha: texto(datos, 'fecha'),
    hora: texto(datos, 'hora'),
    duracionMin: Number(datos.get('duracionMin') ?? 60),
  };

  try {
    const api = await llamador();

    if (soloVerificar) {
      const r = await api.clase.verificarConflicto(horario);
      return r.libre ? { estado: 'libre' } : { estado: 'ocupado', mensaje: r.mensaje ?? '' };
    }

    await api.clase.crear({
      ...horario,
      servicioId: texto(datos, 'servicioId'),
      cupo: cupoOpcional(datos),
      nivel: nivelOpcional(datos),
    });
    revalidatePath('/agenda');
    return { estado: 'programada' };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return {
      estado: 'error',
      mensaje: soloVerificar
        ? 'No se pudo verificar la disponibilidad.'
        : 'No se pudo programar la clase.',
    };
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

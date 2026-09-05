'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

/**
 * Guardar la planilla tiene tres finales distintos y por eso no alcanza con el
 * `ResultadoDeGuardado` común: guardar sin cerrar, cerrar, y no poder cerrar
 * porque falta gente. El tercero no es un error del usuario —lo que cargó se
 * guardó igual— así que decirlo como error sería mentirle.
 */
export type ResultadoDePlanilla =
  | { estado: 'inicial' }
  | { estado: 'guardada'; presentes: number; ausentes: number; faltan: number }
  | { estado: 'cerrada'; presentes: number; ausentes: number }
  | { estado: 'error'; mensaje: string };

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

export async function guardarPlanilla(
  _previo: ResultadoDePlanilla,
  datos: FormData,
): Promise<ResultadoDePlanilla> {
  const claseId = texto(datos, 'claseId');
  const cerrar = texto(datos, 'accion') === 'cerrar';

  // Los campos vienen con el identificador del alumno en el nombre, así que la
  // lista de a quiénes se registró viaja aparte: sin ella habría que adivinar
  // cuáles claves del formulario son alumnos y cuáles no.
  const alumnos = texto(datos, 'alumnos').split(',').filter(Boolean);

  try {
    const api = await llamador();
    const r = await api.asistencia.registrar({
      claseId,
      cerrar,
      asistencias: alumnos.map((alumnoId) => ({
        alumnoId,
        presente: texto(datos, `presente-${alumnoId}`) === 'si',
        caballoId: texto(datos, `caballo-${alumnoId}`) || null,
        observaciones: texto(datos, `obs-${alumnoId}`) || null,
      })),
    });

    revalidatePath('/agenda');
    revalidatePath(`/agenda/${claseId}`);
    revalidatePath(`/agenda/${claseId}/asistencia`);
    revalidatePath('/asistencia');

    return r.cerrada
      ? { estado: 'cerrada', presentes: r.planilla.presentes, ausentes: r.planilla.ausentes }
      : {
          estado: 'guardada',
          presentes: r.planilla.presentes,
          ausentes: r.planilla.ausentes,
          faltan: r.planilla.inscriptos - r.planilla.registrados,
        };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo guardar la asistencia.' };
  }
}

/** Corrección de una fila sobre una clase ya dictada. */
export async function corregirAsistencia(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const claseId = texto(datos, 'claseId');
  try {
    const api = await llamador();
    await api.asistencia.corregir({
      asistenciaId: texto(datos, 'asistenciaId'),
      presente: texto(datos, 'presente') === 'si',
      caballoId: texto(datos, 'caballoId') || null,
      observaciones: texto(datos, 'observaciones') || null,
    });

    revalidatePath(`/agenda/${claseId}/asistencia`);
    revalidatePath('/asistencia');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo corregir la asistencia.' };
  }
}

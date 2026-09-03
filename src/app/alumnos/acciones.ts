'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function opcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

export async function crearAlumno(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const responsableNombre = opcional(datos, 'responsableNombre');
  const consentimientoFecha = opcional(datos, 'consentimientoTutorEn');

  try {
    const api = await llamador();
    await api.alumno.crear({
      persona: {
        nombre: String(datos.get('nombre') ?? ''),
        apellido: String(datos.get('apellido') ?? ''),
        tipoDocumento: String(datos.get('tipoDocumento') ?? 'dni') as
          | 'dni'
          | 'cuit'
          | 'cuil'
          | 'pasaporte',
        numeroDocumento: String(datos.get('numeroDocumento') ?? ''),
        fechaNacimiento: String(datos.get('fechaNacimiento') ?? ''),
      },
      clienteId: String(datos.get('clienteId') ?? ''),
      nivel: (opcional(datos, 'nivel') ?? null) as
        | 'inicial'
        | 'nivel_1'
        | 'nivel_2'
        | 'nivel_3'
        | null,
      observacionesMedicas: opcional(datos, 'observacionesMedicas'),
      responsable: responsableNombre
        ? {
            nombre: responsableNombre,
            apellido: String(datos.get('responsableApellido') ?? ''),
            tipoDocumento: String(datos.get('responsableTipoDocumento') ?? 'dni') as
              | 'dni'
              | 'cuit'
              | 'cuil'
              | 'pasaporte',
            numeroDocumento: String(datos.get('responsableNumeroDocumento') ?? ''),
          }
        : undefined,
      consentimientoTutorEn: consentimientoFecha ? `${consentimientoFecha}T00:00:00.000Z` : undefined,
    });
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el alumno.' };
  }

  revalidatePath('/alumnos');
  redirect('/alumnos');
}

export async function modificarAlumno(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const consentimientoFecha = opcional(datos, 'consentimientoTutorEn');
    await api.alumno.modificar({
      alumnoId: String(datos.get('alumnoId') ?? ''),
      nivel: (opcional(datos, 'nivel') ?? null) as 'inicial' | 'nivel_1' | 'nivel_2' | 'nivel_3' | null,
      observacionesMedicas: opcional(datos, 'observacionesMedicas'),
      responsableId: opcional(datos, 'responsableId') ?? null,
      consentimientoTutorEn: consentimientoFecha ? `${consentimientoFecha}T00:00:00.000Z` : null,
    });
    revalidatePath('/alumnos');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el alumno.' };
  }
}

export async function desactivarAlumno(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.alumno.desactivar({ alumnoId: String(datos.get('alumnoId') ?? '') });
    revalidatePath('/alumnos');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo desactivar el alumno.' };
  }
}

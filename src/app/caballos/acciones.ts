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

export async function crearCaballo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  let caballoId: string;
  try {
    const api = await llamador();
    const peso = opcional(datos, 'pesoKg');
    const resultado = await api.caballo.crear({
      nombre: String(datos.get('nombre') ?? ''),
      propietarioId: opcional(datos, 'propietarioId') ?? null,
      instalacionId: opcional(datos, 'instalacionId') ?? null,
      raza: opcional(datos, 'raza'),
      sexo: opcional(datos, 'sexo') as 'macho' | 'macho_castrado' | 'hembra' | undefined,
      pelaje: opcional(datos, 'pelaje'),
      fechaNacimiento: opcional(datos, 'fechaNacimiento'),
      pesoKg: peso ? Number(peso) : undefined,
      fechaIngreso: opcional(datos, 'fechaIngreso'),
    });
    caballoId = resultado.caballoId;
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el caballo.' };
  }

  revalidatePath('/caballos');
  redirect(`/caballos/${caballoId}`);
}

export async function modificarCaballo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const caballoId = String(datos.get('caballoId') ?? '');
  try {
    const api = await llamador();
    const peso = opcional(datos, 'pesoKg');
    await api.caballo.modificar({
      caballoId,
      nombre: String(datos.get('nombre') ?? ''),
      propietarioId: opcional(datos, 'propietarioId') ?? null,
      instalacionId: opcional(datos, 'instalacionId') ?? null,
      raza: opcional(datos, 'raza'),
      sexo: opcional(datos, 'sexo') as 'macho' | 'macho_castrado' | 'hembra' | undefined,
      pelaje: opcional(datos, 'pelaje'),
      pesoKg: peso ? Number(peso) : undefined,
      estado: String(datos.get('estado') ?? 'activo') as 'activo' | 'en_tratamiento' | 'retirado',
    });
    revalidatePath(`/caballos/${caballoId}`);
    revalidatePath('/caballos');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el caballo.' };
  }
}

export async function darDeBajaCaballo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const caballoId = String(datos.get('caballoId') ?? '');
  try {
    const api = await llamador();
    await api.caballo.darDeBaja({ caballoId });
    revalidatePath(`/caballos/${caballoId}`);
    revalidatePath('/caballos');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de baja el caballo.' };
  }
}

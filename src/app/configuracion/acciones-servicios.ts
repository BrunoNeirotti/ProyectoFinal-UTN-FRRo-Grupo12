'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function datoOpcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

export async function crearServicio(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const modalidad = datoOpcional(datos, 'modalidad');
    await api.servicio.crear({
      nombre: String(datos.get('nombre') ?? ''),
      unidad: String(datos.get('unidad') ?? '') as 'mensual' | 'por_clase' | 'por_evento',
      aplicaA: String(datos.get('aplicaA') ?? '') as 'caballo' | 'alumno',
      modalidad: (modalidad ?? null) as 'individual' | 'grupal' | null,
      importeInicial: Number(datos.get('importeInicial') ?? 0),
      vigenteDesde: String(datos.get('vigenteDesde') ?? ''),
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el servicio.' };
  }
}

export async function modificarServicio(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const modalidad = datoOpcional(datos, 'modalidad');
    await api.servicio.modificar({
      servicioId: String(datos.get('servicioId') ?? ''),
      nombre: String(datos.get('nombre') ?? ''),
      unidad: String(datos.get('unidad') ?? '') as 'mensual' | 'por_clase' | 'por_evento',
      modalidad: (modalidad ?? null) as 'individual' | 'grupal' | null,
      activo: datos.get('activo') === 'true',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el servicio.' };
  }
}

export async function crearTarifa(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.tarifa.crear({
      servicioId: String(datos.get('servicioId') ?? ''),
      importe: Number(datos.get('importe') ?? 0),
      vigenteDesde: String(datos.get('vigenteDesde') ?? ''),
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta la tarifa.' };
  }
}

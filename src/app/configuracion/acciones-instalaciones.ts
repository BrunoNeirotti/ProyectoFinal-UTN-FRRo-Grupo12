'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function crearInstalacion(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.instalacion.crear({
      nombre: String(datos.get('nombre') ?? ''),
      tipo: String(datos.get('tipo') ?? '') as 'box' | 'piquete' | 'pista' | 'picadero',
      capacidad: Number(datos.get('capacidad') ?? 1),
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta la instalación.' };
  }
}

export async function modificarInstalacion(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.instalacion.modificar({
      instalacionId: String(datos.get('instalacionId') ?? ''),
      nombre: String(datos.get('nombre') ?? ''),
      tipo: String(datos.get('tipo') ?? '') as 'box' | 'piquete' | 'pista' | 'picadero',
      capacidad: Number(datos.get('capacidad') ?? 1),
      activo: datos.get('activo') === 'true',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar la instalación.' };
  }
}

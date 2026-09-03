'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from './acciones';

function opcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

export async function invitarUsuario(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.usuario.crear({
      nombre: String(datos.get('nombre') ?? ''),
      apellido: String(datos.get('apellido') ?? ''),
      tipoDocumento: String(datos.get('tipoDocumento') ?? 'dni') as
        | 'dni'
        | 'cuit'
        | 'cuil'
        | 'pasaporte',
      numeroDocumento: String(datos.get('numeroDocumento') ?? ''),
      email: String(datos.get('email') ?? ''),
      telefono: opcional(datos, 'telefono'),
      rol: String(datos.get('rol') ?? 'peon') as 'administrador' | 'instructor' | 'peon' | 'cliente',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo invitar al usuario.' };
  }
}

export async function cambiarRolUsuario(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.usuario.cambiarRol({
      usuarioId: String(datos.get('usuarioId') ?? ''),
      rol: String(datos.get('rol') ?? '') as 'administrador' | 'instructor' | 'peon' | 'cliente',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo cambiar el rol.' };
  }
}

export async function desactivarUsuario(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.usuario.desactivar({ usuarioId: String(datos.get('usuarioId') ?? '') });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo desactivar el usuario.' };
  }
}

'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function crearContrato(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    const caballoId = String(datos.get('caballoId') ?? '').trim();
    const alumnoId = String(datos.get('alumnoId') ?? '').trim();
    const importePactado = String(datos.get('importePactado') ?? '').trim();

    await api.contrato.crear({
      clienteId,
      servicioId: String(datos.get('servicioId') ?? ''),
      caballoId: caballoId === '' ? undefined : caballoId,
      alumnoId: alumnoId === '' ? undefined : alumnoId,
      fechaInicio: String(datos.get('fechaInicio') ?? ''),
      importePactado: importePactado === '' ? undefined : Number(importePactado),
    });

    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el contrato.' };
  }
}

export async function modificarContrato(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    const fechaFin = String(datos.get('fechaFin') ?? '').trim();
    const importePactado = String(datos.get('importePactado') ?? '').trim();

    await api.contrato.modificar({
      contratoId: String(datos.get('contratoId') ?? ''),
      fechaFin: fechaFin === '' ? null : fechaFin,
      importePactado: importePactado === '' ? null : Number(importePactado),
      estado: String(datos.get('estado') ?? 'vigente') as 'vigente' | 'suspendido' | 'finalizado',
    });

    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el contrato.' };
  }
}

export async function darDeBajaContrato(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    await api.contrato.darDeBaja({ contratoId: String(datos.get('contratoId') ?? '') });
    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de baja el contrato.' };
  }
}

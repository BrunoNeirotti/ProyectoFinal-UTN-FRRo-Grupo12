'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export type ResultadoDeCargos =
  | { estado: 'inicial' }
  | { estado: 'ok'; generados: number; omitidos: number; sinTarifa: string[] }
  | { estado: 'error'; mensaje: string };

export async function generarCargos(
  _previo: ResultadoDeCargos,
  datos: FormData,
): Promise<ResultadoDeCargos> {
  try {
    const api = await llamador();
    const r = await api.cuentaCorriente.generarCargosDelPeriodo({
      periodo: String(datos.get('periodo') ?? ''),
    });
    revalidatePath('/cobranza');
    return { estado: 'ok', ...r };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudieron generar los cargos.' };
  }
}

export async function ajusteManual(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    await api.cuentaCorriente.ajusteManual({
      clienteId,
      concepto: String(datos.get('concepto') ?? ''),
      importe: Number(datos.get('importe') ?? 0),
    });
    revalidatePath(`/cobranza/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar el ajuste.' };
  }
}

export async function aplicarMora(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    await api.cuentaCorriente.aplicarMora({
      clienteId,
      base: Number(datos.get('base') ?? 0),
      tasaMensual: Number(datos.get('tasaMensual') ?? 0),
      dias: Number(datos.get('dias') ?? 0),
      importe: Number(datos.get('importe') ?? 0),
    });
    revalidatePath(`/cobranza/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo aplicar el interés.' };
  }
}

export async function condonarInteres(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  try {
    const api = await llamador();
    await api.cuentaCorriente.condonarInteres({ movimientoId: String(datos.get('movimientoId') ?? '') });
    revalidatePath(`/cobranza/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo condonar el interés.' };
  }
}

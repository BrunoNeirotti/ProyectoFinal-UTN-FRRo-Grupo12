'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function registrarPagoManual(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.pago.registrarManual({
      clienteId: String(datos.get('clienteId') ?? ''),
      importe: Number(datos.get('importe') ?? 0),
      medio: String(datos.get('medio') ?? '') as 'transferencia' | 'efectivo' | 'cheque',
      referenciaExterna: String(datos.get('referenciaExterna') ?? '') || undefined,
    });
    revalidatePath('/pagos');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar el pago.' };
  }
}

export type ResultadoDeEnlace =
  | { estado: 'inicial' }
  | { estado: 'ok'; linkPago: string | null }
  | { estado: 'error'; mensaje: string };

export async function generarEnlaceDePago(
  _previo: ResultadoDeEnlace,
  datos: FormData,
): Promise<ResultadoDeEnlace> {
  try {
    const api = await llamador();
    const r = await api.pago.generarPreferencia({
      clienteId: String(datos.get('clienteId') ?? ''),
      importe: Number(datos.get('importe') ?? 0),
      concepto: String(datos.get('concepto') ?? ''),
    });
    revalidatePath('/pagos');
    return { estado: 'ok', linkPago: r.linkPago };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo generar el enlace de pago.' };
  }
}

export async function imputarPago(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.pago.imputar({ pagoId: String(datos.get('pagoId') ?? '') });
    revalidatePath('/pagos');
    revalidatePath(`/pagos/${String(datos.get('pagoId') ?? '')}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo imputar el pago.' };
  }
}

export async function anularImputacionDePago(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const pagoId = String(datos.get('pagoId') ?? '');
  try {
    const api = await llamador();
    await api.pago.anularImputacion({ movimientoId: String(datos.get('movimientoId') ?? '') });
    revalidatePath('/pagos');
    revalidatePath(`/pagos/${pagoId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo anular la imputación.' };
  }
}

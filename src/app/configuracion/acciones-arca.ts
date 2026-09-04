'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from './acciones';

function datoOpcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

export async function crearIdentidadFiscal(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.identidadFiscal.crear({
      razonSocial: String(datos.get('razonSocial') ?? ''),
      cuit: String(datos.get('cuit') ?? ''),
      condicionIva: String(datos.get('condicionIva') ?? '') as 'monotributo' | 'exento' | 'responsable_inscripto',
      vigenteDesde: String(datos.get('vigenteDesde') ?? ''),
      domicilioFiscal: String(datos.get('domicilioFiscal') ?? ''),
      ingresosBrutos: datoOpcional(datos, 'ingresosBrutos'),
      inicioActividades: String(datos.get('inicioActividades') ?? ''),
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta la identidad fiscal.' };
  }
}

export async function desactivarPuntoVenta(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.puntoVenta.desactivar({ id: String(datos.get('id') ?? '') });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo desactivar el punto de venta.' };
  }
}

export async function crearPuntoVenta(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.puntoVenta.crear({
      numero: Number(datos.get('numero') ?? 0),
      descripcion: String(datos.get('descripcion') ?? ''),
      modo: String(datos.get('modo') ?? '') as 'web_service' | 'en_linea',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el punto de venta.' };
  }
}

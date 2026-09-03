'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function opcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

export async function crearPlantilla(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.plantillaMensaje.crear({
      codigo: String(datos.get('codigo') ?? ''),
      canal: String(datos.get('canal') ?? 'whatsapp') as 'whatsapp' | 'email',
      asunto: opcional(datos, 'asunto'),
      cuerpo: String(datos.get('cuerpo') ?? ''),
      categoria: (opcional(datos, 'categoria') ?? null) as 'utility' | 'marketing' | null,
      firmanteOrigen: String(datos.get('firmanteOrigen') ?? 'quien_envia') as
        | 'responsable_cobranza'
        | 'instructor_clase'
        | 'quien_envia',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta la plantilla.' };
  }
}

export async function modificarPlantilla(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.plantillaMensaje.modificar({
      plantillaId: String(datos.get('plantillaId') ?? ''),
      asunto: opcional(datos, 'asunto'),
      cuerpo: String(datos.get('cuerpo') ?? ''),
      activa: datos.get('activa') === 'true',
      firmanteOrigen: String(datos.get('firmanteOrigen') ?? 'quien_envia') as
        | 'responsable_cobranza'
        | 'instructor_clase'
        | 'quien_envia',
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar la plantilla.' };
  }
}

export async function registrarRevisionMeta(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.plantillaMensaje.registrarRevisionMeta({
      plantillaId: String(datos.get('plantillaId') ?? ''),
      estadoAprobacion: String(datos.get('estadoAprobacion') ?? 'en_revision') as
        | 'en_revision'
        | 'aprobada'
        | 'rechazada'
        | 'pausada',
      nombreMeta: opcional(datos, 'nombreMeta'),
      motivoRechazo: opcional(datos, 'motivoRechazo'),
    });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la revisión.' };
  }
}

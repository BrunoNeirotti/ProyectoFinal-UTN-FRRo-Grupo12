'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import type { Momento } from '@/lib/bienestar';

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

function cantidad(datos: FormData): number | null {
  const crudo = texto(datos, 'cantidadKg').replace(',', '.');
  if (crudo === '') return null;
  const n = Number.parseFloat(crudo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Alta de un plan alimentario.
 *
 * Dar de alta es también la forma de cambiar la ración: `vigente_desde` deja la
 * anterior como historia en lugar de pisarla, para que un registro de cuidado
 * viejo siga diciendo lo que efectivamente se servía entonces.
 */
export async function crearPlan(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const caballoId = texto(datos, 'caballoId');
  try {
    const api = await llamador();
    await api.planAlimentario.crear({
      caballoId,
      momento: texto(datos, 'momento') as Momento,
      descripcion: texto(datos, 'descripcion'),
      cantidadKg: cantidad(datos),
      insumoId: texto(datos, 'insumoId') || null,
      vigenteDesde: texto(datos, 'vigenteDesde'),
    });

    revalidatePath(`/caballos/${caballoId}`);
    revalidatePath('/campo/alimentacion');
    revalidatePath('/campo/hoy');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo guardar el plan.' };
  }
}

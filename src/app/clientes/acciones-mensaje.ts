'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

export async function enviarMensaje(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const clienteId = String(datos.get('clienteId') ?? '');
  const variablesJson = String(datos.get('variables') ?? '{}');

  try {
    const api = await llamador();
    await api.mensaje.enviarIndividual({
      plantillaId: String(datos.get('plantillaId') ?? ''),
      clienteId,
      valores: JSON.parse(variablesJson),
    });
    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo enviar el mensaje.' };
  }
}

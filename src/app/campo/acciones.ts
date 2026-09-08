'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';

/**
 * Registrar una tanda de cuidados tiene un final que el `ResultadoDeGuardado`
 * común no sabe contar: cuántos entraron y cuántos ya estaban.
 *
 * «Ya estaba» no es un error ni una advertencia: es la idempotencia de la
 * decisión 1.6 funcionando. Si el peón toca guardar dos veces, o si M14
 * reintenta la cola, la segunda vuelta no duplica nada y el sistema lo dice en
 * lugar de fingir que registró el doble.
 */
export type ResultadoDeTanda =
  | { estado: 'inicial' }
  | { estado: 'ok'; registrados: number; repetidos: number }
  | { estado: 'error'; mensaje: string };

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

function numeroOpcional(datos: FormData, campo: string): number | null {
  const crudo = texto(datos, campo).replace(',', '.');
  if (crudo === '') return null;
  const n = Number.parseFloat(crudo);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Arma las filas a partir del formulario.
 *
 * Los campos vienen con el identificador de la fila en el nombre, así que la
 * lista de cuáles se marcaron viaja aparte en `filas`: sin ella habría que
 * adivinar qué claves del `FormData` son registros y cuáles no. Es el mismo
 * mecanismo que usa la planilla de asistencia.
 */
function filasDelFormulario(datos: FormData) {
  const ahora = new Date().toISOString();

  return texto(datos, 'filas')
    .split(',')
    .filter(Boolean)
    .filter((clave) => texto(datos, `hacer-${clave}`) === 'si')
    .map((clave) => ({
      // El identificador lo genera el dispositivo (decisión 1.6). Viaja en un
      // campo oculto que el formulario completó al dibujarse.
      id: texto(datos, `id-${clave}`),
      caballoId: texto(datos, `caballo-${clave}`) || null,
      instalacionId: texto(datos, `instalacion-${clave}`) || null,
      ocurridoEn: texto(datos, 'ocurridoEn') || ahora,
      registradoEn: ahora,
      observaciones: texto(datos, `obs-${clave}`) || undefined,
      insumoId: texto(datos, `insumo-${clave}`) || null,
      cantidad: numeroOpcional(datos, `cantidad-${clave}`),
    }));
}

function refrescarCampo() {
  revalidatePath('/campo/hoy');
  revalidatePath('/campo/alimentacion');
  revalidatePath('/campo/higiene');
  revalidatePath('/sanidad');
}

export async function registrarAlimentacion(
  _previo: ResultadoDeTanda,
  datos: FormData,
): Promise<ResultadoDeTanda> {
  const registros = filasDelFormulario(datos);
  if (registros.length === 0) {
    return { estado: 'error', mensaje: 'No hay ningún caballo marcado.' };
  }

  try {
    const sinCaballo = registros.some((r) => r.caballoId === null);
    if (sinCaballo) return { estado: 'error', mensaje: 'Hay una fila sin caballo.' };

    const api = await llamador();
    const r = await api.registroCuidado.registrarAlimentacion({
      registros: registros.map((fila) => ({ ...fila, caballoId: fila.caballoId! })),
    });
    refrescarCampo();
    return { estado: 'ok', registrados: r.registrados, repetidos: r.repetidos };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la alimentación.' };
  }
}

export async function registrarHigiene(
  _previo: ResultadoDeTanda,
  datos: FormData,
): Promise<ResultadoDeTanda> {
  const registros = filasDelFormulario(datos);
  if (registros.length === 0) {
    return { estado: 'error', mensaje: 'No hay ningún box marcado.' };
  }

  // El box desocupado se registra contra la instalación solamente (CUS03,
  // camino 2.a): el caballo va nulo y la instalación es la que no puede faltar.
  const conInstalacion = registros.filter((r) => r.instalacionId !== null);
  if (conInstalacion.length !== registros.length) {
    return { estado: 'error', mensaje: 'Hay un box sin identificar en la planilla.' };
  }

  try {
    const api = await llamador();
    const r = await api.registroCuidado.registrarHigiene({
      registros: conInstalacion.map((fila) => ({ ...fila, instalacionId: fila.instalacionId! })),
    });

    refrescarCampo();
    return { estado: 'ok', registrados: r.registrados, repetidos: r.repetidos };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar la higiene.' };
  }
}

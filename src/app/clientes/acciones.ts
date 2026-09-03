'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';

function opcional(datos: FormData, clave: string): string | undefined {
  const v = String(datos.get(clave) ?? '').trim();
  return v === '' ? undefined : v;
}

/**
 * Alta de cliente. Si sale bien, redirige a la ficha en lugar de devolver un
 * resultado: no tiene sentido dejar a alguien parado en un formulario vacío
 * después de crear el registro que quería crear.
 */
export async function crearCliente(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const tipo = String(datos.get('tipo') ?? '');
  const comunes = {
    requiereFactura: datos.get('requiereFactura') === 'true',
    cuit: opcional(datos, 'cuit'),
    condicionIva: opcional(datos, 'condicionIva') as
      | 'responsable_inscripto'
      | 'monotributo'
      | 'consumidor_final'
      | 'exento'
      | undefined,
    canalPreferido: (opcional(datos, 'canalPreferido') ?? 'whatsapp') as 'whatsapp' | 'email',
    diaVencimiento: opcional(datos, 'diaVencimiento')
      ? Number(datos.get('diaVencimiento'))
      : undefined,
  };

  let clienteId: string;
  try {
    const api = await llamador();
    const resultado =
      tipo === 'persona_juridica'
        ? await api.cliente.crear({
            tipo: 'persona_juridica',
            razonSocial: String(datos.get('razonSocial') ?? ''),
            ...comunes,
          })
        : await api.cliente.crear({
            tipo: 'persona_fisica',
            persona: {
              nombre: String(datos.get('nombre') ?? ''),
              apellido: String(datos.get('apellido') ?? ''),
              tipoDocumento: String(datos.get('tipoDocumento') ?? 'dni') as
                | 'dni'
                | 'cuit'
                | 'cuil'
                | 'pasaporte',
              numeroDocumento: String(datos.get('numeroDocumento') ?? ''),
              telefono: opcional(datos, 'telefono'),
              email: opcional(datos, 'email'),
              domicilio: opcional(datos, 'domicilio'),
            },
            ...comunes,
          });
    clienteId = resultado.clienteId;
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo dar de alta el cliente.' };
  }

  revalidatePath('/clientes');
  redirect(`/clientes/${clienteId}`);
}

export async function modificarCliente(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const clienteId = String(datos.get('clienteId') ?? '');
    await api.cliente.modificar({
      clienteId,
      razonSocial: opcional(datos, 'razonSocial'),
      requiereFactura: datos.get('requiereFactura') === 'true',
      cuit: opcional(datos, 'cuit'),
      condicionIva: opcional(datos, 'condicionIva') as
        | 'responsable_inscripto'
        | 'monotributo'
        | 'consumidor_final'
        | 'exento'
        | undefined,
      canalPreferido: (opcional(datos, 'canalPreferido') ?? 'whatsapp') as 'whatsapp' | 'email',
      diaVencimiento: opcional(datos, 'diaVencimiento')
        ? Number(datos.get('diaVencimiento'))
        : undefined,
    });
    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo modificar el cliente.' };
  }
}

export async function desactivarCliente(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const clienteId = String(datos.get('clienteId') ?? '');
    await api.cliente.desactivar({ clienteId });
    revalidatePath(`/clientes/${clienteId}`);
    revalidatePath('/clientes');
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo desactivar el cliente.' };
  }
}

export async function registrarConsentimiento(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const clienteId = String(datos.get('clienteId') ?? '');
    await api.cliente.registrarConsentimiento({
      clienteId,
      medio: String(datos.get('medio') ?? ''),
    });
    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo registrar el consentimiento.' };
  }
}

export async function revocarConsentimiento(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const clienteId = String(datos.get('clienteId') ?? '');
    await api.cliente.revocarConsentimiento({ clienteId });
    revalidatePath(`/clientes/${clienteId}`);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudo revocar el consentimiento.' };
  }
}

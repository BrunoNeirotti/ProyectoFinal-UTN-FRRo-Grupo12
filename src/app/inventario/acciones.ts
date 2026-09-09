'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import type { CategoriaInsumo } from '@/lib/inventario';

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? '').trim();
}

/** Los decimales llegan con coma de un teclado en español. */
function numero(datos: FormData, campo: string): number {
  return Number(texto(datos, campo).replace(',', '.'));
}

function refrescar(ordenId?: string) {
  revalidatePath('/inventario');
  revalidatePath('/inventario/proveedores');
  if (ordenId) revalidatePath(`/inventario/ordenes/${ordenId}`);
}

function fallar(e: unknown, porDefecto: string): ResultadoDeGuardado {
  if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
  return { estado: 'error', mensaje: porDefecto };
}

// --- Insumos ---------------------------------------------------------------

export async function crearInsumo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.insumo.crear({
      nombre: texto(datos, 'nombre'),
      categoria: texto(datos, 'categoria') as CategoriaInsumo,
      unidad: texto(datos, 'unidad'),
      stockMinimo: numero(datos, 'stockMinimo'),
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo crear el insumo.');
  }
}

export async function editarInsumo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.insumo.editar({
      insumoId: texto(datos, 'insumoId'),
      nombre: texto(datos, 'nombre'),
      categoria: texto(datos, 'categoria') as CategoriaInsumo,
      unidad: texto(datos, 'unidad'),
      stockMinimo: numero(datos, 'stockMinimo'),
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo guardar el insumo.');
  }
}

/**
 * Conteo físico.
 *
 * Devuelve `guardados: 0` cuando el conteo coincidió con lo registrado. No es
 * un fracaso ni un error: es el resultado que uno quiere, y decirlo importa
 * porque de lo contrario la pantalla informaría un ajuste que no ocurrió.
 */
export async function ajustarInsumo(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    const r = await api.insumo.ajustar({
      insumoId: texto(datos, 'insumoId'),
      contado: numero(datos, 'contado'),
      motivo: texto(datos, 'motivo'),
    });
    refrescar();
    return { estado: 'ok', guardados: r.ajustado ? 1 : 0 };
  } catch (e) {
    return fallar(e, 'No se pudo registrar el ajuste.');
  }
}

// --- Proveedores -----------------------------------------------------------

export async function crearProveedor(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.proveedor.crear({
      razonSocial: texto(datos, 'razonSocial'),
      cuit: texto(datos, 'cuit'),
      telefono: texto(datos, 'telefono'),
      email: texto(datos, 'email'),
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo crear el proveedor.');
  }
}

export async function editarProveedor(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.proveedor.editar({
      proveedorId: texto(datos, 'proveedorId'),
      razonSocial: texto(datos, 'razonSocial'),
      cuit: texto(datos, 'cuit'),
      telefono: texto(datos, 'telefono'),
      email: texto(datos, 'email'),
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo guardar el proveedor.');
  }
}

export async function alternarProveedor(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.proveedor.desactivar({
      proveedorId: texto(datos, 'proveedorId'),
      activo: texto(datos, 'activo') === 'true',
    });
    refrescar();
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo cambiar el proveedor.');
  }
}

// --- Órdenes de compra -----------------------------------------------------

/**
 * Crea la orden y lleva a su ficha.
 *
 * El `redirect` va afuera del `try`: Next lo implementa lanzando una excepción,
 * así que atraparlo acá convertiría una navegación exitosa en «no se pudo crear
 * la orden» con la orden ya creada.
 */
export async function crearOrden(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  let destino: string;

  try {
    const api = await llamador();
    const sugerir = texto(datos, 'sugerir') === 'true';
    const proveedorId = texto(datos, 'proveedorId');

    const orden = sugerir
      ? await api.ordenCompra.sugerida({ proveedorId })
      : await api.ordenCompra.crear({ proveedorId });

    destino = `/inventario/ordenes/${orden.id}`;
  } catch (e) {
    return fallar(e, 'No se pudo crear la orden.');
  }

  refrescar();
  redirect(destino);
}

export async function guardarRenglon(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const ordenId = texto(datos, 'ordenId');
  try {
    const api = await llamador();
    await api.ordenCompra.guardarRenglon({
      ordenId,
      insumoId: texto(datos, 'insumoId'),
      cantidad: numero(datos, 'cantidad'),
      precioUnitario: numero(datos, 'precioUnitario'),
    });
    refrescar(ordenId);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo guardar el renglón.');
  }
}

export async function quitarRenglon(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.ordenCompra.quitarRenglon({ detalleId: texto(datos, 'detalleId') });
    refrescar(texto(datos, 'ordenId'));
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo quitar el renglón.');
  }
}

export async function enviarOrden(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const ordenId = texto(datos, 'ordenId');
  try {
    const api = await llamador();
    await api.ordenCompra.enviar({ ordenId });
    refrescar(ordenId);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo enviar la orden.');
  }
}

/**
 * Borra un borrador y vuelve al panel.
 *
 * El `redirect` va afuera del `try` por lo mismo que en `crearOrden`: quedarse
 * en la ficha de una orden que ya no existe daría un 404 después de una
 * operación que salió bien.
 */
export async function eliminarBorrador(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  try {
    const api = await llamador();
    await api.ordenCompra.eliminarBorrador({ ordenId: texto(datos, 'ordenId') });
  } catch (e) {
    return fallar(e, 'No se pudo borrar el borrador.');
  }

  refrescar();
  redirect('/inventario');
}

export async function anularOrden(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const ordenId = texto(datos, 'ordenId');
  try {
    const api = await llamador();
    await api.ordenCompra.anular({ ordenId });
    refrescar(ordenId);
    return { estado: 'ok', guardados: 1 };
  } catch (e) {
    return fallar(e, 'No se pudo anular la orden.');
  }
}

/**
 * Registra una entrega.
 *
 * Los renglones llegan como un campo por detalle (`recibido-<id>`) y sólo entran
 * los que traen un número mayor que cero: en una entrega parcial el operador
 * completa dos casilleros de seis y deja el resto vacíos, que es como llega el
 * remito. Mandar los vacíos como cero haría fallar la validación por algo que el
 * usuario hizo bien.
 */
export async function recibirEntrega(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const ordenId = texto(datos, 'ordenId');

  const renglones = [...datos.entries()]
    .filter(([campo]) => campo.startsWith('recibido-'))
    .map(([campo, valor]) => ({
      detalleId: campo.slice('recibido-'.length),
      cantidad: Number(String(valor).trim().replace(',', '.')),
    }))
    .filter((r) => Number.isFinite(r.cantidad) && r.cantidad > 0);

  if (renglones.length === 0) {
    return { estado: 'error', mensaje: 'Hay que informar al menos un renglón recibido.' };
  }

  const fecha = texto(datos, 'fecha');

  try {
    const api = await llamador();
    const r = await api.ordenCompra.recibir({
      ordenId,
      // La fecha del remito, no la del momento en que se carga: son distintas
      // cuando la entrega de ayer se anota hoy, y el ingreso tiene que quedar
      // en el día en que la mercadería entró al depósito.
      ocurridoEn: fecha ? new Date(`${fecha}T12:00:00-03:00`).toISOString() : undefined,
      renglones,
    });
    refrescar(ordenId);
    return { estado: 'ok', guardados: r.recibidos };
  } catch (e) {
    return fallar(e, 'No se pudo registrar la entrega.');
  }
}

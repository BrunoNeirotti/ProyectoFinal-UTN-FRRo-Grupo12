'use server';

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { CLAVES, CATALOGO, type Clave, type ValorParametro } from '@/lib/parametros';
import { llamador } from '@/lib/trpc/servidor';
import type { ResultadoDeGuardado } from '@/lib/formularios';


/**
 * Acción de servidor del formulario de reglas.
 *
 * No valida por su cuenta: arma el pedido y se lo pasa al mismo procedimiento
 * tRPC que usaría el navegador. Toda la validación, la de cada clave y la del
 * conjunto, vive en un solo lugar. Duplicarla acá sería garantizar que algún día
 * las dos versiones digan cosas distintas.
 */

export async function guardarReglas(
  _previo: ResultadoDeGuardado,
  datos: FormData,
): Promise<ResultadoDeGuardado> {
  const cambios: { clave: Clave; valor: ValorParametro }[] = [];

  for (const clave of CLAVES) {
    if (!datos.has(clave)) continue;
    const crudo = String(datos.get(clave) ?? '').trim();
    const { tipo } = CATALOGO[clave];

    let valor: ValorParametro;
    if (crudo === '') {
      valor = null;
    } else if (tipo === 'entero') {
      valor = Number.parseInt(crudo, 10);
    } else if (tipo === 'decimal') {
      valor = Number.parseFloat(crudo.replace(',', '.'));
    } else if (tipo === 'booleano') {
      valor = crudo === 'true' || crudo === 'on';
    } else {
      valor = crudo;
    }

    // Un campo numérico con letras llega como NaN. Se manda como nulo para que
    // la validación lo rechace con su mensaje, en vez de guardar un disparate.
    if (typeof valor === 'number' && Number.isNaN(valor)) valor = null;

    cambios.push({ clave, valor });
  }

  if (cambios.length === 0) return { estado: 'error', mensaje: 'No se recibió ningún cambio.' };

  try {
    const api = await llamador();
    const { guardados } = await api.parametro.guardar({ cambios });
    revalidatePath('/configuracion');
    return { estado: 'ok', guardados };
  } catch (e) {
    if (e instanceof TRPCError) return { estado: 'error', mensaje: e.message };
    return { estado: 'error', mensaje: 'No se pudieron guardar los cambios.' };
  }
}

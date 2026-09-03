/**
 * Reglas de negocio del alta de cliente que cruzan más de un campo, y por eso no
 * se pueden expresar en un solo `.regex()` de Zod.
 *
 * RN-05 / RN-06: sólo ~30 % de los clientes pide factura, y el CUIT y la
 * condición de IVA sólo son obligatorios para ese subconjunto. Exigirlos
 * siempre trabaría el alta del 70 % que nunca factura; no exigirlos nunca haría
 * fallar la emisión en el peor momento, con el operador esperando el CAE. La
 * restricción `cliente_datos_fiscales` de la base es la que manda; esto es la
 * misma regla, aplicada antes, para devolver un mensaje por campo.
 */

export interface DatosFiscales {
  requiereFactura: boolean;
  cuit: string | null;
  condicionIva: string | null;
}

export type ValidacionFiscal = { valido: true } | { valido: false; motivo: string };

export function validarDatosFiscales(d: DatosFiscales): ValidacionFiscal {
  if (!d.requiereFactura) return { valido: true };

  if (!d.cuit) {
    return { valido: false, motivo: 'Pide factura: hace falta el CUIT.' };
  }
  if (!d.condicionIva) {
    return { valido: false, motivo: 'Pide factura: hace falta la condición frente al IVA.' };
  }
  return { valido: true };
}

/** RN-08: sin día pactado, rige el valor por omisión del parámetro global. */
export function diaDeVencimientoEfectivo(
  diaPactado: number | null,
  diaPorDefecto: number,
): number {
  return diaPactado ?? diaPorDefecto;
}

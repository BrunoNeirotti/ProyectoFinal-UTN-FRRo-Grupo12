/**
 * Selección de la tarifa vigente (decisión 1.4 del modelo de datos).
 *
 * El precio de un servicio en una fecha es el de la tarifa con `vigente_desde`
 * más reciente que no sea posterior a esa fecha. Separada del router para poder
 * probarla sin tocar la base: es el cálculo que decide cuánto se factura.
 */

export interface TarifaVigente {
  importe: number;
  vigenteDesde: string; // ISO yyyy-mm-dd
}

export function tarifaVigenteEn(
  tarifas: readonly TarifaVigente[],
  fecha: Date = new Date(),
): TarifaVigente | null {
  const corte = fecha.toISOString().slice(0, 10);

  const aplicables = tarifas
    .filter((t) => t.vigenteDesde <= corte)
    .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1));

  return aplicables[0] ?? null;
}

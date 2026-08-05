/**
 * Cálculo del interés por mora (RN-09).
 *
 * El haras cobra mora, la calcula como un porcentaje y la aplica a criterio. El
 * sistema **calcula y propone**; una persona **confirma**. Esta función es la
 * mitad que calcula, y está separada de todo lo demás para poder probarla:
 * es la clase de cuenta que, si está mal, factura de más durante meses sin que
 * nadie lo note.
 *
 * Tres reglas que no son detalles de implementación sino decisiones de negocio:
 *
 *   - **Sin tasa configurada no hay propuesta.** `mora_tasa_mensual` queda vacío
 *     a propósito hasta que el dueño lo defina. Devolver cero sería peor que
 *     devolver nada: se confunde con «no debe intereses».
 *   - **No capitaliza.** La base excluye los movimientos de tipo interés, así
 *     que el interés no genera interés. La base la calcula la función
 *     `base_de_mora` de la migración 0003, del lado del servidor.
 *   - **Prorrateo diario sobre treinta**, no sobre los días del mes: es como lo
 *     viene calculando el haras.
 */

export type PropuestaDeMora =
  | { aplica: false; motivo: 'sin_tasa' | 'sin_atraso' | 'sin_saldo' }
  | {
      aplica: true;
      base: number;
      tasaMensual: number;
      dias: number;
      importe: number;
    };

export interface DatosDeMora {
  /** Saldo vencido, ya sin los intereses de períodos anteriores. */
  base: number;
  /** Tasa nominal mensual en porcentaje. `null` mientras el dueño no la defina. */
  tasaMensual: number | null;
  /** Días de atraso considerados. */
  dias: number;
}

/** Redondeo a dos decimales, que es la precisión de `numeric(12,2)`. */
function aCentavos(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

export function calcularMora({ base, tasaMensual, dias }: DatosDeMora): PropuestaDeMora {
  if (tasaMensual === null || tasaMensual <= 0) return { aplica: false, motivo: 'sin_tasa' };
  if (dias <= 0) return { aplica: false, motivo: 'sin_atraso' };
  if (base <= 0) return { aplica: false, motivo: 'sin_saldo' };

  const importe = aCentavos((base * (tasaMensual / 100) * dias) / 30);
  return { aplica: true, base, tasaMensual, dias, importe };
}

/**
 * Días de atraso entre el vencimiento y la fecha de corte.
 *
 * El domingo no cuenta como día de cobranza (RN-10), pero sí como día de atraso:
 * el interés corre por el tiempo transcurrido, no por los días hábiles. Lo que
 * el sábado hábil define es cuándo salen los avisos, que es otra cosa.
 */
export function diasDeAtraso(venceEn: Date, alDia: Date): number {
  const MS_POR_DIA = 86_400_000;
  const vence = Date.UTC(venceEn.getUTCFullYear(), venceEn.getUTCMonth(), venceEn.getUTCDate());
  const corte = Date.UTC(alDia.getUTCFullYear(), alDia.getUTCMonth(), alDia.getUTCDate());
  return Math.max(0, Math.round((corte - vence) / MS_POR_DIA));
}

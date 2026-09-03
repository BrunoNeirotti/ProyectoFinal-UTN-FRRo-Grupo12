/**
 * M3 · Cuentas corrientes y cobranza.
 *
 * Cálculos que no dependen de la base y por eso se prueban solos. El cálculo
 * de mora vive en `mora.ts`; acá va lo que hace falta para generar los
 * cargos del período (CUS01) y para leer el estado de una cartera.
 */

/**
 * Fecha de vencimiento dentro del mes del período.
 *
 * `dia_vencimiento` está acotado a 1-28 tanto en `cliente` como en el
 * catálogo de parámetros, así que no hace falta acomodar meses cortos.
 */
export function fechaDeVencimiento(periodo: Date, diaVencimiento: number): Date {
  return new Date(Date.UTC(periodo.getUTCFullYear(), periodo.getUTCMonth(), diaVencimiento));
}

/**
 * Trunca al día, en UTC. Comparar contra `new Date()` directo hace que algo
 * que vence "hoy" ya cuente como vencido apenas pasa la medianoche, según a
 * qué hora del día se mire — acá vencer hoy todavía no es estar vencido.
 */
export function comienzoDelDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/** Primer día del mes de una fecha, en UTC. Es la forma en que se guarda `periodo`. */
export function primerDiaDelMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

export type EstadoCartera = 'al_dia' | 'proximo_a_vencer' | 'vencido';

/**
 * Clasifica una cuenta para el semáforo de cobranza.
 *
 * `diasAviso` es RN-11: el aviso previo sale unos días antes del vencimiento,
 * y ese es el mismo umbral con el que la pantalla decide mostrar "por vencer"
 * en lugar de "al día".
 */
export function clasificarEstadoCartera(
  saldo: number,
  proximoVencimiento: Date | null,
  hoy: Date,
  diasAviso: number,
): EstadoCartera {
  if (saldo <= 0 || !proximoVencimiento) return 'al_dia';
  if (proximoVencimiento < hoy) return 'vencido';

  const MS_POR_DIA = 86_400_000;
  const dias = Math.round((proximoVencimiento.getTime() - hoy.getTime()) / MS_POR_DIA);
  return dias <= diasAviso ? 'proximo_a_vencer' : 'al_dia';
}

export interface MovimientoVencido {
  importe: number;
  venceEn: string; // ISO yyyy-mm-dd
}

/**
 * Asigna los pagos y ajustes negativos contra la deuda más vieja primero
 * (FIFO), para poder decir qué parte de lo que se debe sigue vencida y desde
 * cuándo.
 *
 * `cuenta_corriente.saldo` es un total (decisión 1.5): el modelo no empareja
 * un pago con el cargo que salda, a propósito, para no reintroducir la
 * factura como unidad. Este emparejamiento es sólo para el reporte de
 * antigüedad — no escribe nada — y usa el criterio contable habitual de
 * imputar contra lo más antiguo primero.
 */
export interface MovimientoParaAntiguedad {
  tipo: 'cargo' | 'pago' | 'ajuste' | 'interes_mora';
  importe: number; // con el signo real de `movimiento_cuenta`
  venceEn: string | null;
  ocurridoEn: string; // ISO, para ordenar cronológicamente
}

export function saldosPendientesFifo(movimientos: MovimientoParaAntiguedad[]): MovimientoVencido[] {
  const cola: { importe: number; venceEn: string }[] = [];

  const ordenados = [...movimientos].sort((a, b) => a.ocurridoEn.localeCompare(b.ocurridoEn));

  for (const m of ordenados) {
    const esDeuda = (m.tipo === 'cargo' || m.tipo === 'interes_mora' || (m.tipo === 'ajuste' && m.importe > 0)) && m.venceEn;

    if (esDeuda && m.venceEn) {
      cola.push({ importe: m.importe, venceEn: m.venceEn });
      continue;
    }

    // Pago, o ajuste negativo (nota de crédito): se imputa contra lo más viejo.
    if (m.importe < 0) {
      let restante = -m.importe;
      while (restante > 0 && cola.length > 0) {
        const primero = cola[0]!;
        const usado = Math.min(primero.importe, restante);
        primero.importe -= usado;
        restante -= usado;
        if (primero.importe <= 0.005) cola.shift();
      }
    }
  }

  return cola.filter((c) => c.importe > 0.005);
}

export interface BucketsAntiguedad {
  corriente: number;
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  dias_90_mas: number;
}

/**
 * Antigüedad de la deuda: cuánto de lo vencido cayó en cada tramo de 30 días.
 * Lo que todavía no venció (o no tiene vencimiento) va a `corriente`.
 */
export function bucketsDeAntiguedad(movimientos: MovimientoVencido[], hoy: Date): BucketsAntiguedad {
  const MS_POR_DIA = 86_400_000;
  const buckets: BucketsAntiguedad = {
    corriente: 0,
    dias_1_30: 0,
    dias_31_60: 0,
    dias_61_90: 0,
    dias_90_mas: 0,
  };

  for (const m of movimientos) {
    const vence = new Date(`${m.venceEn}T00:00:00Z`);
    const diasVencido = Math.floor((hoy.getTime() - vence.getTime()) / MS_POR_DIA);

    if (diasVencido <= 0) buckets.corriente += m.importe;
    else if (diasVencido <= 30) buckets.dias_1_30 += m.importe;
    else if (diasVencido <= 60) buckets.dias_31_60 += m.importe;
    else if (diasVencido <= 90) buckets.dias_61_90 += m.importe;
    else buckets.dias_90_mas += m.importe;
  }

  return buckets;
}

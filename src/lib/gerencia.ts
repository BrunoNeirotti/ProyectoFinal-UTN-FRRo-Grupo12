/**
 * M11 · Tablero de gerencia (Inicio, Reportes y CUS07 «Elaborar el Presupuesto
 * Mensual»).
 *
 * El módulo no tiene entidades propias (ver `03-modelo-de-datos.md`): todo acá
 * es cálculo sobre datos que ya viven en contratos, tarifas, movimientos de
 * cuenta corriente, órdenes de compra e insumos. Por eso, igual que en M3 y
 * M10, la aritmética se separa del router para poder probarla sin la base.
 *
 * El presupuesto en particular (CUS07) declara por escrito que **no se
 * persiste**: se recompone en cada consulta a partir de las mismas fuentes, así
 * que no puede quedar desactualizado. La simulación de una variación de precio
 * corre con las mismas funciones puras, tanto en el servidor como en el
 * cliente, precisamente porque no toca la base.
 */

import { pendienteDeRecibir } from './inventario';

/** Variación porcentual entre dos totales. `null` cuando no hay base de comparación. */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}

export interface Ocupacion {
  ocupados: number;
  total: number;
  porcentaje: number;
}

/** Cuántas instalaciones de un tipo (boxes) tienen al menos un caballo activo. */
export function ocupacionDe(instalacionesOcupadasIds: ReadonlySet<string>, totalInstalaciones: number): Ocupacion {
  const ocupados = Math.min(instalacionesOcupadasIds.size, totalInstalaciones);
  return {
    ocupados,
    total: totalInstalaciones,
    porcentaje: totalInstalaciones > 0 ? (ocupados / totalInstalaciones) * 100 : 0,
  };
}

// -----------------------------------------------------------------------------
// CUS07 · Paso 2: ingresos recurrentes previstos
// -----------------------------------------------------------------------------

export interface ContratoResuelto {
  contratoId: string;
  servicioId: string;
  servicioNombre: string;
  /** `null` cuando el contrato no tiene tarifa vigente ni importe pactado (2.a). */
  importe: number | null;
  /** El importe viene del contrato, no de la tarifa del servicio: no lo toca una simulación. */
  esPactado: boolean;
}

export interface ProyeccionIngresos {
  proyectado: number;
  porServicio: { servicioId: string; servicioNombre: string; importe: number }[];
  excluidos: { contratoId: string; servicioNombre: string }[];
}

export function proyectarIngresos(contratos: readonly ContratoResuelto[]): ProyeccionIngresos {
  const porServicio = new Map<string, { nombre: string; importe: number }>();
  const excluidos: ProyeccionIngresos['excluidos'] = [];
  let proyectado = 0;

  for (const c of contratos) {
    if (c.importe === null) {
      excluidos.push({ contratoId: c.contratoId, servicioNombre: c.servicioNombre });
      continue;
    }
    proyectado += c.importe;
    const acumulado = porServicio.get(c.servicioId) ?? { nombre: c.servicioNombre, importe: 0 };
    acumulado.importe += c.importe;
    porServicio.set(c.servicioId, acumulado);
  }

  return {
    proyectado,
    porServicio: [...porServicio.entries()]
      .map(([servicioId, v]) => ({ servicioId, servicioNombre: v.nombre, importe: v.importe }))
      .sort((a, b) => b.importe - a.importe),
    excluidos,
  };
}

/**
 * CUS07, pasos 6-7: el efecto de variar el precio de uno o varios servicios,
 * sin alterar ninguna tarifa. Un contrato con importe pactado no se mueve: lo
 * que pactó el cliente es independiente de la tarifa publicada del servicio.
 */
export function simularVariacion(
  contratos: readonly ContratoResuelto[],
  variacionPorServicio: ReadonlyMap<string, number>, // fracción: 0.1 = +10 %
): ProyeccionIngresos {
  const ajustados = contratos.map((c) => {
    if (c.importe === null || c.esPactado) return c;
    const variacion = variacionPorServicio.get(c.servicioId);
    if (!variacion) return c;
    return { ...c, importe: c.importe * (1 + variacion) };
  });
  return proyectarIngresos(ajustados);
}

// -----------------------------------------------------------------------------
// CUS07 · Paso 4: egresos previstos
// -----------------------------------------------------------------------------

/** Lo que falta pagar de las órdenes todavía no recibidas del todo. */
export function egresoPendienteDeOrdenes(
  detalles: readonly { cantidad: number; cantidadRecibida: number | null; precioUnitario: number }[],
): number {
  return detalles.reduce((suma, d) => suma + pendienteDeRecibir(d) * d.precioUnitario, 0);
}

export interface InsumoParaProyeccion {
  insumoId: string;
  consumoDiario: number;
  /** Último precio de compra conocido. `null` si nunca se compró: no hay con qué costear. */
  precioUnitario: number | null;
}

/** Consumo proyectado de insumos, al último precio de compra de cada uno. */
export function egresoProyectadoDeInsumos(insumos: readonly InsumoParaProyeccion[], diasDelPeriodo: number): number {
  return insumos.reduce((suma, i) => suma + (i.precioUnitario ?? 0) * i.consumoDiario * diasDelPeriodo, 0);
}

/** Promedio mensual de costos sanitarios aplicados en la ventana histórica. */
export function costoSanitarioMensualPromedio(costos: readonly number[], mesesDeVentana: number): number {
  if (mesesDeVentana <= 0) return 0;
  return costos.reduce((suma, c) => suma + c, 0) / mesesDeVentana;
}

// -----------------------------------------------------------------------------
// CUS07 · Paso 5: resultado proyectado, con apertura por concepto
// -----------------------------------------------------------------------------

export interface AperturaDeEgresos {
  ordenesCompra: number;
  insumos: number;
  sanidad: number;
}

export interface ResultadoProyectado {
  ingresos: number;
  egresos: AperturaDeEgresos & { total: number };
  resultado: number;
}

export function resultadoProyectado(ingresos: number, egresos: AperturaDeEgresos): ResultadoProyectado {
  const total = egresos.ordenesCompra + egresos.insumos + egresos.sanidad;
  return {
    ingresos,
    egresos: { ...egresos, total },
    resultado: ingresos - total,
  };
}

/**
 * M8 · Asistencia y progreso.
 *
 * Todo lo que este módulo informa es **derivado**: no hay una columna que diga
 * el porcentaje de un alumno ni una que lo marque en riesgo. Se cuentan filas de
 * `asistencia` y se divide. La razón está escrita en el prototipo y conviene
 * repetirla acá: un indicador guardado obliga a un proceso que lo recalcule, y
 * el día que ese proceso falla la pantalla sigue mostrando un número viejo con
 * toda confianza. Contar es barato; explicar un dato desactualizado, no.
 *
 * La segunda propiedad que sostiene el módulo entero es de la base, no de acá:
 * **una fila de asistencia sólo existe si hubo inscripción activa** (migración
 * `…_m8_asistencia.sql`). De ahí salen dos cosas gratis:
 *
 *   * el denominador de cada alumno es «las clases en las que estaba anotado y
 *     efectivamente se dictaron», sin tener que cruzar la agenda; y
 *   * `presente = false` es exactamente la ausencia SIN AVISO, porque quien
 *     canceló su inscripción no llega a tener fila. Es el número que el haras
 *     factura igual, así que importa que no se mezcle con el resto.
 */

import { ZONA_HARAS, instanteDesdeLocal, partesLocales } from './agenda';

/** Cuántos meses hacia atrás forman el promedio contra el que se mide la caída. */
export const MESES_DE_REFERENCIA = 3;

/** Una fila de asistencia reducida a lo que los cálculos necesitan. */
export interface AsistenciaComputable {
  alumnoId: string;
  /** `yyyy-mm` del mes en que se dictó la clase, en hora del haras. */
  periodo: string;
  presente: boolean;
}

// -----------------------------------------------------------------------------
// Períodos
//
// El período es `yyyy-mm` y no un par de fechas porque es lo que el usuario
// elige y lo que viaja en la URL. La conversión a instantes pasa por
// `instanteDesdeLocal`, que es la que conoce la zona: un mes que empezara a las
// 00:00 UTC se llevaría puestas las tres primeras horas del día 1 en Funes.
// -----------------------------------------------------------------------------

const PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;

function numerosDePeriodo(periodo: string): { anio: number; mes: number } {
  const partes = PERIODO.exec(periodo);
  if (!partes?.[1] || !partes[2]) {
    throw new RangeError(`Período inválido: ${periodo}. Se espera yyyy-mm.`);
  }
  return { anio: Number(partes[1]), mes: Number(partes[2]) };
}

function comoPeriodo(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/** El mes al que pertenece un instante, en hora del haras. */
export function periodoDe(instante: Date | string, zona: string = ZONA_HARAS): string {
  return partesLocales(instante, zona).fecha.slice(0, 7);
}

/** Corre un período hacia atrás o hacia adelante. */
export function periodoCorrido(periodo: string, meses: number): string {
  const { anio, mes } = numerosDePeriodo(periodo);
  const total = anio * 12 + (mes - 1) + meses;
  return comoPeriodo(Math.floor(total / 12), (total % 12) + 1);
}

/** Los `cantidad` meses inmediatamente anteriores, del más viejo al más reciente. */
export function periodosAnteriores(periodo: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => periodoCorrido(periodo, i - cantidad));
}

/** Instantes que delimitan el mes: `[desde, hasta)`, igual que los rangos de la base. */
export function rangoDelPeriodo(
  periodo: string,
  zona: string = ZONA_HARAS,
): { desde: Date; hasta: Date } {
  const { anio, mes } = numerosDePeriodo(periodo);
  const proximo = numerosDePeriodo(periodoCorrido(periodo, 1));

  return {
    desde: instanteDesdeLocal(`${comoPeriodo(anio, mes)}-01`, '00:00', zona),
    hasta: instanteDesdeLocal(`${comoPeriodo(proximo.anio, proximo.mes)}-01`, '00:00', zona),
  };
}

/** «Mayo 2026», para los títulos. */
export function nombreDePeriodo(periodo: string): string {
  const { anio, mes } = numerosDePeriodo(periodo);
  const texto = new Date(Date.UTC(anio, mes - 1, 1)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// -----------------------------------------------------------------------------
// Conteos
// -----------------------------------------------------------------------------

export interface ConteoDeAsistencia {
  /** Clases dictadas en las que el alumno estaba inscripto. */
  dictadas: number;
  asistidas: number;
  /** Ausencias sin aviso: quien canceló no tiene fila (ver la cabecera). */
  ausencias: number;
  /** 0 a 100, o `null` si no hubo ninguna clase: sin denominador no hay porcentaje. */
  porcentaje: number | null;
}

const SIN_CLASES: ConteoDeAsistencia = { dictadas: 0, asistidas: 0, ausencias: 0, porcentaje: null };

export function contar(filas: readonly { presente: boolean }[]): ConteoDeAsistencia {
  if (filas.length === 0) return SIN_CLASES;

  const asistidas = filas.filter((f) => f.presente).length;
  return {
    dictadas: filas.length,
    asistidas,
    ausencias: filas.length - asistidas,
    porcentaje: (asistidas / filas.length) * 100,
  };
}

/** Un conteo por alumno, sobre las filas que se le pasen. */
export function contarPorAlumno(
  filas: readonly AsistenciaComputable[],
): Map<string, ConteoDeAsistencia> {
  const porAlumno = new Map<string, AsistenciaComputable[]>();
  for (const fila of filas) {
    const suyas = porAlumno.get(fila.alumnoId);
    if (suyas) suyas.push(fila);
    else porAlumno.set(fila.alumnoId, [fila]);
  }

  return new Map([...porAlumno].map(([alumnoId, suyas]) => [alumnoId, contar(suyas)]));
}

/** Un conteo por período, para dibujar la evolución de una serie. */
export function contarPorPeriodo(
  filas: readonly AsistenciaComputable[],
  periodos: readonly string[],
): Map<string, ConteoDeAsistencia> {
  return new Map(periodos.map((p) => [p, contar(filas.filter((f) => f.periodo === p))]));
}

// -----------------------------------------------------------------------------
// Alumnos en riesgo
// -----------------------------------------------------------------------------

export interface EvaluacionDeRiesgo {
  enRiesgo: boolean;
  /** Puntos de caída contra la referencia. Positivo = bajó. `null` si no se pudo comparar. */
  caida: number | null;
  /** Promedio de los meses anteriores con actividad. */
  referencia: number | null;
}

const SIN_COMPARACION: EvaluacionDeRiesgo = { enRiesgo: false, caida: null, referencia: null };

/**
 * Un alumno está en riesgo cuando su asistencia cayó más que el umbral respecto
 * del promedio de los meses anteriores.
 *
 * Tres decisiones que hacen que el aviso sirva:
 *
 *   * **Se compara contra un promedio de varios meses, no contra el mes
 *     pasado.** Un mes flojo lo tiene cualquiera; lo que anticipa una baja es la
 *     caída sostenida, y un solo mes de referencia convierte cualquier gripe en
 *     una alarma.
 *   * **Los meses sin clases no cuentan en el promedio.** Un alumno que no tuvo
 *     actividad en enero no bajó su asistencia en enero: no hay dato. Meterlo
 *     como cero marcaría en riesgo a todo el que vuelve de las vacaciones.
 *   * **Sin historial no hay riesgo.** El que empezó este mes no puede estar
 *     bajando. Se devuelve `caida: null` y no `false` a secas, para que la
 *     pantalla pueda decir «todavía no hay con qué compararlo» en vez de dar a
 *     entender que está bien.
 */
export function evaluarRiesgo(
  actual: number | null,
  anteriores: readonly (number | null)[],
  umbralPuntos: number,
): EvaluacionDeRiesgo {
  if (actual === null) return SIN_COMPARACION;

  const conActividad = anteriores.filter((p): p is number => p !== null);
  if (conActividad.length === 0) return SIN_COMPARACION;

  const referencia = conActividad.reduce((a, b) => a + b, 0) / conActividad.length;
  const caida = referencia - actual;

  return { enRiesgo: caida > umbralPuntos, caida, referencia };
}

// -----------------------------------------------------------------------------
// Carga de trabajo por caballo
// -----------------------------------------------------------------------------

export interface CargaDeCaballo {
  caballoId: string;
  nombre: string;
  /** Clases en las que el caballo se montó de verdad. */
  montadas: number;
  /** Veces que se lo había previsto al inscribir. */
  previstas: number;
}

/**
 * Cuánto trabajó cada caballo en el período.
 *
 * Se informan las dos cifras —lo previsto al programar y lo efectivamente
 * montado— porque la diferencia es el dato útil. El caballo que aparece mucho
 * más montado que previsto es el que se usa como reemplazo cuando otro no está
 * en condiciones (CUS05, camino 7.c), y esa sustitución repetida es exactamente
 * la sobrecarga que nadie registra hasta que el animal se resiente.
 *
 * Sólo cuentan las asistencias con presencia: el caballo del alumno que faltó no
 * trabajó.
 */
export function cargaPorCaballo(
  montadas: readonly { caballoId: string | null; nombre: string | null; presente: boolean }[],
  previstas: readonly { caballoId: string | null; nombre: string | null }[],
): CargaDeCaballo[] {
  const carga = new Map<string, CargaDeCaballo>();

  const asegurar = (caballoId: string, nombre: string | null) => {
    const actual = carga.get(caballoId) ?? {
      caballoId,
      nombre: nombre ?? 'Sin nombre',
      montadas: 0,
      previstas: 0,
    };
    carga.set(caballoId, actual);
    return actual;
  };

  for (const m of montadas) {
    if (!m.caballoId || !m.presente) continue;
    asegurar(m.caballoId, m.nombre).montadas += 1;
  }
  for (const p of previstas) {
    if (!p.caballoId) continue;
    asegurar(p.caballoId, p.nombre).previstas += 1;
  }

  return [...carga.values()].sort(
    (a, b) => b.montadas - a.montadas || a.nombre.localeCompare(b.nombre, 'es-AR'),
  );
}

// -----------------------------------------------------------------------------
// La planilla de una clase
// -----------------------------------------------------------------------------

export interface EstadoDePlanilla {
  inscriptos: number;
  registrados: number;
  presentes: number;
  ausentes: number;
  /** Hay una fila por cada inscripto: la clase se puede dar por dictada. */
  completa: boolean;
}

/**
 * Cuánto falta para poder cerrar la asistencia de una clase.
 *
 * El cierre es explícito y por eso hay que saber si la planilla está entera:
 * mientras falte alguien, la clase no se da por dictada y no entra en la
 * liquidación. Es la decisión del prototipo —«hasta cerrarla, la clase no se
 * factura»— y lo que evita cobrar una clase cargada a medias.
 */
export function estadoDePlanilla(
  inscriptos: readonly { alumnoId: string }[],
  registradas: readonly { alumnoId: string; presente: boolean }[],
): EstadoDePlanilla {
  const anotados = new Set(inscriptos.map((i) => i.alumnoId));
  const suyas = registradas.filter((r) => anotados.has(r.alumnoId));
  const presentes = suyas.filter((r) => r.presente).length;

  return {
    inscriptos: anotados.size,
    registrados: suyas.length,
    presentes,
    ausentes: suyas.length - presentes,
    completa: anotados.size > 0 && suyas.length === anotados.size,
  };
}

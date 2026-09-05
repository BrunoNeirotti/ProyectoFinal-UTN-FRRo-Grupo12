/**
 * M7 · Cálculos de la agenda de clases.
 *
 * Separado del router para poder probarlo sin base: es la primera vez en el
 * sistema que la **hora del día** importa. Hasta M6 todo era fecha sola
 * (períodos, vencimientos, fechas de emisión), y una fecha no tiene zona. Una
 * clase sí: empieza a las nueve de la mañana en Funes.
 *
 * El servidor corre en UTC (Vercel, región `gru1`). Si la grilla se armara con
 * la hora del proceso, la clase de las 09:00 aparecería a las 12:00 y caería en
 * el día equivocado cada vez que el horario cruce la medianoche. Por eso todo lo
 * que convierte entre instante y hora de pared pasa por `ZONA_HARAS` y por
 * `Intl`, que conoce las reglas de la zona; no se resta un desplazamiento fijo,
 * que es lo que se rompe el día que el país vuelve a mover los relojes.
 */

export const ZONA_HARAS = 'America/Argentina/Buenos_Aires';

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

/** Milisegundos que hay que sumarle a UTC para obtener la hora de pared de la zona. */
function desfaseDeZona(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);

  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);

  const comoSiFueraUtc = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );

  return comoSiFueraUtc - instante.getTime();
}

export interface PartesLocales {
  /** `yyyy-mm-dd` en la zona del haras. */
  fecha: string;
  /** `HH:MM` en la zona del haras. */
  hora: string;
  /** Hora en punto a la que pertenece la clase dentro de la grilla: `HH:00`. */
  franja: string;
  /** 0 = domingo, 1 = lunes, … 6 = sábado. */
  diaSemana: number;
}

export function partesLocales(instante: Date | string, zona: string = ZONA_HARAS): PartesLocales {
  const fechaHora = typeof instante === 'string' ? new Date(instante) : instante;
  const local = new Date(fechaHora.getTime() + desfaseDeZona(fechaHora, zona));

  const fecha = local.toISOString().slice(0, 10);
  const hora = local.toISOString().slice(11, 16);

  return {
    fecha,
    hora,
    franja: `${hora.slice(0, 2)}:00`,
    diaSemana: local.getUTCDay(),
  };
}

/**
 * Instante que corresponde a una hora de pared del haras.
 *
 * El formulario entrega lo que el instructor ve —«el jueves a las 16:30»— y la
 * base guarda instantes. La conversión se hace en dos pasos porque el
 * desplazamiento de la zona depende del instante que se está calculando: se
 * estima, se mide el desplazamiento real ahí y se corrige.
 */
export function instanteDesdeLocal(fecha: string, hora: string, zona: string = ZONA_HARAS): Date {
  const { anio, mes, dia } = numerosDeFecha(fecha);
  const { hh, mm } = numerosDeHora(hora);

  const tentativo = Date.UTC(anio, mes - 1, dia, hh, mm);
  const desfase = desfaseDeZona(new Date(tentativo), zona);
  return new Date(tentativo - desfase);
}

/**
 * Parte `yyyy-mm-dd` y `HH:MM` en números, validando.
 *
 * No es celo de tipos: una fecha a medio armar no falla al convertirse, da una
 * clase agendada en otro siglo. Vale más cortar acá que guardarla.
 */
function numerosDeFecha(fecha: string): { anio: number; mes: number; dia: number } {
  const partes = fecha.split('-').map(Number);
  const [anio, mes, dia] = partes;

  if (partes.length !== 3 || anio === undefined || mes === undefined || dia === undefined) {
    throw new RangeError(`Fecha inválida: ${fecha}. Se espera yyyy-mm-dd.`);
  }
  return { anio, mes, dia };
}

function numerosDeHora(hora: string): { hh: number; mm: number } {
  const partes = hora.split(':').map(Number);
  const [hh, mm] = partes;

  if (partes.length !== 2 || hh === undefined || mm === undefined) {
    throw new RangeError(`Hora inválida: ${hora}. Se espera HH:MM.`);
  }
  return { hh, mm };
}

/** Instante UTC de la medianoche del lunes de la semana que contiene la referencia. */
function lunesDeLaSemana(referencia: Date | string, zona: string): number {
  const { fecha, diaSemana } = partesLocales(referencia, zona);
  const { anio, mes, dia } = numerosDeFecha(fecha);

  // getUTCDay() da 0 para domingo; la semana arranca el lunes.
  const desplazamiento = diaSemana === 0 ? 6 : diaSemana - 1;
  return Date.UTC(anio, mes - 1, dia) - desplazamiento * DIA;
}

export interface Semana {
  /** Instante del lunes a las 00:00 de la zona. */
  desde: Date;
  /** Instante del lunes siguiente a las 00:00: límite superior excluyente. */
  hasta: Date;
  /** Las siete fechas `yyyy-mm-dd`, de lunes a domingo. */
  dias: string[];
}

/**
 * La semana de lunes a domingo que contiene a la fecha de referencia.
 *
 * Se calculan los siete días aunque la grilla dibuje seis: el haras no dicta los
 * domingos (RN-10 y RN-17 fijan la semana operativa de lunes a sábado), pero una
 * clase cargada en domingo es un dato que existe y esconderlo sería peor que
 * mostrar una columna de más.
 */
export function semanaDe(referencia: Date | string, zona: string = ZONA_HARAS): Semana {
  const lunes = lunesDeLaSemana(referencia, zona);
  const comoFecha = (instante: number) => new Date(instante).toISOString().slice(0, 10);

  return {
    desde: instanteDesdeLocal(comoFecha(lunes), '00:00', zona),
    hasta: new Date(instanteDesdeLocal(comoFecha(lunes + 6 * DIA), '00:00', zona).getTime() + DIA),
    dias: Array.from({ length: 7 }, (_, i) => comoFecha(lunes + i * DIA)),
  };
}

/** Corre la semana hacia adelante o hacia atrás, para los botones de la cabecera. */
export function semanaCorrida(
  referencia: Date | string,
  semanas: number,
  zona: string = ZONA_HARAS,
): string {
  return new Date(lunesDeLaSemana(referencia, zona) + semanas * 7 * DIA)
    .toISOString()
    .slice(0, 10);
}

export interface FilaDeGrilla<T> {
  franja: string;
  /** Una posición por cada día recibido, en el mismo orden. */
  celdas: T[][];
}

/**
 * Grilla semanal: filas por hora en punto, columnas por día.
 *
 * Sólo se emiten las franjas que tienen algo. Una grilla de veinticuatro filas
 * obliga a desplazarse para encontrar cuatro clases, y el haras dicta en dos
 * bloques separados —mañana y tarde— con un hueco largo en el medio.
 */
export function armarGrilla<T>(
  clases: readonly T[],
  dias: readonly string[],
  iniciaEnDe: (c: T) => string,
  zona: string = ZONA_HARAS,
): FilaDeGrilla<T>[] {
  const porFranja = new Map<string, T[][]>();

  for (const clase of clases) {
    const { fecha, franja } = partesLocales(iniciaEnDe(clase), zona);
    const columna = dias.indexOf(fecha);
    if (columna < 0) continue;

    let fila = porFranja.get(franja);
    if (!fila) {
      fila = dias.map(() => []);
      porFranja.set(franja, fila);
    }
    fila[columna]?.push(clase);
  }

  return [...porFranja.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([franja, celdas]) => ({ franja, celdas }));
}

export interface CupoDeClase {
  /** Cuántos alumnos admite. `null` = grupal sin cupo declarado: no se controla. */
  limite: number | null;
  ocupados: number;
  disponibles: number | null;
  completo: boolean;
}

/**
 * RN-14: la modalidad del servicio es lo que decide si hay control de cupo.
 *
 * Una clase individual no lleva cupo cargado —el campo es nulo a propósito, por
 * el CHECK del esquema— y aun así admite un solo alumno: el límite sale de la
 * modalidad, no del dato.
 */
export function cupoDeClase(
  modalidad: 'individual' | 'grupal' | null,
  cupo: number | null,
  inscriptos: number,
): CupoDeClase {
  const limite = modalidad === 'individual' ? 1 : (cupo ?? null);

  return {
    limite,
    ocupados: inscriptos,
    disponibles: limite === null ? null : Math.max(0, limite - inscriptos),
    completo: limite !== null && inscriptos >= limite,
  };
}

/**
 * Decisión 1.11: `cancelacion_clase_dias` fija la antelación mínima y
 * `inscripcion.cancelado_en` es lo que permite evaluarla después.
 *
 * La cancelación fuera de término **no se rechaza**: se registra como tal, que
 * es lo que pide el CUS05 (camino 5.a). Quién la imputa y cómo es una decisión
 * de cobranza, no de la agenda.
 */
export function cancelacionEnTermino(
  iniciaEn: Date | string,
  solicitadaEn: Date,
  diasMinimos: number,
): boolean {
  const inicio = typeof iniciaEn === 'string' ? new Date(iniciaEn) : iniciaEn;
  return inicio.getTime() - solicitadaEn.getTime() >= diasMinimos * DIA;
}

/** ¿Se pisan dos intervalos? Semiabierto `[inicio, fin)`, igual que el `tstzrange` de la base. */
export function seSolapan(
  unInicio: Date | string,
  unaDuracion: number,
  otroInicio: Date | string,
  otraDuracion: number,
): boolean {
  const a = new Date(unInicio).getTime();
  const b = new Date(otroInicio).getTime();
  return a < b + otraDuracion * MINUTO && b < a + unaDuracion * MINUTO;
}

export interface OcupacionDeInstalacion {
  instalacionId: string;
  nombre: string;
  clases: number;
  minutos: number;
  /** Porcentaje sobre el total de minutos dictados en el período, 0 a 100. */
  participacion: number;
}

/**
 * Reporte de ocupación de instalaciones (EO).
 *
 * Informa minutos dictados y participación de cada pista sobre el total, **no**
 * un porcentaje de capacidad: para eso haría falta declarar un horario de
 * apertura del establecimiento, que no es un dato que el haras haya dado. Un
 * denominador inventado convertiría el reporte en un número que nadie puede
 * auditar, que es el mismo criterio por el que `mora_tasa_mensual` quedó vacío.
 */
export function ocupacionDeInstalaciones(
  clases: readonly { instalacionId: string; nombre: string; duracionMin: number }[],
): OcupacionDeInstalacion[] {
  const porInstalacion = new Map<string, OcupacionDeInstalacion>();

  for (const clase of clases) {
    const actual = porInstalacion.get(clase.instalacionId) ?? {
      instalacionId: clase.instalacionId,
      nombre: clase.nombre,
      clases: 0,
      minutos: 0,
      participacion: 0,
    };
    actual.clases += 1;
    actual.minutos += clase.duracionMin;
    porInstalacion.set(clase.instalacionId, actual);
  }

  const total = [...porInstalacion.values()].reduce((acc, i) => acc + i.minutos, 0);

  return [...porInstalacion.values()]
    .map((i) => ({ ...i, participacion: total === 0 ? 0 : (i.minutos / total) * 100 }))
    .sort((a, b) => b.minutos - a.minutos);
}

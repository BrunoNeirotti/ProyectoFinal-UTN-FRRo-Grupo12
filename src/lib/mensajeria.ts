/**
 * M5 · Mensajería.
 *
 * RN-17 y los límites de una plantilla de WhatsApp no dependen de la base:
 * se prueban solos y son la clase de regla que si está mal en producción sale
 * un mensaje fuera de horario o una plantilla que Meta rechaza.
 */

/**
 * RN-17: los mensajes automáticos salen de lunes a sábado, entre `desde` y
 * `hasta`. El domingo nunca es hábil, sin importar la hora.
 *
 * `fecha` se interpreta en la hora local del servidor a propósito: es la hora
 * del haras, no UTC — un mensaje que Vercel genera a las 21:05 UTC-3 no debe
 * salir como si fueran las 00:05.
 */
export function dentroDeLaVentana(fecha: Date, desde: number, hasta: number): boolean {
  const dia = fecha.getDay(); // 0 = domingo
  if (dia === 0) return false;
  const hora = fecha.getHours();
  return hora >= desde && hora < hasta;
}

/**
 * Próximo momento hábil según RN-17: si ya está dentro de la ventana, ahora
 * mismo; si no, las `desde` horas del próximo día hábil (domingo salta a
 * lunes). Es lo que "se encola y sale al abrir la siguiente" quiere decir en
 * términos de una fecha concreta.
 */
export function proximoMomentoHabil(fecha: Date, desde: number, hasta: number): Date {
  if (dentroDeLaVentana(fecha, desde, hasta)) return fecha;

  const candidato = new Date(fecha);
  if (fecha.getHours() >= hasta) {
    candidato.setDate(candidato.getDate() + 1);
  }
  candidato.setHours(desde, 0, 0, 0);
  if (candidato.getDay() === 0) candidato.setDate(candidato.getDate() + 1); // domingo -> lunes

  return candidato;
}

/** Nombres de variable que declara una plantilla, en el orden en que aparecen. */
export function variablesDe(cuerpo: string): string[] {
  const encontradas = [...cuerpo.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
  return [...new Set(encontradas)];
}

/**
 * Cómo se rotula una variable en pantalla: `tasa_mora` es el nombre técnico que
 * viaja dentro del texto, no una etiqueta de formulario. «TASA_MORA» le pide al
 * usuario que lea código.
 *
 * Las que tienen un nombre propio se declaran; el resto se arma reemplazando el
 * guión bajo y poniendo la primera en mayúscula, que alcanza para las que
 * lleguen después sin tener que volver acá.
 */
const ROTULOS: Record<string, string> = {
  cliente: 'Cliente',
  periodo: 'Período',
  importe: 'Importe',
  vencimiento: 'Vencimiento',
  tasa_mora: 'Tasa de mora',
  firmante: 'Firmante',
  alumno: 'Alumno',
  caballo: 'Caballo',
  fecha: 'Fecha',
  hora: 'Hora',
  instructor: 'Instructor',
  instalacion: 'Instalación',
  motivo: 'Motivo',
  monto: 'Monto',
};

export function rotuloDeVariable(nombre: string): string {
  if (ROTULOS[nombre]) return ROTULOS[nombre];
  const conEspacios = nombre.replace(/_/g, ' ');
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

/** Sustituye `{{variable}}` por su valor. Sin datos para una variable, la deja vacía y lo señala. */
export function aplicarPlantilla(
  cuerpo: string,
  valores: Record<string, string>,
): { texto: string; faltantes: string[] } {
  const faltantes: string[] = [];
  const texto = cuerpo.replace(/\{\{(\w+)\}\}/g, (_, nombre: string) => {
    if (!(nombre in valores)) {
      faltantes.push(nombre);
      return '';
    }
    return valores[nombre]!;
  });
  return { texto, faltantes: [...new Set(faltantes)] };
}

/**
 * Límites de una plantilla de WhatsApp Business que Meta hace cumplir.
 * Cifras de la documentación de Meta al momento de este relevamiento; el
 * cuerpo cuenta el texto CON las variables ya resueltas al máximo esperable.
 */
const LIMITE_CUERPO_WHATSAPP = 1024;
const LIMITE_PIE_WHATSAPP = 60;

export interface ProblemaDeLimite {
  campo: 'cuerpo' | 'pie';
  motivo: string;
}

/**
 * RN-18: la firma vive en el cuerpo porque el pie no admite variables. Por
 * eso el pie que se valida acá es el texto fijo, y el cuerpo es el que puede
 * traer `{{firmante}}` u otras variables ya resueltas.
 */
export function verificarLimitesWhatsapp(cuerpo: string, pie?: string): ProblemaDeLimite[] {
  const problemas: ProblemaDeLimite[] = [];
  if (cuerpo.length > LIMITE_CUERPO_WHATSAPP) {
    problemas.push({
      campo: 'cuerpo',
      motivo: `El cuerpo tiene ${cuerpo.length} caracteres; Meta admite hasta ${LIMITE_CUERPO_WHATSAPP}.`,
    });
  }
  if (pie && pie.length > LIMITE_PIE_WHATSAPP) {
    problemas.push({
      campo: 'pie',
      motivo: `El pie tiene ${pie.length} caracteres; Meta admite hasta ${LIMITE_PIE_WHATSAPP}.`,
    });
  }
  return problemas;
}

import { z } from 'zod';

/**
 * Las reglas del establecimiento que el dueño cambia sin tocar código.
 *
 * `parametro.valor` se guarda como texto y se convierte según `tipo`. Un `jsonb`
 * habría sido más flexible del que hace falta y habría convertido la tabla en un
 * cajón donde termina cualquier cosa. Acá, en cambio, **cada clave está
 * declarada**: si no está en este catálogo, no existe.
 *
 * El catálogo es la fuente única del lado de la aplicación y tiene que coincidir
 * con lo que inserta la migración `…_configuracion_inicial.sql`. La prueba
 * `parametros.test.ts` verifica que no se desincronicen.
 */

export const CLAVES = [
  'cancelacion_clase_dias',
  'dia_cierre_periodo',
  'dia_vencimiento_default',
  'mora_tasa_mensual',
  'mora_aplicacion',
  'dias_aviso_previo_vencimiento',
  'cobranza_sabado_habil',
  'mensajes_ventana_desde',
  'mensajes_ventana_hasta',
  'riesgo_asistencia_puntos',
] as const;

export type Clave = (typeof CLAVES)[number];

export type TipoParametro = 'entero' | 'decimal' | 'booleano' | 'texto';

interface Declaracion {
  tipo: TipoParametro;
  /** Validación del valor ya convertido. Es lo que impide guardar un disparate. */
  esquema: z.ZodType;
  /** Si puede quedar sin valor. Sólo la tasa de mora, y a propósito. */
  admiteVacio: boolean;
}

export const CATALOGO: Record<Clave, Declaracion> = {
  cancelacion_clase_dias: { tipo: 'entero', esquema: z.int().min(0).max(30), admiteVacio: false },
  dia_cierre_periodo: { tipo: 'entero', esquema: z.int().min(1).max(28), admiteVacio: false },
  dia_vencimiento_default: { tipo: 'entero', esquema: z.int().min(1).max(28), admiteVacio: false },

  // RN-09. El único que admite quedar vacío, y no por descuido: el haras
  // confirmó que cobra mora pero no dio el porcentaje. Sin valor, la pantalla de
  // cobranza no puede proponer intereses y lo dice.
  mora_tasa_mensual: { tipo: 'decimal', esquema: z.number().min(0).max(100), admiteVacio: true },

  mora_aplicacion: {
    tipo: 'texto',
    esquema: z.enum(['asistida', 'automatica']),
    admiteVacio: false,
  },
  dias_aviso_previo_vencimiento: {
    tipo: 'entero',
    esquema: z.int().min(0).max(30),
    admiteVacio: false,
  },
  cobranza_sabado_habil: { tipo: 'booleano', esquema: z.boolean(), admiteVacio: false },

  // La franja de RN-17. Que `desde` sea menor que `hasta` no se puede verificar
  // clave por clave: se controla al guardar el conjunto (ver `validarConjunto`).
  mensajes_ventana_desde: { tipo: 'entero', esquema: z.int().min(0).max(23), admiteVacio: false },
  mensajes_ventana_hasta: { tipo: 'entero', esquema: z.int().min(0).max(23), admiteVacio: false },

  // M8. Cuántos puntos tiene que caer la asistencia de un alumno respecto del
  // promedio de los tres meses anteriores para que el sistema lo marque en
  // riesgo. El tope de 100 no es decorativo: con 100 la marca no se enciende
  // nunca, que es la forma de apagar el aviso sin sacar la columna.
  riesgo_asistencia_puntos: { tipo: 'entero', esquema: z.int().min(1).max(100), admiteVacio: false },
};

export type ValorParametro = number | boolean | string | null;

/** Convierte el texto guardado al tipo declarado. `null` es un valor legítimo. */
export function convertir(valor: string | null, tipo: TipoParametro): ValorParametro {
  if (valor === null || valor.trim() === '') return null;
  switch (tipo) {
    case 'entero': {
      const n = Number.parseInt(valor, 10);
      return Number.isNaN(n) ? null : n;
    }
    case 'decimal': {
      const n = Number.parseFloat(valor);
      return Number.isNaN(n) ? null : n;
    }
    case 'booleano':
      return valor === 'true';
    case 'texto':
      return valor;
  }
}

/** Vuelve al texto que se guarda en la columna. */
export function aTexto(valor: ValorParametro): string | null {
  if (valor === null) return null;
  return String(valor);
}

export type Validacion =
  | { valido: true; valor: ValorParametro }
  | { valido: false; motivo: string };

export function validar(clave: Clave, valor: ValorParametro): Validacion {
  const decl = CATALOGO[clave];

  if (valor === null || valor === '') {
    return decl.admiteVacio
      ? { valido: true, valor: null }
      : { valido: false, motivo: 'Este parámetro no puede quedar sin valor.' };
  }

  const r = decl.esquema.safeParse(valor);
  return r.success
    ? { valido: true, valor: valor }
    : { valido: false, motivo: r.error.issues[0]?.message ?? 'Valor inválido.' };
}

/**
 * Reglas que cruzan dos claves y que por eso no pueden vivir en el catálogo.
 *
 * Se valida el conjunto completo y no cada campo por separado: guardar sólo
 * `mensajes_ventana_hasta` con un valor menor que el `desde` ya guardado dejaría
 * una franja imposible sin que ninguna validación individual protestara.
 */
export function validarConjunto(valores: Partial<Record<Clave, ValorParametro>>): string[] {
  const problemas: string[] = [];

  const desde = valores.mensajes_ventana_desde;
  const hasta = valores.mensajes_ventana_hasta;
  if (typeof desde === 'number' && typeof hasta === 'number' && desde >= hasta) {
    problemas.push(
      'La franja horaria de los mensajes tiene que empezar antes de terminar ' +
        `(se indicó de ${desde} a ${hasta}).`,
    );
  }

  const aviso = valores.dias_aviso_previo_vencimiento;
  const vencimiento = valores.dia_vencimiento_default;
  if (typeof aviso === 'number' && typeof vencimiento === 'number' && aviso >= vencimiento) {
    problemas.push(
      'El aviso previo caería antes del inicio del mes: tiene que anticiparse ' +
        'menos días que el propio día de vencimiento.',
    );
  }

  return problemas;
}

/** Si el sistema está en condiciones de proponer intereses (RN-09). */
export function proponeIntereses(tasa: ValorParametro): boolean {
  return typeof tasa === 'number' && tasa > 0;
}

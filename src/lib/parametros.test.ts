import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOGO,
  CLAVES,
  type Clave,
  aTexto,
  convertir,
  proponeIntereses,
  validar,
  validarConjunto,
} from './parametros';

describe('catálogo de parámetros', () => {
  it('coincide con lo que inserta la migración', () => {
    // Si alguien agrega una clave de un lado y se olvida del otro, la pantalla
    // de Configuración muestra un campo que no existe en la base, o al revés.
    // Esta prueba es la que impide que se desincronicen en silencio.
    // Se leen TODAS las migraciones y no sólo la configuración inicial: cada
    // módulo nuevo puede sumar su parámetro, y `riesgo_asistencia_puntos` (M8)
    // fue el primero que llegó por esa vía; `dias_aviso_vencimiento_sanitario`
    // (M9) es el segundo.
    const migraciones = join(import.meta.dirname, '..', '..', 'supabase', 'migrations');
    const sql = readdirSync(migraciones)
      .filter((archivo) => archivo.endsWith('.sql'))
      .map((archivo) => readFileSync(join(migraciones, archivo), 'utf8'))
      .join('\n');

    // Se miran sólo las sentencias que insertan en `parametro`. Buscar la forma
    // de la fila en el archivo entero traía de premio los valores del enum
    // `tipo_parametro`, que se escriben igual y no son claves de nada.
    const altas = sql
      .split(/insert into parametro\b/)
      .slice(1)
      .map((fragmento) => fragmento.split(';')[0] ?? '')
      .join('\n');

    const enLasMigraciones = [...altas.matchAll(/\(\s*'([a-z_]+)',\s*(?:'[^']*'|null),\s*'(?:entero|decimal|booleano|texto)'/g)]
      .map((m) => m[1])
      .sort();

    expect(enLasMigraciones).toEqual([...CLAVES].sort());
  });

  it('sólo la tasa de mora admite quedar sin valor', () => {
    const conVacio = CLAVES.filter((c) => CATALOGO[c].admiteVacio);
    expect(conVacio).toEqual(['mora_tasa_mensual']);
  });
});

describe('conversión de valores', () => {
  it('convierte según el tipo declarado', () => {
    expect(convertir('10', 'entero')).toBe(10);
    expect(convertir('7.5', 'decimal')).toBe(7.5);
    expect(convertir('true', 'booleano')).toBe(true);
    expect(convertir('false', 'booleano')).toBe(false);
    expect(convertir('asistida', 'texto')).toBe('asistida');
  });

  it('trata el vacío y el nulo como ausencia de valor, no como cero', () => {
    // Es la diferencia entre «no cobra intereses» y «todavía no se definió
    // cuánto», que para el negocio no es lo mismo.
    expect(convertir(null, 'decimal')).toBeNull();
    expect(convertir('', 'decimal')).toBeNull();
    expect(convertir('   ', 'decimal')).toBeNull();
  });

  it('vuelve a texto sin perder el nulo', () => {
    expect(aTexto(null)).toBeNull();
    expect(aTexto(10)).toBe('10');
    expect(aTexto(true)).toBe('true');
  });
});

describe('validación por clave', () => {
  it('acepta la tasa de mora vacía', () => {
    expect(validar('mora_tasa_mensual', null)).toEqual({ valido: true, valor: null });
  });

  it('rechaza dejar sin valor cualquier otra clave', () => {
    const r = validar('dia_vencimiento_default', null);
    expect(r.valido).toBe(false);
  });

  it('rechaza un día de vencimiento que no exista en todos los meses', () => {
    // El 29, el 30 y el 31 no sirven: en febrero no hay.
    expect(validar('dia_vencimiento_default', 29).valido).toBe(false);
    expect(validar('dia_vencimiento_default', 28).valido).toBe(true);
  });

  it('rechaza un modo de aplicación de mora que no está previsto', () => {
    expect(validar('mora_aplicacion', 'a_ojo').valido).toBe(false);
    expect(validar('mora_aplicacion', 'asistida').valido).toBe(true);
  });

  it('rechaza una tasa de mora fuera de rango', () => {
    expect(validar('mora_tasa_mensual', -1).valido).toBe(false);
    expect(validar('mora_tasa_mensual', 8.5).valido).toBe(true);
  });
});

describe('validación del conjunto', () => {
  it('rechaza una franja horaria imposible', () => {
    const problemas = validarConjunto({
      mensajes_ventana_desde: 21,
      mensajes_ventana_hasta: 9,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('franja horaria');
  });

  it('acepta la franja que confirmó el haras', () => {
    expect(
      validarConjunto({ mensajes_ventana_desde: 9, mensajes_ventana_hasta: 21 }),
    ).toEqual([]);
  });

  it('rechaza un aviso previo que caería antes del mes', () => {
    const problemas = validarConjunto({
      dia_vencimiento_default: 10,
      dias_aviso_previo_vencimiento: 10,
    });
    expect(problemas).toHaveLength(1);
  });

  it('acepta el calendario de cobranza confirmado: vence el 10, avisa el 7', () => {
    expect(
      validarConjunto({ dia_vencimiento_default: 10, dias_aviso_previo_vencimiento: 3 }),
    ).toEqual([]);
  });

  it('no inventa problemas cuando falta uno de los dos valores', () => {
    expect(validarConjunto({ mensajes_ventana_desde: 9 })).toEqual([]);
  });
});

describe('proponeIntereses', () => {
  it('no propone nada mientras la tasa esté vacía', () => {
    expect(proponeIntereses(null)).toBe(false);
    expect(proponeIntereses(0)).toBe(false);
  });

  it('propone en cuanto hay una tasa cargada', () => {
    expect(proponeIntereses(8)).toBe(true);
  });
});

describe('cobertura del catálogo', () => {
  it('declara las doce claves y ninguna de más', () => {
    expect(CLAVES).toHaveLength(12);
    for (const clave of CLAVES) {
      expect(CATALOGO[clave as Clave]).toBeDefined();
    }
  });
});

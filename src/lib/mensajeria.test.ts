import { describe, expect, it } from 'vitest';
import {
  aplicarPlantilla,
  dentroDeLaVentana,
  proximoMomentoHabil,
  variablesDe,
  verificarLimitesWhatsapp,
} from './mensajeria';

describe('dentroDeLaVentana', () => {
  it('el domingo nunca es hábil, sin importar la hora', () => {
    // 2026-08-30 es domingo
    expect(dentroDeLaVentana(new Date(2026, 7, 30, 12, 0), 9, 21)).toBe(false);
  });

  it('dentro de la franja de un día hábil, sí', () => {
    // 2026-08-31 es lunes
    expect(dentroDeLaVentana(new Date(2026, 7, 31, 14, 0), 9, 21)).toBe(true);
  });

  it('antes de la apertura, no', () => {
    expect(dentroDeLaVentana(new Date(2026, 7, 31, 8, 59), 9, 21)).toBe(false);
  });

  it('en el límite de cierre exacto, ya no', () => {
    expect(dentroDeLaVentana(new Date(2026, 7, 31, 21, 0), 9, 21)).toBe(false);
  });

  it('el sábado es hábil (RN-10)', () => {
    // 2026-09-05 es sábado
    expect(dentroDeLaVentana(new Date(2026, 8, 5, 10, 0), 9, 21)).toBe(true);
  });
});

describe('proximoMomentoHabil', () => {
  it('si ya está dentro de la ventana, es ahora mismo', () => {
    const ahora = new Date(2026, 7, 31, 14, 0);
    expect(proximoMomentoHabil(ahora, 9, 21)).toEqual(ahora);
  });

  it('generado de madrugada, sale a las 9 del mismo día', () => {
    const r = proximoMomentoHabil(new Date(2026, 7, 31, 3, 0), 9, 21);
    expect(r.getHours()).toBe(9);
    expect(r.getDate()).toBe(31);
  });

  it('generado a las 23:40, sale a las 9 del día siguiente', () => {
    const r = proximoMomentoHabil(new Date(2026, 7, 31, 23, 40), 9, 21);
    expect(r.getHours()).toBe(9);
    expect(r.getDate()).toBe(1); // 1 de septiembre
  });

  it('lo que cae domingo salta a las 9 del lunes', () => {
    const r = proximoMomentoHabil(new Date(2026, 7, 29, 23, 0), 9, 21); // sábado 29 tarde
    expect(r.getDay()).toBe(1); // lunes
    expect(r.getHours()).toBe(9);
  });
});

describe('aplicarPlantilla', () => {
  it('sustituye las variables presentes', () => {
    const r = aplicarPlantilla('Hola {{cliente}}, tu saldo es {{importe}}.', {
      cliente: 'Familia Gutiérrez',
      importe: '$260.000',
    });
    expect(r.texto).toBe('Hola Familia Gutiérrez, tu saldo es $260.000.');
    expect(r.faltantes).toEqual([]);
  });

  it('señala las variables sin dato en vez de fallar', () => {
    const r = aplicarPlantilla('Hola {{cliente}}, vence el {{vencimiento}}.', { cliente: 'M. Rossi' });
    expect(r.texto).toBe('Hola M. Rossi, vence el .');
    expect(r.faltantes).toEqual(['vencimiento']);
  });
});

describe('variablesDe', () => {
  it('extrae los nombres, sin repetir, en orden de aparición', () => {
    expect(variablesDe('Hola {{cliente}}, tu saldo {{importe}} vence el {{vencimiento}}. Saludos {{cliente}}.')).toEqual([
      'cliente',
      'importe',
      'vencimiento',
    ]);
  });

  it('sin variables, lista vacía', () => {
    expect(variablesDe('Un texto fijo sin marcadores.')).toEqual([]);
  });
});

describe('verificarLimitesWhatsapp', () => {
  it('un cuerpo dentro del límite no da problemas', () => {
    expect(verificarLimitesWhatsapp('Hola, este es un mensaje corto.')).toEqual([]);
  });

  it('un cuerpo demasiado largo se señala', () => {
    const problemas = verificarLimitesWhatsapp('a'.repeat(1025));
    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.campo).toBe('cuerpo');
  });

  it('un pie de más de 60 caracteres se señala (el hallazgo real del 29/07)', () => {
    const pie = 'Soy Sofía, de la administración del Haras Las Lechuzas, gracias'; // 63
    const problemas = verificarLimitesWhatsapp('cuerpo corto', pie);
    expect(problemas).toEqual([{ campo: 'pie', motivo: expect.stringContaining('63') }]);
  });
});

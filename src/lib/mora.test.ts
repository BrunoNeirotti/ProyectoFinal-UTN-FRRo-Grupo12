import { describe, expect, it } from 'vitest';
import { calcularMora, diasDeAtraso } from './mora';

describe('calcularMora', () => {
  it('no propone nada mientras la tasa no esté configurada', () => {
    // Es el estado real del negocio: el haras confirmó que cobra mora pero no
    // dio el porcentaje. Devolver cero se confundiría con «no debe intereses».
    expect(calcularMora({ base: 100_000, tasaMensual: null, dias: 15 })).toEqual({
      aplica: false,
      motivo: 'sin_tasa',
    });
  });

  it('no propone nada si no hay atraso', () => {
    expect(calcularMora({ base: 100_000, tasaMensual: 8, dias: 0 })).toEqual({
      aplica: false,
      motivo: 'sin_atraso',
    });
  });

  it('no propone nada si el saldo está cancelado o a favor', () => {
    expect(calcularMora({ base: 0, tasaMensual: 8, dias: 30 }).aplica).toBe(false);
    expect(calcularMora({ base: -5_000, tasaMensual: 8, dias: 30 }).aplica).toBe(false);
  });

  it('prorratea sobre treinta días, no sobre el largo del mes', () => {
    // 100.000 al 6 % mensual, 30 días => 6.000 exactos.
    const mes = calcularMora({ base: 100_000, tasaMensual: 6, dias: 30 });
    expect(mes).toMatchObject({ aplica: true, importe: 6_000 });

    // La mitad del período es la mitad del interés.
    const quincena = calcularMora({ base: 100_000, tasaMensual: 6, dias: 15 });
    expect(quincena).toMatchObject({ aplica: true, importe: 3_000 });
  });

  it('redondea a centavos, que es la precisión de la columna', () => {
    const r = calcularMora({ base: 12_345.67, tasaMensual: 7.5, dias: 11 });
    expect(r.aplica).toBe(true);
    if (r.aplica) {
      expect(r.importe).toBe(339.51);
      expect(Number.isInteger(r.importe * 100)).toBe(true);
    }
  });

  it('conserva la derivación para poder copiarla al movimiento', () => {
    // RN-09: el movimiento guarda base, tasa y días. Si un estado de cuenta
    // viejo recalculara con la tasa de hoy mostraría un número que el cliente
    // nunca vio, así que la propuesta tiene que devolver con qué se calculó.
    const r = calcularMora({ base: 80_000, tasaMensual: 5, dias: 20 });
    expect(r).toEqual({
      aplica: true,
      base: 80_000,
      tasaMensual: 5,
      dias: 20,
      importe: 2_666.67,
    });
  });
});

describe('diasDeAtraso', () => {
  it('cuenta días corridos desde el vencimiento', () => {
    expect(diasDeAtraso(new Date('2026-08-10'), new Date('2026-08-25'))).toBe(15);
  });

  it('devuelve cero antes del vencimiento, no un negativo', () => {
    expect(diasDeAtraso(new Date('2026-08-10'), new Date('2026-08-03'))).toBe(0);
  });

  it('no se corre por el cambio de horario de verano', () => {
    // Con aritmética de fechas locales este tramo da 30,958 días y se trunca a
    // 30. El cálculo va en UTC justamente para que no dependa de la zona.
    expect(diasDeAtraso(new Date('2026-10-10'), new Date('2026-11-10'))).toBe(31);
  });
});

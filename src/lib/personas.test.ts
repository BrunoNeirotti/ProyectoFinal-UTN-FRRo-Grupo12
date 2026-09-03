import { describe, expect, it } from 'vitest';
import { edadEn, esMenorDeEdad } from './personas';

describe('edadEn', () => {
  it('calcula años cumplidos', () => {
    expect(edadEn('2014-03-10', new Date('2026-09-03'))).toBe(12);
  });

  it('no suma el año si todavía no llegó el cumpleaños', () => {
    expect(edadEn('2014-12-10', new Date('2026-09-03'))).toBe(11);
  });

  it('suma el año el mismo día del cumpleaños', () => {
    expect(edadEn('2014-09-03', new Date('2026-09-03'))).toBe(12);
  });
});

describe('esMenorDeEdad', () => {
  it('es menor con 17 años', () => {
    expect(esMenorDeEdad('2009-01-01', new Date('2026-09-03'))).toBe(true);
  });

  it('deja de ser menor el día que cumple 18', () => {
    expect(esMenorDeEdad('2008-09-03', new Date('2026-09-03'))).toBe(false);
  });

  it('mayor de edad claro', () => {
    expect(esMenorDeEdad('1990-01-01', new Date('2026-09-03'))).toBe(false);
  });
});

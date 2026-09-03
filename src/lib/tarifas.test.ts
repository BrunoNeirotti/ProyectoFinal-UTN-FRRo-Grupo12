import { describe, expect, it } from 'vitest';
import { tarifaVigenteEn } from './tarifas';

describe('tarifaVigenteEn', () => {
  it('elige la más reciente que no sea posterior a la fecha de corte', () => {
    const tarifas = [
      { importe: 200_000, vigenteDesde: '2025-04-01' },
      { importe: 260_000, vigenteDesde: '2026-04-01' },
      { importe: 300_000, vigenteDesde: '2026-10-01' }, // todavía no rige
    ];

    const vigente = tarifaVigenteEn(tarifas, new Date('2026-06-15'));
    expect(vigente?.importe).toBe(260_000);
  });

  it('devuelve null si ninguna tarifa está vigente todavía', () => {
    const tarifas = [{ importe: 100, vigenteDesde: '2027-01-01' }];
    expect(tarifaVigenteEn(tarifas, new Date('2026-06-15'))).toBeNull();
  });

  it('devuelve null sin tarifas cargadas', () => {
    expect(tarifaVigenteEn([], new Date('2026-06-15'))).toBeNull();
  });

  it('toma la fecha exacta de vigencia como aplicable, no como límite excluyente', () => {
    const tarifas = [{ importe: 260_000, vigenteDesde: '2026-04-01' }];
    expect(tarifaVigenteEn(tarifas, new Date('2026-04-01'))?.importe).toBe(260_000);
  });
});

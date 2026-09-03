import { describe, expect, it } from 'vitest';
import { diaDeVencimientoEfectivo, validarDatosFiscales } from './clientes';

describe('validarDatosFiscales', () => {
  it('no exige nada si el cliente no pide factura', () => {
    expect(validarDatosFiscales({ requiereFactura: false, cuit: null, condicionIva: null })).toEqual({
      valido: true,
    });
  });

  it('exige CUIT si pide factura', () => {
    const r = validarDatosFiscales({ requiereFactura: true, cuit: null, condicionIva: 'monotributo' });
    expect(r.valido).toBe(false);
  });

  it('exige condición de IVA si pide factura', () => {
    const r = validarDatosFiscales({ requiereFactura: true, cuit: '20-12345678-3', condicionIva: null });
    expect(r.valido).toBe(false);
  });

  it('es válido con los dos datos si pide factura', () => {
    const r = validarDatosFiscales({
      requiereFactura: true,
      cuit: '20-12345678-3',
      condicionIva: 'monotributo',
    });
    expect(r.valido).toBe(true);
  });
});

describe('diaDeVencimientoEfectivo', () => {
  it('usa el día pactado si existe', () => {
    expect(diaDeVencimientoEfectivo(15, 10)).toBe(15);
  });

  it('cae al valor por omisión si no hay pacto', () => {
    expect(diaDeVencimientoEfectivo(null, 10)).toBe(10);
  });
});

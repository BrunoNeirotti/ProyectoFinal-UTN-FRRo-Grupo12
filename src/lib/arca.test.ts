import { describe, expect, it } from 'vitest';
import {
  cbteTipoWsfe,
  condicionIvaReceptorId,
  desglosarIva,
  docTipoWsfe,
  fechaWsfe,
  identidadFiscalVigenteEn,
  tipoComprobanteDesde,
  urlQrArca,
  type IdentidadFiscalVigente,
} from './arca';

describe('tipoComprobanteDesde (RN-02)', () => {
  it('monotributo emite C sin importar el receptor', () => {
    expect(tipoComprobanteDesde('monotributo', 'responsable_inscripto')).toBe('factura_c');
    expect(tipoComprobanteDesde('monotributo', 'consumidor_final')).toBe('factura_c');
  });

  it('exento emite C sin importar el receptor', () => {
    expect(tipoComprobanteDesde('exento', 'responsable_inscripto')).toBe('factura_c');
    expect(tipoComprobanteDesde('exento', 'monotributo')).toBe('factura_c');
  });

  it('responsable inscripto emite A a otro responsable inscripto', () => {
    expect(tipoComprobanteDesde('responsable_inscripto', 'responsable_inscripto')).toBe('factura_a');
  });

  it('responsable inscripto emite B a monotributo, exento o consumidor final', () => {
    expect(tipoComprobanteDesde('responsable_inscripto', 'monotributo')).toBe('factura_b');
    expect(tipoComprobanteDesde('responsable_inscripto', 'exento')).toBe('factura_b');
    expect(tipoComprobanteDesde('responsable_inscripto', 'consumidor_final')).toBe('factura_b');
  });
});

describe('cbteTipoWsfe', () => {
  it('mapea a los códigos reales de WSFEv1', () => {
    expect(cbteTipoWsfe('factura_a')).toBe(1);
    expect(cbteTipoWsfe('factura_b')).toBe(6);
    expect(cbteTipoWsfe('factura_c')).toBe(11);
  });
});

describe('condicionIvaReceptorId', () => {
  // Verificado contra FEParamGetCondicionIvaReceptor en homologación el 04/09/2026.
  it('mapea los cuatro valores de condicion_iva a los códigos reales de ARCA', () => {
    expect(condicionIvaReceptorId('responsable_inscripto')).toBe(1);
    expect(condicionIvaReceptorId('exento')).toBe(4);
    expect(condicionIvaReceptorId('consumidor_final')).toBe(5);
    expect(condicionIvaReceptorId('monotributo')).toBe(6);
  });
});

describe('docTipoWsfe', () => {
  // Verificado contra FEParamGetTiposDoc en homologación el 04/09/2026.
  it('mapea los cuatro tipos de documento del sistema', () => {
    expect(docTipoWsfe('cuit')).toBe(80);
    expect(docTipoWsfe('cuil')).toBe(86);
    expect(docTipoWsfe('dni')).toBe(96);
    expect(docTipoWsfe('pasaporte')).toBe(94);
  });
});

describe('fechaWsfe', () => {
  it('formatea en YYYYMMDD sin separadores', () => {
    expect(fechaWsfe(new Date('2026-09-04T12:00:00Z'))).toBe('20260904');
  });

  it('rellena con cero el mes y el día', () => {
    expect(fechaWsfe(new Date('2026-01-05T00:00:00Z'))).toBe('20260105');
  });
});

describe('urlQrArca', () => {
  it('codifica el JSON de la RG 4.892 en base64 dentro de la URL de ARCA', () => {
    const url = urlQrArca({
      fecha: '2026-09-04',
      cuit: 20438140418,
      ptoVta: 1,
      tipoCmp: 11,
      nroCmp: 1,
      importe: 15000,
      tipoDocRec: 99,
      nroDocRec: 0,
      cae: '86360852740445',
    });
    expect(url.startsWith('https://www.afip.gob.ar/fe/qr/?p=')).toBe(true);

    const base64 = url.split('?p=')[1]!;
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    expect(payload).toMatchObject({
      ver: 1,
      fecha: '2026-09-04',
      cuit: 20438140418,
      ptoVta: 1,
      tipoCmp: 11,
      nroCmp: 1,
      importe: 15000,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: 'E',
      codAut: 86360852740445,
    });
  });
});

describe('identidadFiscalVigenteEn', () => {
  const base: Omit<IdentidadFiscalVigente, 'vigenteDesde'> = {
    id: 'x',
    razonSocial: 'Haras Las Lechuzas',
    cuit: '20111111112',
    condicionIva: 'monotributo',
    domicilioFiscal: 'Funes',
    ingresosBrutos: null,
    inicioActividades: '2020-01-01',
  };

  it('elige la más reciente que no sea posterior a la fecha (RN-01)', () => {
    const identidades: IdentidadFiscalVigente[] = [
      { ...base, id: 'monotributo', vigenteDesde: '2026-01-01' },
      { ...base, id: 'asociacion-civil', condicionIva: 'exento', vigenteDesde: '2027-01-01' },
    ];
    expect(identidadFiscalVigenteEn(identidades, new Date('2026-06-01'))?.id).toBe('monotributo');
    expect(identidadFiscalVigenteEn(identidades, new Date('2027-06-01'))?.id).toBe('asociacion-civil');
  });

  it('null si ninguna identidad rige todavía', () => {
    const identidades: IdentidadFiscalVigente[] = [{ ...base, vigenteDesde: '2027-01-01' }];
    expect(identidadFiscalVigenteEn(identidades, new Date('2026-01-01'))).toBeNull();
  });
});

describe('desglosarIva', () => {
  it('separa neto e IVA al 21% desde un total', () => {
    const { neto, iva } = desglosarIva(121);
    expect(neto).toBe(100);
    expect(iva).toBe(21);
  });

  it('redondea a centavos', () => {
    const { neto, iva } = desglosarIva(100);
    expect(neto + iva).toBeCloseTo(100, 2);
  });
});

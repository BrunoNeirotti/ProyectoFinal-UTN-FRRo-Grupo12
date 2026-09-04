/**
 * M6 · Facturación electrónica.
 *
 * Reglas de ARCA que no dependen de la red ni de la base, y por eso se
 * prueban solas: qué tipo de comprobante corresponde (RN-02), a qué código de
 * `CondicionIVAReceptorId` traduce cada condición del receptor, y cómo se arma
 * la URL del código QR (RG 4.892). Lo que sí llama a la red —WSAA, WSFEv1— vive
 * en el router, detrás de `@arcasdk/core`.
 */

export type CondicionIvaEmisor = 'monotributo' | 'exento' | 'responsable_inscripto';
export type CondicionIvaReceptor = 'responsable_inscripto' | 'monotributo' | 'consumidor_final' | 'exento';
export type TipoComprobanteEmitible = 'factura_a' | 'factura_b' | 'factura_c';
export type TipoDocumento = 'dni' | 'cuit' | 'cuil' | 'pasaporte';

/**
 * RN-02: el tipo de comprobante se deriva del cruce emisor/receptor, no se
 * elige. Monotributo y exento emiten C siempre; sólo un responsable
 * inscripto discrimina entre A (receptor también RI) y B (cualquier otro).
 */
export function tipoComprobanteDesde(
  emisor: CondicionIvaEmisor,
  receptor: CondicionIvaReceptor,
): TipoComprobanteEmitible {
  if (emisor !== 'responsable_inscripto') return 'factura_c';
  return receptor === 'responsable_inscripto' ? 'factura_a' : 'factura_b';
}

/** `CbteTipo` de WSFEv1 para los tres tipos que RN-02 puede producir. */
export function cbteTipoWsfe(tipo: TipoComprobanteEmitible): number {
  return { factura_a: 1, factura_b: 6, factura_c: 11 }[tipo];
}

/**
 * `CondicionIVAReceptorId`, obligatorio desde la RG 5.616/2024. Verificado
 * contra `FEParamGetCondicionIvaReceptor` en homologación el 04/09/2026, no
 * adivinado: 1 (RI), 4 (Exento), 5 (Consumidor Final), 6 (Monotributo).
 */
export function condicionIvaReceptorId(receptor: CondicionIvaReceptor): number {
  return { responsable_inscripto: 1, exento: 4, consumidor_final: 5, monotributo: 6 }[receptor];
}

/**
 * `DocTipo` de WSFEv1. Verificado contra `FEParamGetTiposDoc` en homologación
 * el 04/09/2026: 80 (CUIT), 86 (CUIL), 96 (DNI), 94 (Pasaporte).
 */
export function docTipoWsfe(tipo: TipoDocumento): number {
  return { cuit: 80, cuil: 86, dni: 96, pasaporte: 94 }[tipo];
}

/**
 * `DocTipo`/`DocNro` para un comprobante sin receptor identificado (consumo
 * sin datos fiscales, o donde el cliente no tiene documento cargado). WSFEv1
 * exige igualmente el par completo, y ésta es la convención documentada para
 * "consumidor final sin identificar".
 */
export const DOC_SIN_IDENTIFICAR = { docTipo: 99, docNro: 0 } as const;

/** Formato `YYYYMMDD` que exige WSFEv1 en las fechas del request. */
export function fechaWsfe(fecha: Date): string {
  const y = fecha.getUTCFullYear();
  const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const d = String(fecha.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export interface DatosQR {
  fecha: string; // YYYY-MM-DD
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  tipoDocRec: number;
  nroDocRec: number;
  cae: string;
}

/**
 * URL del código QR obligatorio en todo comprobante (RG 4.892/2020). Es JSON
 * en base64 dentro de la URL que publica ARCA; no llama a ningún servicio.
 */
export function urlQrArca(datos: DatosQR): string {
  const payload = {
    ver: 1,
    fecha: datos.fecha,
    cuit: datos.cuit,
    ptoVta: datos.ptoVta,
    tipoCmp: datos.tipoCmp,
    nroCmp: datos.nroCmp,
    importe: datos.importe,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: datos.tipoDocRec,
    nroDocRec: datos.nroDocRec,
    tipoCodAut: 'E',
    codAut: Number(datos.cae),
  };
  const base64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

export interface IdentidadFiscalVigente {
  id: string;
  razonSocial: string;
  cuit: string;
  condicionIva: CondicionIvaEmisor;
  vigenteDesde: string; // ISO yyyy-mm-dd
  domicilioFiscal: string;
  ingresosBrutos: string | null;
  inicioActividades: string;
}

/**
 * Misma regla que `tarifaVigenteEn` (decisión 1.4), aplicada a la identidad
 * fiscal del emisor (decisión 1.10 / RN-01): la vigente es la de
 * `vigenteDesde` más reciente que no sea posterior a la fecha dada.
 */
export function identidadFiscalVigenteEn(
  identidades: readonly IdentidadFiscalVigente[],
  fecha: Date = new Date(),
): IdentidadFiscalVigente | null {
  const corte = fecha.toISOString().slice(0, 10);
  const aplicables = identidades
    .filter((i) => i.vigenteDesde <= corte)
    .sort((a, b) => (a.vigenteDesde < b.vigenteDesde ? 1 : -1));
  return aplicables[0] ?? null;
}

/**
 * Desglose de neto e IVA a partir de un total, para el único caso donde RN-02
 * lo exige: emisor responsable inscripto. Monotributo y exento (hoy) no
 * discriminan IVA, así que esta función no se usa hasta que el haras cambie
 * de condición fiscal (RN-01).
 */
export function desglosarIva(total: number, alicuota = 21): { neto: number; iva: number } {
  const neto = Math.round((total / (1 + alicuota / 100)) * 100) / 100;
  const iva = Math.round((total - neto) * 100) / 100;
  return { neto, iva };
}

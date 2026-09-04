import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { mapearEstadoDePago, verificarFirmaWebhook } from './mercadopago';

function firmar(dataId: string, xRequestId: string, ts: string, secret: string): string {
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifiesto).digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('verificarFirmaWebhook', () => {
  const secret = 'un-secreto-de-prueba';
  const dataId = '123456789';
  const xRequestId = 'req-abc';
  const ts = '1704908010';

  it('acepta una firma calculada con el mismo algoritmo que MercadoPago documenta', () => {
    const xSignature = firmar(dataId, xRequestId, ts, secret);
    expect(verificarFirmaWebhook({ xSignature, xRequestId, dataId, secret })).toBe(true);
  });

  it('el id es case-insensitive: MercadoPago lo firma en minúsculas', () => {
    const xSignature = firmar(dataId, xRequestId, ts, secret);
    expect(verificarFirmaWebhook({ xSignature, xRequestId, dataId: dataId.toUpperCase(), secret })).toBe(true);
  });

  it('rechaza si el secreto no coincide', () => {
    const xSignature = firmar(dataId, xRequestId, ts, secret);
    expect(verificarFirmaWebhook({ xSignature, xRequestId, dataId, secret: 'otro-secreto' })).toBe(false);
  });

  it('rechaza si el id no es el que se firmó (alguien reutiliza una firma vieja)', () => {
    const xSignature = firmar(dataId, xRequestId, ts, secret);
    expect(verificarFirmaWebhook({ xSignature, xRequestId, dataId: '000000000', secret })).toBe(false);
  });

  it('rechaza un header sin ts o sin v1', () => {
    expect(verificarFirmaWebhook({ xSignature: 'v1=abc', xRequestId, dataId, secret })).toBe(false);
    expect(verificarFirmaWebhook({ xSignature: 'ts=123', xRequestId, dataId, secret })).toBe(false);
    expect(verificarFirmaWebhook({ xSignature: '', xRequestId, dataId, secret })).toBe(false);
  });
});

describe('mapearEstadoDePago', () => {
  it('acredita approved y accredited', () => {
    expect(mapearEstadoDePago('approved')).toBe('acreditado');
    expect(mapearEstadoDePago('accredited')).toBe('acreditado');
  });

  it('rechaza rejected y cancelled', () => {
    expect(mapearEstadoDePago('rejected')).toBe('rechazado');
    expect(mapearEstadoDePago('cancelled')).toBe('rechazado');
  });

  it('devuelve refunded y charged_back', () => {
    expect(mapearEstadoDePago('refunded')).toBe('devuelto');
    expect(mapearEstadoDePago('charged_back')).toBe('devuelto');
  });

  it('un estado desconocido queda pendiente: ni se da por perdido ni por cobrado', () => {
    expect(mapearEstadoDePago('algo_nuevo_que_agregue_mercadopago')).toBe('pendiente');
  });
});

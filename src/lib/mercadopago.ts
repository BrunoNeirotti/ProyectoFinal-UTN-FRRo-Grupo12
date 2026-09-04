import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * M4 · Pagos (MercadoPago).
 *
 * Lo que no depende de la base ni de la red: verificar la firma del webhook y
 * traducir el estado que informa MercadoPago al enum propio. Las llamadas de
 * verdad a la API (crear una preferencia, pedir el detalle de un pago) están en
 * el router, porque hacen una petición HTTP y acá lo que importa es poder
 * probar el criterio sin simularla.
 */

export type EstadoPago = 'pendiente' | 'acreditado' | 'rechazado' | 'devuelto';

/**
 * MercadoPago manda muchos más estados de los cuatro que tiene el modelo
 * (decisión: sólo importa si cobró, no cobró, o puede cobrar). Todo lo que no
 * está en la lista cae en `pendiente`, que es la lectura conservadora: no dar
 * por perdido ni por acreditado lo que todavía no se sabe.
 */
const MAPA_ESTADO: Record<string, EstadoPago> = {
  approved: 'acreditado',
  accredited: 'acreditado',
  pending: 'pendiente',
  in_process: 'pendiente',
  in_mediation: 'pendiente',
  authorized: 'pendiente',
  rejected: 'rechazado',
  cancelled: 'rechazado',
  refunded: 'devuelto',
  charged_back: 'devuelto',
};

export function mapearEstadoDePago(estadoMp: string): EstadoPago {
  return MAPA_ESTADO[estadoMp] ?? 'pendiente';
}

function partesDeFirma(xSignature: string): { ts: string | null; v1: string | null } {
  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of xSignature.split(',')) {
    const [clave, valor] = parte.split('=').map((s) => s.trim());
    if (clave === 'ts') ts = valor ?? null;
    if (clave === 'v1') v1 = valor ?? null;
  }
  return { ts, v1 };
}

export interface FirmaWebhookMercadoPago {
  /** Header `x-signature`, con el formato `ts=...,v1=...`. */
  xSignature: string;
  /** Header `x-request-id`. */
  xRequestId: string;
  /** `data.id` del cuerpo o del query string, según el tipo de notificación. */
  dataId: string;
  secret: string;
}

/**
 * Verifica la firma HMAC-SHA256 del webhook, según el algoritmo documentado
 * por MercadoPago: el manifiesto es `id:{dataId};request-id:{xRequestId};ts:{ts};`
 * (el id en minúsculas) y `v1` es su HMAC con el secreto del webhook.
 *
 * Sin esto, cualquiera que adivine la URL puede POSTear "pago acreditado" y
 * mover plata que nunca entró. `timingSafeEqual` evita que la comparación en sí
 * filtre la firma correcta byte a byte.
 */
export function verificarFirmaWebhook({ xSignature, xRequestId, dataId, secret }: FirmaWebhookMercadoPago): boolean {
  const { ts, v1 } = partesDeFirma(xSignature);
  if (!ts || !v1) return false;

  const manifiesto = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const calculada = createHmac('sha256', secret).update(manifiesto).digest('hex');

  const a = Buffer.from(calculada, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

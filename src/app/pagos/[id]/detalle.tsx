'use client';

import { useActionState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { imputarPago, anularImputacionDePago } from '../acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';

type Salidas = inferRouterOutputs<RouterApp>;
type Pago = Salidas['pago']['detalle'];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

const ESTADO_TEXTO = { acreditado: 'Acreditado', pendiente: 'Pendiente', rechazado: 'Rechazado', devuelto: 'Devuelto' } as const;
const MEDIO_TEXTO = { mercadopago: 'MercadoPago', transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque' } as const;

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

export function DetalleDePago({ pago }: { pago: Pago }) {
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="label">Importe</dt>
            <dd className="font-serif text-2xl tnum text-fg">{formatoDinero(Number(pago.importe))}</dd>
          </div>
          <div>
            <dt className="label">Estado</dt>
            <dd className="text-fg">{ESTADO_TEXTO[pago.estado as keyof typeof ESTADO_TEXTO]}</dd>
          </div>
          <div>
            <dt className="label">Medio</dt>
            <dd className="text-fg">{MEDIO_TEXTO[pago.medio as keyof typeof MEDIO_TEXTO]}</dd>
          </div>
          <div>
            <dt className="label">Referencia externa</dt>
            <dd className="text-fg">{pago.referencia_externa ?? '—'}</dd>
          </div>
          <div>
            <dt className="label">Registrado</dt>
            <dd className="text-fg">{new Date(pago.creado_en).toLocaleString('es-AR')}</dd>
          </div>
          <div>
            <dt className="label">Acreditado</dt>
            <dd className="text-fg">{pago.acreditado_en ? new Date(pago.acreditado_en).toLocaleString('es-AR') : '—'}</dd>
          </div>
        </dl>
      </section>

      <ImputacionDePago pago={pago} />
    </div>
  );
}

function ImputacionDePago({ pago }: { pago: Pago }) {
  const imputar = useActionState(imputarPago, inicial);
  const anular = useActionState(anularImputacionDePago, inicial);

  if (pago.imputacion) {
    const [resultado, enviar] = anular;
    return (
      <section className="card-accent p-4">
        <p className="font-medium text-fg">
          Imputado a la cuenta corriente el {new Date(pago.imputacion.creado_en).toLocaleString('es-AR')}.
        </p>
        <form action={enviar} className="mt-2">
          <input type="hidden" name="pagoId" value={pago.id} />
          <input type="hidden" name="movimientoId" value={pago.imputacion.id} />
          <BotonEnviar texto="Anular imputación" variante="sec" tamano="sm" />
          {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        </form>
      </section>
    );
  }

  if (pago.estado !== 'acreditado') {
    return <p className="helper">Sólo se puede imputar un pago acreditado; éste está {ESTADO_TEXTO[pago.estado as keyof typeof ESTADO_TEXTO].toLowerCase()}.</p>;
  }

  const [resultado, enviar] = imputar;
  return (
    <section className="card-accent p-4">
      <p className="font-medium text-fg">Acreditado y todavía sin imputar a ninguna cuenta corriente.</p>
      <form action={enviar} className="mt-2">
        <input type="hidden" name="pagoId" value={pago.id} />
        <BotonEnviar texto="Imputar a la cuenta corriente" variante="pri" tamano="sm" />
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      </form>
    </section>
  );
}

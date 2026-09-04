'use client';

import { useActionState } from 'react';
import { generarEnlaceDePago, type ResultadoDeEnlace } from './acciones';
import { BotonEnviar } from '../botones';

interface ClienteOpcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeEnlace = { estado: 'inicial' };

/**
 * Genera la preferencia de MercadoPago. Sin `MERCADOPAGO_ACCESS_TOKEN` en este
 * entorno, el pedido vuelve con el motivo exacto en vez de una URL: no hay
 * credenciales reales todavía (07-dependencias-externas.md).
 */
export function FormularioGenerarEnlace({ clientes }: { clientes: ClienteOpcion[] }) {
  const [resultado, enviar] = useActionState(generarEnlaceDePago, inicial);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg">Generar un enlace de pago (MercadoPago)</summary>
      <form action={enviar} className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Cliente</span>
          <select name="clienteId" required className="input">
            <option value="">Elegir…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Importe</span>
          <input name="importe" type="number" step="0.01" min="0.01" required className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Concepto</span>
          <input name="concepto" required placeholder="Pensión box · Malbec · septiembre 2026" className="input" />
        </label>
        {resultado.estado === 'error' && <p className="error sm:col-span-2">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && (
          <p className="helper text-ok sm:col-span-2">
            {resultado.linkPago ? (
              <>Enlace generado: <a href={resultado.linkPago} className="link" target="_blank" rel="noreferrer">{resultado.linkPago}</a></>
            ) : (
              'Pago pendiente registrado; MercadoPago no devolvió un enlace.'
            )}
          </p>
        )}
        <div className="sm:col-span-2">
          <BotonEnviar texto="Generar enlace" variante="sec" tamano="sm" cargando="Generando…" />
        </div>
      </form>
    </details>
  );
}

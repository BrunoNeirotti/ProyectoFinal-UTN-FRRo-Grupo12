'use client';

import { useActionState } from 'react';
import { emitirComprobante } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

interface Cargo {
  id: string;
  concepto: string;
  importe: number;
  periodo: string | null;
}

interface PuntoVentaOpcion {
  id: string;
  numero: number;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

/** Un comprobante por cliente: elegís qué cargos entran, el resto queda pendiente para otro. */
export function FormularioEmitir({
  clienteId,
  nombreCliente,
  cargos,
  puntosVenta,
}: {
  clienteId: string;
  nombreCliente: string;
  cargos: Cargo[];
  puntosVenta: PuntoVentaOpcion[];
}) {
  const [resultado, enviar] = useActionState(emitirComprobante, inicial);
  const total = cargos.reduce((acc, c) => acc + c.importe, 0);

  return (
    <details className="card p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-fg">
        <span>{nombreCliente}</span>
        <span className="tnum text-fg-muted">{cargos.length} cargo{cargos.length === 1 ? '' : 's'} · {formatoDinero(total)}</span>
      </summary>
      <form action={enviar} className="mt-3 space-y-3">
        <input type="hidden" name="clienteId" value={clienteId} />
        <ul className="space-y-1 text-sm">
          {cargos.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <input type="checkbox" name="movimientoIds" value={c.id} defaultChecked />
              <span className="flex-1">{c.concepto}</span>
              <span className="tnum text-fg-muted">{formatoDinero(c.importe)}</span>
            </li>
          ))}
        </ul>
        <label className="block max-w-xs">
          <span className="label">Punto de venta</span>
          <select name="puntoVentaId" required className="input">
            {puntosVenta.map((p) => (
              <option key={p.id} value={p.id}>{String(p.numero).padStart(4, '0')}</option>
            ))}
          </select>
        </label>
        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok">Comprobante emitido.</p>}
        <BotonEnviar texto="Emitir comprobante" variante="sec" tamano="sm" cargando="Emitiendo…" />
      </form>
    </details>
  );
}

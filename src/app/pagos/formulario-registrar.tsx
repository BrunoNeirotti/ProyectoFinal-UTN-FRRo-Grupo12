'use client';

import { useActionState } from 'react';
import { registrarPagoManual } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

interface ClienteOpcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

/** Transferencia, efectivo o cheque: el administrador ya tiene la plata en mano, así que queda acreditado de una. */
export function FormularioRegistrarPago({ clientes }: { clientes: ClienteOpcion[] }) {
  const [resultado, enviar] = useActionState(registrarPagoManual, inicial);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg">Registrar un pago manual</summary>
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
          <span className="label">Medio</span>
          <select name="medio" required defaultValue="transferencia" className="input">
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
            <option value="cheque">Cheque</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Importe</span>
          <input name="importe" type="number" step="0.01" min="0.01" required className="input" />
        </label>
        <label className="block">
          <span className="label">Referencia (opcional)</span>
          <input name="referenciaExterna" placeholder="Nº de operación o de cheque" className="input" />
        </label>
        {resultado.estado === 'error' && <p className="error sm:col-span-2">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-2">Pago registrado y acreditado.</p>}
        <div className="sm:col-span-2">
          <BotonEnviar texto="Registrar pago" variante="sec" tamano="sm" />
        </div>
      </form>
    </details>
  );
}

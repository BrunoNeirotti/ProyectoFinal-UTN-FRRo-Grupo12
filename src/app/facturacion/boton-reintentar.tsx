'use client';

import { useActionState } from 'react';
import { reintentarComprobante } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function BotonReintentar({ comprobanteId }: { comprobanteId: string }) {
  const [resultado, enviar] = useActionState(reintentarComprobante, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="comprobanteId" value={comprobanteId} />
      <button type="submit" className="btn btn-sec btn-sm">Reintentar</button>
      {resultado.estado === 'error' && <p className="error text-xs">{resultado.mensaje}</p>}
    </form>
  );
}

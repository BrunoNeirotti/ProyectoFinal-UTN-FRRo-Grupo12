'use client';

import { useActionState } from 'react';
import { imputarPago } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

/** Imputar un pago acreditado a la cuenta corriente del cliente (EI). */
export function BotonImputar({ pagoId }: { pagoId: string }) {
  const [resultado, enviar] = useActionState(imputarPago, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="pagoId" value={pagoId} />
      <button type="submit" className="btn btn-sec btn-sm">Imputar</button>
      {resultado.estado === 'error' && <p className="error text-xs">{resultado.mensaje}</p>}
    </form>
  );
}

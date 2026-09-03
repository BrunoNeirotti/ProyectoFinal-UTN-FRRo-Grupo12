'use client';

import { useActionState } from 'react';
import { generarCargos, type ResultadoDeCargos } from './acciones';
import { BotonEnviar } from '../botones';

const inicial: ResultadoDeCargos = { estado: 'inicial' };

function primerDiaDeEsteMes() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
}

export function FormularioCargos() {
  const [resultado, enviar] = useActionState(generarCargos, inicial);

  return (
    <form action={enviar} className="card flex flex-wrap items-end gap-3 p-4">
      <label className="block">
        <span className="label">Generar cargos del período</span>
        <input name="periodo" type="date" defaultValue={primerDiaDeEsteMes()} className="input" />
      </label>
      <BotonEnviar texto="Generar" variante="sec" cargando="Generando…" />

      {resultado.estado === 'ok' && (
        <p className="helper w-full text-ok">
          {resultado.generados} cargo{resultado.generados === 1 ? '' : 's'} generado{resultado.generados === 1 ? '' : 's'}
          {resultado.omitidos > 0 && `, ${resultado.omitidos} ya existía${resultado.omitidos === 1 ? '' : 'n'}`}.
          {resultado.sinTarifa.length > 0 && (
            <span className="text-warn"> Sin tarifa vigente: {resultado.sinTarifa.join(', ')}.</span>
          )}
        </p>
      )}
      {resultado.estado === 'error' && <p className="error w-full">{resultado.mensaje}</p>}
    </form>
  );
}

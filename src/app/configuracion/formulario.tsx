'use client';

import { useActionState } from 'react';
import type { Clave, ValorParametro } from '@/lib/parametros';
import { guardarReglas, type ResultadoDeGuardado } from './acciones';
import { BotonEnviar } from '../botones';

interface ParametroVisible {
  clave: Clave;
  etiqueta: string;
  ayuda: string;
  tipo: 'entero' | 'decimal' | 'booleano' | 'texto';
  valor: ValorParametro;
  sinValor: boolean;
}

const INICIAL: ResultadoDeGuardado = { estado: 'inicial' };

/**
 * Formulario de las reglas del establecimiento.
 *
 * La ayuda de cada parámetro se muestra siempre y no detrás de un ícono: dice
 * **qué se rompe si se cambia**, y ese es justamente el dato que alguien
 * necesita antes de tocar el valor, no después.
 */
export function FormularioDeReglas({ parametros }: { parametros: ParametroVisible[] }) {
  const [resultado, enviar] = useActionState(guardarReglas, INICIAL);

  return (
    <form action={enviar} className="mt-4">
      <div className="grid gap-4 md:grid-cols-2">
        {parametros.map((p) => (
          <div key={p.clave} className="rounded-lg border border-surface-border p-4">
            <label htmlFor={p.clave} className="label">{p.etiqueta}</label>

            <Campo parametro={p} />

            <p className="helper">{p.ayuda}</p>

            {p.sinValor && <p className="mt-1 text-xs text-warn">Sin valor: la función asociada queda inactiva.</p>}
          </div>
        ))}
      </div>

      {resultado.estado === 'error' && <p role="alert" className="error mt-4">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p role="status" className="helper mt-4 text-ok">Se guardaron {resultado.guardados} reglas.</p>
      )}

      <div className="mt-4">
        <BotonEnviar texto="Guardar cambios" />
      </div>
    </form>
  );
}

function Campo({ parametro: p }: { parametro: ParametroVisible }) {
  if (p.tipo === 'booleano') {
    return (
      <select id={p.clave} name={p.clave} defaultValue={String(p.valor === true)} className="input tnum">
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (p.clave === 'mora_aplicacion') {
    return (
      <select id={p.clave} name={p.clave} defaultValue={String(p.valor ?? 'asistida')} className="input tnum">
        <option value="asistida">Asistida: el sistema propone y una persona confirma</option>
        <option value="automatica">Automática: se imputa sin confirmación</option>
      </select>
    );
  }

  return (
    <input
      id={p.clave}
      name={p.clave}
      type={p.tipo === 'texto' ? 'text' : 'number'}
      step={p.tipo === 'decimal' ? '0.01' : '1'}
      defaultValue={p.valor === null ? '' : String(p.valor)}
      // El único que puede quedar vacío es la tasa de mora (RN-09).
      placeholder={p.clave === 'mora_tasa_mensual' ? 'Sin definir' : undefined}
      className="input tnum"
    />
  );
}

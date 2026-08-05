'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { Clave, ValorParametro } from '@/lib/parametros';
import { guardarReglas, type ResultadoDeGuardado } from './acciones';

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
    <form action={enviar} className="mt-4 space-y-4">
      {parametros.map((p) => (
        <div
          key={p.clave}
          className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm"
        >
          <label htmlFor={p.clave} className="block font-medium text-fg">
            {p.etiqueta}
          </label>

          <Campo parametro={p} />

          <p className="mt-1.5 text-sm text-fg-muted">{p.ayuda}</p>

          {p.sinValor && (
            <p className="mt-1 text-sm text-warn">Sin valor: la función asociada queda inactiva.</p>
          )}
        </div>
      ))}

      {resultado.estado === 'error' && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">
          {resultado.mensaje}
        </p>
      )}
      {resultado.estado === 'ok' && (
        <p role="status" className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok">
          Se guardaron {resultado.guardados} reglas.
        </p>
      )}

      <BotonGuardar />
    </form>
  );
}

function Campo({ parametro: p }: { parametro: ParametroVisible }) {
  const comun =
    'mt-2 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-fg tnum';

  if (p.tipo === 'booleano') {
    return (
      <select id={p.clave} name={p.clave} defaultValue={String(p.valor === true)} className={comun}>
        <option value="true">Sí</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (p.clave === 'mora_aplicacion') {
    return (
      <select id={p.clave} name={p.clave} defaultValue={String(p.valor ?? 'asistida')} className={comun}>
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
      className={comun}
    />
  );
}

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Guardando…' : 'Guardar cambios'}
    </button>
  );
}

'use client';

import { useActionState, useState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';
import { aplicarCiclo, omitirCiclo, programarCiclo } from './acciones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export const TIPO_TEXTO = {
  desparasitacion: 'Desparasitación',
  vacunacion: 'Vacunación',
  herrador: 'Herrador',
  veterinario: 'Veterinario',
  otro: 'Otro',
} as const;

export type TipoSanitario = keyof typeof TIPO_TEXTO;

export interface CaballoOpcion {
  id: string;
  nombre: string;
  enTratamiento: boolean;
}

function Aviso({ resultado, exito }: { resultado: ResultadoDeGuardado; exito: string }) {
  if (resultado.estado === 'error') return <p className="error mt-2">{resultado.mensaje}</p>;
  if (resultado.estado === 'ok') {
    return (
      <p className="mt-2 text-sm text-ok">
        {exito} ({resultado.guardados}).
      </p>
    );
  }
  return null;
}

/**
 * Programación de un ciclo para varios caballos (CUS04, camino básico).
 *
 * El lote se elige con casillas y no con un «todos» implícito: la razón
 * corriente para excluir a un animal es una indicación veterinaria, y una
 * pantalla que marca a todos por omisión hace que esa exclusión dependa de que
 * alguien se acuerde de destildar.
 */
export function FormularioProgramar({ caballos }: { caballos: CaballoOpcion[] }) {
  const [resultado, accion] = useActionState(programarCiclo, inicial);
  const [elegidos, setElegidos] = useState<ReadonlySet<string>>(new Set());
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="card p-5">
      <h2 className="font-serif text-lg">Programar un ciclo</h2>
      <p className="helper mt-1">
        Queda previsto hasta que se registre la aplicación. Un ciclo previsto no dispara alertas de
        vencimiento: ya está agendado.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="label">
          Tipo
          <select className="input" name="tipo" defaultValue="desparasitacion" required>
            {Object.entries(TIPO_TEXTO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Fecha prevista
          <input className="input" type="date" name="fecha" defaultValue={hoy} required />
        </label>
        <label className="label">
          Producto
          <input className="input" type="text" name="producto" placeholder="Ivermectina" />
        </label>
        <label className="label">
          Dosis
          <input className="input" type="text" name="dosis" placeholder="1 ml / 50 kg" />
        </label>
        <label className="label sm:col-span-2">
          Profesional
          <input className="input" type="text" name="profesional" />
        </label>
        <label className="label sm:col-span-2">
          Observaciones
          <input className="input" type="text" name="observaciones" />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="label">Caballos ({elegidos.size} elegidos)</legend>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {caballos.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="caballo"
                value={c.id}
                checked={elegidos.has(c.id)}
                onChange={() =>
                  setElegidos((previos) => {
                    const siguiente = new Set(previos);
                    if (siguiente.has(c.id)) siguiente.delete(c.id);
                    else siguiente.add(c.id);
                    return siguiente;
                  })
                }
              />
              {c.nombre}
              {c.enTratamiento && <span className="badge badge-warn">en tratamiento</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <Aviso resultado={resultado} exito="Ciclo programado" />

      <div className="mt-4">
        <BotonEnviar texto="Programar" cargando="Programando…" />
      </div>
    </form>
  );
}

/** Cierra un ciclo previsto con lo efectivamente aplicado. */
export function FormularioAplicar({
  eventoId,
  caballoId,
  producto,
  dosis,
}: {
  eventoId: string;
  caballoId: string;
  producto: string | null;
  dosis: string | null;
}) {
  const [resultado, accion] = useActionState(aplicarCiclo, inicial);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="mt-3 border-t border-[var(--surface-border)] pt-3">
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="caballoId" value={caballoId} />

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="label">
          Aplicado el
          <input className="input" type="date" name="fecha" defaultValue={hoy} required />
        </label>
        <label className="label">
          Producto
          <input className="input" type="text" name="producto" defaultValue={producto ?? ''} />
        </label>
        <label className="label">
          Dosis
          <input className="input" type="text" name="dosis" defaultValue={dosis ?? ''} />
        </label>
        <label className="label">
          Próxima
          <input className="input" type="date" name="proximaFecha" />
        </label>
        <label className="label sm:col-span-2">
          Profesional
          <input className="input" type="text" name="profesional" />
        </label>
        <label className="label">
          Costo
          <input className="input tnum" type="text" inputMode="decimal" name="costo" />
        </label>
        <label className="label">
          Observaciones
          <input className="input" type="text" name="observaciones" />
        </label>
      </div>

      <Aviso resultado={resultado} exito="Aplicación registrada" />

      <div className="mt-3">
        <BotonEnviar texto="Registrar la aplicación" cargando="Registrando…" tamano="sm" />
      </div>
    </form>
  );
}

/**
 * Omite un ciclo previsto.
 *
 * El motivo es obligatorio en el procedimiento y también acá: la razón habitual
 * de saltear a un animal es clínica -una yegua preñada, un caballo medicado- y
 * eso hay que poder leerlo el ciclo siguiente.
 */
export function FormularioOmitir({
  eventoId,
  caballoId,
}: {
  eventoId: string;
  caballoId: string;
}) {
  const [resultado, accion] = useActionState(omitirCiclo, inicial);

  return (
    <form action={accion} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="caballoId" value={caballoId} />
      <label className="label min-w-56 flex-1">
        Motivo de la omisión
        <input
          className="input"
          type="text"
          name="motivo"
          required
          placeholder="indicación veterinaria, preñez…"
        />
      </label>
      <BotonEnviar texto="No aplicar" cargando="Guardando…" variante="sec" tamano="sm" />
      <Aviso resultado={resultado} exito="Ciclo omitido" />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearInstalacion, modificarInstalacion } from './acciones-instalaciones';
import type { ResultadoDeGuardado } from './acciones';

export interface InstalacionVisible {
  id: string;
  nombre: string;
  tipo: 'box' | 'piquete' | 'pista' | 'picadero';
  capacidad: number;
  activo: boolean;
}

const TIPOS = { box: 'Box', piquete: 'Piquete', pista: 'Pista', picadero: 'Picadero' } as const;
const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg tnum';

export function SeccionInstalaciones({ instalaciones }: { instalaciones: InstalacionVisible[] }) {
  const resumen = (['box', 'piquete', 'pista', 'picadero'] as const).map((tipo) => ({
    tipo,
    total: instalaciones.filter((i) => i.tipo === tipo).length,
  }));

  return (
    <section className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
      <h2 className="font-serif text-xl text-fg">Instalaciones</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Boxes y pistas viven en el mismo catálogo a propósito: los dos son recursos escasos sobre
        los que hay que detectar conflictos de agenda.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {resumen.map((r) => (
          <div key={r.tipo} className="rounded-lg border border-surface-border p-3">
            <p className="text-xs text-fg-muted">{TIPOS[r.tipo]}</p>
            <p className="font-serif text-2xl tnum text-fg">{r.total}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Instalaciones con su tipo y capacidad.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="py-2 pr-3 font-medium">Nombre</th>
              <th className="py-2 pr-3 font-medium">Tipo</th>
              <th className="py-2 pr-3 text-right font-medium">Capacidad</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {instalaciones.map((i) => (
              <FilaInstalacion key={i.id} instalacion={i} />
            ))}
            {instalaciones.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-fg-muted">
                  Todavía no hay instalaciones cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <FormularioNuevaInstalacion />
      </div>
    </section>
  );
}

function FilaInstalacion({ instalacion: i }: { instalacion: InstalacionVisible }) {
  return (
    <tr className={`border-b border-surface-border ${i.activo ? '' : 'text-fg-muted'}`}>
      <td className="py-2 pr-3 font-medium">{i.nombre}</td>
      <td className="py-2 pr-3">{TIPOS[i.tipo]}</td>
      <td className="py-2 pr-3 text-right">{i.capacidad}</td>
      <td className="py-2">
        <details>
          <summary className="cursor-pointer text-accent-ink">
            {i.activo ? 'Activa' : 'Inactiva'} · editar
          </summary>
          <FormularioEditarInstalacion instalacion={i} />
        </details>
      </td>
    </tr>
  );
}

function FormularioEditarInstalacion({ instalacion: i }: { instalacion: InstalacionVisible }) {
  const [resultado, enviar] = useActionState(modificarInstalacion, inicial);
  return (
    <form action={enviar} className="mt-2 space-y-2 rounded-lg border border-surface-border p-3">
      <input type="hidden" name="instalacionId" value={i.id} />
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" defaultValue={i.nombre} required className={comun} />
      </label>
      <label className="block text-xs text-fg-muted">
        Tipo
        <select name="tipo" defaultValue={i.tipo} className={comun}>
          <option value="box">Box</option>
          <option value="piquete">Piquete</option>
          <option value="pista">Pista</option>
          <option value="picadero">Picadero</option>
        </select>
      </label>
      <label className="block text-xs text-fg-muted">
        Capacidad
        <input name="capacidad" type="number" min="1" defaultValue={i.capacidad} required className={comun} />
      </label>
      <label className="flex items-center gap-2 text-xs text-fg-muted">
        <input type="checkbox" name="activo" value="true" defaultChecked={i.activo} />
        Activa
      </label>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad">{resultado.mensaje}</p>
      )}
      <BotonEnviar texto="Guardar" />
    </form>
  );
}

function FormularioNuevaInstalacion() {
  const [resultado, enviar] = useActionState(crearInstalacion, inicial);
  return (
    <form action={enviar} className="grid gap-2 rounded-lg border border-surface-border p-3 sm:grid-cols-4 sm:items-end">
      <label className="block text-xs text-fg-muted sm:col-span-2">
        Nombre
        <input name="nombre" required placeholder="Box 17" className={comun} />
      </label>
      <label className="block text-xs text-fg-muted">
        Tipo
        <select name="tipo" className={comun}>
          <option value="box">Box</option>
          <option value="piquete">Piquete</option>
          <option value="pista">Pista</option>
          <option value="picadero">Picadero</option>
        </select>
      </label>
      <label className="block text-xs text-fg-muted">
        Capacidad
        <input name="capacidad" type="number" min="1" defaultValue={1} required className={comun} />
      </label>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad sm:col-span-4">{resultado.mensaje}</p>
      )}
      {resultado.estado === 'ok' && (
        <p role="status" className="text-xs text-ok sm:col-span-4">Instalación creada.</p>
      )}
      <div className="sm:col-span-4">
        <BotonEnviar texto="Crear instalación" />
      </div>
    </form>
  );
}

function BotonEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Guardando…' : texto}
    </button>
  );
}

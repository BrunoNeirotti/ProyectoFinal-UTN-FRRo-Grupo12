'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { crearInstalacion, modificarInstalacion } from './acciones-instalaciones';
import { BotonEnviar } from '../botones';
import { Modal } from '../modal';

export interface InstalacionVisible {
  id: string;
  nombre: string;
  tipo: 'box' | 'piquete' | 'pista' | 'picadero';
  capacidad: number;
  activo: boolean;
}

const TIPOS = { box: 'Box', piquete: 'Piquete', pista: 'Pista', picadero: 'Picadero' } as const;
const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function SeccionInstalaciones({ instalaciones }: { instalaciones: InstalacionVisible[] }) {
  const resumen = (['box', 'piquete', 'pista', 'picadero'] as const).map((tipo) => ({
    tipo,
    total: instalaciones.filter((i) => i.tipo === tipo).length,
  }));

  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg text-fg">Instalaciones</h2>
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
        <table className="tbl">
          <caption className="sr-only">Instalaciones con su tipo y capacidad.</caption>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="num">Capacidad</th>
              <th scope="col">Estado</th>
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
    <tr className={i.activo ? '' : 'text-fg-muted'}>
      <td className="font-medium">{i.nombre}</td>
      <td>{TIPOS[i.tipo]}</td>
      <td className="num">{i.capacidad}</td>
      <td>
        <span className={`badge ${i.activo ? 'badge-ok' : ''}`}>{i.activo ? 'Activa' : 'Inactiva'}</span>
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={i.nombre} tamano="sm">
            <FormularioEditarInstalacion instalacion={i} />
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioEditarInstalacion({ instalacion: i }: { instalacion: InstalacionVisible }) {
  const [resultado, enviar] = useActionState(modificarInstalacion, inicial);
  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="instalacionId" value={i.id} />
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" defaultValue={i.nombre} required className="input" />
      </label>
      <label className="block">
        <span className="label">Tipo</span>
        <select name="tipo" defaultValue={i.tipo} className="input">
          <option value="box">Box</option>
          <option value="piquete">Piquete</option>
          <option value="pista">Pista</option>
          <option value="picadero">Picadero</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Capacidad</span>
        <input name="capacidad" type="number" min="1" defaultValue={i.capacidad} required className="input" />
      </label>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="activo" value="true" defaultChecked={i.activo} />
        Activa
      </label>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      <BotonEnviar texto="Guardar" variante="sec" tamano="sm" />
    </form>
  );
}

function FormularioNuevaInstalacion() {
  const [resultado, enviar] = useActionState(crearInstalacion, inicial);
  return (
    <form action={enviar} className="card grid gap-3 p-4 sm:grid-cols-4 sm:items-end">
      <label className="block sm:col-span-2">
        <span className="label">Nombre</span>
        <input name="nombre" required placeholder="Box 17" className="input" />
      </label>
      <label className="block">
        <span className="label">Tipo</span>
        <select name="tipo" className="input">
          <option value="box">Box</option>
          <option value="piquete">Piquete</option>
          <option value="pista">Pista</option>
          <option value="picadero">Picadero</option>
        </select>
      </label>
      <label className="block">
        <span className="label">Capacidad</span>
        <input name="capacidad" type="number" min="1" defaultValue={1} required className="input" />
      </label>
      {resultado.estado === 'error' && <p className="error sm:col-span-4">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-4">Instalación creada.</p>}
      <div className="sm:col-span-4">
        <BotonEnviar texto="Crear instalación" variante="sec" />
      </div>
    </form>
  );
}

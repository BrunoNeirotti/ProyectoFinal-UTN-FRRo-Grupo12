'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearServicio, crearTarifa, modificarServicio } from './acciones-servicios';
import type { ResultadoDeGuardado } from './acciones';

export interface ServicioVisible {
  id: string;
  nombre: string;
  unidad: 'mensual' | 'por_clase' | 'por_evento';
  aplicaA: 'caballo' | 'alumno';
  modalidad: 'individual' | 'grupal' | null;
  activo: boolean;
  tarifaVigente: { importe: number; vigenteDesde: string } | null;
}

const UNIDADES = { mensual: 'Mensual', por_clase: 'Por clase', por_evento: 'Por evento' } as const;

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg tnum';

export function SeccionServicios({ servicios }: { servicios: ServicioVisible[] }) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
      <h2 className="font-serif text-xl text-fg">Servicios y tarifas</h2>
      <p className="mt-1 text-sm text-fg-muted">
        El catálogo que vende el haras. El precio se divide por servicio y no por nivel: actualizar
        un precio crea una tarifa nueva con su fecha de vigencia, nunca pisa la anterior.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Servicios con su tarifa vigente.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="py-2 pr-3 font-medium">Servicio</th>
              <th className="py-2 pr-3 font-medium">Unidad</th>
              <th className="py-2 pr-3 font-medium">Modalidad</th>
              <th className="py-2 pr-3 text-right font-medium">Vigente</th>
              <th className="py-2 pr-3 font-medium">Desde</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {servicios.map((s) => (
              <FilaServicio key={s.id} servicio={s} />
            ))}
            {servicios.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-fg-muted">
                  Todavía no hay servicios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <FormularioNuevoServicio />
        <FormularioNuevaTarifa servicios={servicios} />
      </div>
    </section>
  );
}

function FilaServicio({ servicio: s }: { servicio: ServicioVisible }) {
  return (
    <>
      <tr className={`border-b border-surface-border ${s.activo ? '' : 'text-fg-muted'}`}>
        <td className="py-2 pr-3 font-medium">{s.nombre}</td>
        <td className="py-2 pr-3">{UNIDADES[s.unidad]}</td>
        <td className="py-2 pr-3">{s.modalidad === 'individual' ? 'Individual' : s.modalidad === 'grupal' ? 'Grupal' : '—'}</td>
        <td className="py-2 pr-3 text-right font-medium">
          {s.tarifaVigente ? `$${s.tarifaVigente.importe.toLocaleString('es-AR')}` : 'Sin tarifa'}
        </td>
        <td className="py-2 pr-3">{s.tarifaVigente?.vigenteDesde ?? '—'}</td>
        <td className="py-2">
          <details>
            <summary className="cursor-pointer text-accent-ink">
              {s.activo ? 'Activo' : 'Inactivo'} · editar
            </summary>
            <FormularioEditarServicio servicio={s} />
          </details>
        </td>
      </tr>
    </>
  );
}

function FormularioEditarServicio({ servicio: s }: { servicio: ServicioVisible }) {
  const [resultado, enviar] = useActionState(modificarServicio, inicial);
  return (
    <form action={enviar} className="mt-2 space-y-2 rounded-lg border border-surface-border p-3">
      <input type="hidden" name="servicioId" value={s.id} />
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" defaultValue={s.nombre} required className={comun} />
      </label>
      <label className="block text-xs text-fg-muted">
        Unidad
        <select name="unidad" defaultValue={s.unidad} className={comun}>
          <option value="mensual">Mensual</option>
          <option value="por_clase">Por clase</option>
          <option value="por_evento">Por evento</option>
        </select>
      </label>
      <label className="block text-xs text-fg-muted">
        Modalidad (sólo clases)
        <select name="modalidad" defaultValue={s.modalidad ?? ''} className={comun}>
          <option value="">No aplica</option>
          <option value="individual">Individual</option>
          <option value="grupal">Grupal</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-fg-muted">
        <input type="checkbox" name="activo" value="true" defaultChecked={s.activo} />
        Activo
      </label>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad">{resultado.mensaje}</p>
      )}
      <BotonEnviar texto="Guardar" />
    </form>
  );
}

function FormularioNuevoServicio() {
  const [resultado, enviar] = useActionState(crearServicio, inicial);
  return (
    <form action={enviar} className="space-y-2 rounded-lg border border-surface-border p-3">
      <h3 className="text-sm font-medium text-fg">Nuevo servicio</h3>
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" required placeholder="Clases escuela" className={comun} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-fg-muted">
          Unidad
          <select name="unidad" className={comun}>
            <option value="mensual">Mensual</option>
            <option value="por_clase">Por clase</option>
            <option value="por_evento">Por evento</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Aplica a
          <select name="aplicaA" className={comun}>
            <option value="caballo">Caballo</option>
            <option value="alumno">Alumno</option>
          </select>
        </label>
      </div>
      <label className="block text-xs text-fg-muted">
        Modalidad (sólo clases)
        <select name="modalidad" defaultValue="" className={comun}>
          <option value="">No aplica</option>
          <option value="individual">Individual</option>
          <option value="grupal">Grupal</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-fg-muted">
          Importe inicial
          <input name="importeInicial" type="number" min="0" step="0.01" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Vigente desde
          <input name="vigenteDesde" type="date" required className={comun} />
        </label>
      </div>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad">{resultado.mensaje}</p>
      )}
      {resultado.estado === 'ok' && <p role="status" className="text-xs text-ok">Servicio creado.</p>}
      <BotonEnviar texto="Crear servicio" />
    </form>
  );
}

function FormularioNuevaTarifa({ servicios }: { servicios: ServicioVisible[] }) {
  const [resultado, enviar] = useActionState(crearTarifa, inicial);
  return (
    <form action={enviar} className="space-y-2 rounded-lg border border-surface-border p-3">
      <h3 className="text-sm font-medium text-fg">Nueva tarifa</h3>
      <p className="text-xs text-fg-muted">
        Actualiza el precio de un servicio existente sin pisar la vigencia anterior.
      </p>
      <label className="block text-xs text-fg-muted">
        Servicio
        <select name="servicioId" required className={comun}>
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-fg-muted">
          Importe
          <input name="importe" type="number" min="0" step="0.01" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Vigente desde
          <input name="vigenteDesde" type="date" required className={comun} />
        </label>
      </div>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad">{resultado.mensaje}</p>
      )}
      {resultado.estado === 'ok' && <p role="status" className="text-xs text-ok">Tarifa creada.</p>}
      <BotonEnviar texto="Crear tarifa" />
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

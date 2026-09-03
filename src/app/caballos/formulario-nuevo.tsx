'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearCaballo } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';

interface Opcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

export function FormularioNuevoCaballo({
  propietarios,
  instalaciones,
}: {
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const [resultado, enviar] = useActionState(crearCaballo, inicial);

  return (
    <form action={enviar} className="max-w-2xl space-y-4">
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" required className={comun} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Propietario
          <select name="propietarioId" defaultValue="" className={comun}>
            <option value="">Del haras</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Instalación
          <select name="instalacionId" defaultValue="" className={comun}>
            <option value="">Sin asignar</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Raza
          <input name="raza" className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Sexo
          <select name="sexo" defaultValue="" className={comun}>
            <option value="">Sin especificar</option>
            <option value="macho">Macho</option>
            <option value="macho_castrado">Macho castrado</option>
            <option value="hembra">Hembra</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Pelaje
          <input name="pelaje" className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Peso (kg)
          <input name="pesoKg" type="number" min="0" step="0.1" className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Fecha de nacimiento
          <input name="fechaNacimiento" type="date" className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Fecha de ingreso
          <input name="fechaIngreso" type="date" className={comun} />
        </label>
      </div>

      {resultado.estado === 'error' && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">
          {resultado.mensaje}
        </p>
      )}

      <BotonEnviar />
    </form>
  );
}

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Creando…' : 'Crear caballo'}
    </button>
  );
}

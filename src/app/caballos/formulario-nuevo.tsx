'use client';

import { useActionState } from 'react';
import { crearCaballo } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

interface Opcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function FormularioNuevoCaballo({
  propietarios,
  instalaciones,
}: {
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const [resultado, enviar] = useActionState(crearCaballo, inicial);

  return (
    <form action={enviar} className="max-w-2xl space-y-5">
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" required className="input" />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Propietario</span>
          <select name="propietarioId" defaultValue="" className="input">
            <option value="">Del haras</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Instalación</span>
          <select name="instalacionId" defaultValue="" className="input">
            <option value="">Sin asignar</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Raza</span>
          <input name="raza" className="input" />
        </label>
        <label className="block">
          <span className="label">Sexo</span>
          <select name="sexo" defaultValue="" className="input">
            <option value="">Sin especificar</option>
            <option value="macho">Macho</option>
            <option value="macho_castrado">Macho castrado</option>
            <option value="hembra">Hembra</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Pelaje</span>
          <input name="pelaje" className="input" />
        </label>
        <label className="block">
          <span className="label">Peso (kg)</span>
          <input name="pesoKg" type="number" min="0" step="0.1" className="input" />
        </label>
        <label className="block">
          <span className="label">Fecha de nacimiento</span>
          <input name="fechaNacimiento" type="date" className="input" />
        </label>
        <label className="block">
          <span className="label">Fecha de ingreso</span>
          <input name="fechaIngreso" type="date" className="input" />
        </label>
      </div>

      {resultado.estado === 'error' && (
        <p role="alert" className="error">{resultado.mensaje}</p>
      )}

      <BotonEnviar texto="Crear caballo" cargando="Creando…" />
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { modificarClase, suspenderClase } from '../acciones';
import { NIVELES, type Opcion } from '../formulario-clase';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export interface DatosDeClase {
  claseId: string;
  instructorId: string;
  instalacionId: string;
  fecha: string;
  hora: string;
  duracionMin: number;
  cupo: number | null;
  nivel: string | null;
  esIndividual: boolean;
}

/** Reprogramar: cambia horario, pista, instructor, cupo y nivel. El servicio no. */
export function FormularioModificar({
  clase,
  instructores,
  instalaciones,
}: {
  clase: DatosDeClase;
  instructores: Opcion[];
  instalaciones: Opcion[];
}) {
  const [resultado, enviar] = useActionState(modificarClase, inicial);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg">Reprogramar</summary>
      <form action={enviar} className="mt-3 grid gap-3 sm:grid-cols-3">
        <input type="hidden" name="claseId" value={clase.claseId} />

        <label className="block">
          <span className="label">Instructor</span>
          <select name="instructorId" required defaultValue={clase.instructorId} className="input">
            {instructores.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Instalación</span>
          <select name="instalacionId" required defaultValue={clase.instalacionId} className="input">
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Duración (minutos)</span>
          <input
            name="duracionMin"
            type="number"
            min="15"
            max="480"
            step="5"
            defaultValue={clase.duracionMin}
            required
            className="input"
          />
        </label>

        <label className="block">
          <span className="label">Fecha</span>
          <input name="fecha" type="date" defaultValue={clase.fecha} required className="input" />
        </label>

        <label className="block">
          <span className="label">Hora</span>
          <input name="hora" type="time" defaultValue={clase.hora} required className="input" />
        </label>

        <label className="block">
          <span className="label">Cupo</span>
          <input
            name="cupo"
            type="number"
            min="1"
            max="50"
            defaultValue={clase.cupo ?? ''}
            className="input"
            disabled={clase.esIndividual}
            placeholder={clase.esIndividual ? 'No aplica' : 'Sin límite'}
          />
        </label>

        <label className="block sm:col-span-3">
          <span className="label">Nivel sugerido</span>
          <select name="nivel" className="input" defaultValue={clase.nivel ?? ''}>
            <option value="">Sin nivel</option>
            {NIVELES.map((n) => (
              <option key={n.valor} value={n.valor}>{n.texto}</option>
            ))}
          </select>
        </label>

        {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-3">Clase reprogramada.</p>}

        <div className="sm:col-span-3">
          <BotonEnviar texto="Guardar cambios" variante="sec" tamano="sm" />
        </div>
      </form>
    </details>
  );
}

/**
 * Suspender la clase.
 *
 * El motivo es obligatorio y no es burocracia: es lo que explica el aviso al
 * cliente y lo que después permite leer la temporada. Las inscripciones quedan
 * como están, porque son la lista de a quién hay que avisarle.
 */
export function FormularioSuspender({ claseId }: { claseId: string }) {
  const [resultado, enviar] = useActionState(suspenderClase, inicial);

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-bad">Suspender la clase</summary>
      <form action={enviar} className="mt-3 grid gap-3">
        <input type="hidden" name="claseId" value={claseId} />
        <label className="block">
          <span className="label">Motivo</span>
          <input
            name="motivo"
            required
            minLength={3}
            placeholder="Lluvia, pista anegada, instructor ausente…"
            className="input"
          />
          <p className="helper">Queda registrado en la clase y se informa al cliente.</p>
        </label>

        {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && <p className="helper text-ok">Clase suspendida.</p>}

        <div>
          <BotonEnviar texto="Suspender" variante="sec" tamano="sm" cargando="Suspendiendo…" />
        </div>
      </form>
    </details>
  );
}

'use client';

import { useActionState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import {
  cancelarInscripcion,
  inscribirAlumno,
  type ResultadoDeCancelacion,
  type ResultadoDeInscripcion,
} from '../acciones';
import { BotonEnviar } from '../../botones';

export interface Candidato {
  id: string;
  nombre: string;
  nivel: string | null;
  conContratoVigente: boolean;
  nivelCoincide: boolean;
}

const inicialInscripcion: ResultadoDeInscripcion = { estado: 'inicial' };
const inicialCancelacion: ResultadoDeCancelacion = { estado: 'inicial' };

/**
 * Inscribir un alumno.
 *
 * La lista viene ordenada por el servidor: primero quienes tienen contrato
 * vigente del servicio y nivel acorde. La marca «sin contrato» se muestra en la
 * propia opción para que la advertencia llegue antes de elegir y no después de
 * guardar, aunque el servidor la repita igual.
 */
export function FormularioInscribir({
  claseId,
  candidatos,
  caballos,
  bloqueado,
  motivoBloqueo,
}: {
  claseId: string;
  candidatos: Candidato[];
  caballos: { id: string; nombre: string }[];
  bloqueado: boolean;
  motivoBloqueo: string | null;
}) {
  const [resultado, enviar] = useActionState(inscribirAlumno, inicialInscripcion);

  if (bloqueado) {
    return (
      <p className="helper flex items-center gap-1.5 text-warn">
        <WarningCircle size={14} aria-hidden="true" />
        {motivoBloqueo}
      </p>
    );
  }

  return (
    <form action={enviar} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="claseId" value={claseId} />

      <label className="block sm:col-span-2">
        <span className="label">Alumno</span>
        <select name="alumnoId" required className="input">
          <option value="">Elegir…</option>
          {candidatos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.conContratoVigente ? '' : ' · sin contrato vigente'}
              {c.nivelCoincide ? ' · nivel acorde' : ''}
            </option>
          ))}
        </select>
        {candidatos.length === 0 && <p className="helper">No quedan alumnos activos por inscribir.</p>}
      </label>

      <label className="block">
        <span className="label">Caballo previsto</span>
        <select name="caballoId" className="input" defaultValue="">
          <option value="">Sin asignar</option>
          {caballos.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && resultado.advertencia && (
        <p className="helper flex items-start gap-1.5 text-warn sm:col-span-3">
          <WarningCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {resultado.advertencia}
        </p>
      )}
      {resultado.estado === 'ok' && !resultado.advertencia && (
        <p className="helper text-ok sm:col-span-3">Alumno inscripto.</p>
      )}

      <div className="sm:col-span-3">
        <BotonEnviar texto="Inscribir" variante="sec" tamano="sm" cargando="Inscribiendo…" />
      </div>
    </form>
  );
}

/** Cancelar una inscripción. Fuera de término se registra igual, y se dice. */
export function BotonCancelarInscripcion({
  claseId,
  inscripcionId,
}: {
  claseId: string;
  inscripcionId: string;
}) {
  const [resultado, enviar] = useActionState(cancelarInscripcion, inicialCancelacion);

  return (
    <form action={enviar}>
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="inscripcionId" value={inscripcionId} />
      <button type="submit" className="link text-xs text-accent-ink">Cancelar</button>

      {resultado.estado === 'error' && <p className="error text-xs">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && !resultado.enTermino && (
        <p className="helper text-xs text-warn">
          Fuera de término: se pedía avisar con {resultado.diasMinimos} días.
        </p>
      )}
    </form>
  );
}

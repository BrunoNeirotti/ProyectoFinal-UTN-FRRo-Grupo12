'use client';

import { useActionState, useState } from 'react';
import { CheckSquare, WarningCircle } from '@phosphor-icons/react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../../botones';
import { corregirAsistencia, guardarPlanilla, type ResultadoDePlanilla } from './acciones';

export interface AlumnoDePlanilla {
  alumnoId: string;
  nombre: string;
  nivel: 'inicial' | 'nivel_1' | 'nivel_2' | 'nivel_3' | null;
  registrada: boolean;
  presente: boolean;
  observaciones: string;
  caballoPropuesto: string | null;
  caballoPrevisto: string | null;
}

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

const inicial: ResultadoDePlanilla = { estado: 'inicial' };

/**
 * Planilla de asistencia de una clase.
 *
 * Dos decisiones del prototipo que gobiernan toda la pantalla:
 *
 *   * **Todos arrancan presentes** y lo que se marca son las ausencias. Una
 *     clase normal se registra sin tocar nada; al revés, el instructor tendría
 *     que dar cinco toques para registrar que vinieron los cinco. Los que ya
 *     tienen fila arrancan como quedaron.
 *   * **El cierre es explícito.** «Guardar» deja la planilla a mitad de camino a
 *     propósito, para el instructor que carga en la pista y termina en el
 *     escritorio; «Cerrar» es lo que da la clase por dictada y la habilita a
 *     facturarse. Un cierre automático al guardar el último alumno cerraría
 *     clases por accidente.
 *
 * El caballo arranca en el previsto al inscribir. Cambiarlo es exactamente el
 * camino 7.c del CUS05 —el caballo previsto no estaba en condiciones— y las dos
 * cifras quedan comparables en el reporte de carga de trabajo.
 */
export function Planilla({
  claseId,
  alumnos,
  caballos,
  bloqueada,
  motivoBloqueo,
}: {
  claseId: string;
  alumnos: AlumnoDePlanilla[];
  caballos: { id: string; nombre: string }[];
  bloqueada: boolean;
  motivoBloqueo: string | null;
}) {
  const [resultado, enviar] = useActionState(guardarPlanilla, inicial);
  const [presentes, setPresentes] = useState<Record<string, boolean>>(
    Object.fromEntries(alumnos.map((a) => [a.alumnoId, a.presente])),
  );

  if (bloqueada) {
    return (
      <p className="helper flex items-center gap-1.5 text-warn">
        <WarningCircle size={14} aria-hidden="true" />
        {motivoBloqueo}
      </p>
    );
  }

  const marcados = alumnos.filter((a) => presentes[a.alumnoId]).length;

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="claseId" value={claseId} />
      <input type="hidden" name="alumnos" value={alumnos.map((a) => a.alumnoId).join(',')} />

      <p className="helper m-0">
        Todos figuran presentes. Marcá sólo las ausencias. {marcados} de {alumnos.length} presentes.
      </p>

      <ul className="space-y-2">
        {alumnos.map((a) => {
          const presente = presentes[a.alumnoId] ?? true;
          const etiqueta = `estado-${a.alumnoId}`;

          return (
            <li key={a.alumnoId} className={`card p-3 ${presente ? '' : 'opacity-60'}`}>
              <input type="hidden" name={`presente-${a.alumnoId}`} value={presente ? 'si' : 'no'} />

              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-fg">{a.nombre}</span>
                  <span className="block text-xs text-fg-muted">
                    {a.nivel ? NIVEL_TEXTO[a.nivel] : 'Sin nivel'}
                    {a.registrada ? ' · ya registrado' : ''}
                  </span>
                </span>
                <span
                  id={etiqueta}
                  className={`text-xs font-medium ${presente ? 'text-ok' : 'text-bad'}`}
                >
                  {presente ? 'Presente' : 'Ausente'}
                </span>
                <button
                  type="button"
                  className="switch"
                  role="switch"
                  aria-checked={presente}
                  aria-labelledby={etiqueta}
                  onClick={() => setPresentes((p) => ({ ...p, [a.alumnoId]: !presente }))}
                />
              </div>

              {/* El caballo y la observación sólo tienen sentido si montó. */}
              {presente && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="label">Caballo montado</span>
                    <select
                      name={`caballo-${a.alumnoId}`}
                      className="input py-1.5 text-sm"
                      defaultValue={a.caballoPropuesto ?? ''}
                    >
                      <option value="">Sin asignar</option>
                      {caballos.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {a.caballoPrevisto && (
                      <span className="helper">Previsto: {a.caballoPrevisto}</span>
                    )}
                  </label>

                  <label className="block">
                    <span className="label">Progreso</span>
                    <input
                      type="text"
                      name={`obs-${a.alumnoId}`}
                      className="input py-1.5 text-sm"
                      maxLength={1000}
                      defaultValue={a.observaciones}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'guardada' && (
        <p className="helper text-ok">
          Guardado: {resultado.presentes} presentes y {resultado.ausentes} ausentes.
          {resultado.faltan > 0 && ` Faltan ${resultado.faltan} para poder cerrar.`}
        </p>
      )}
      {resultado.estado === 'cerrada' && (
        <p className="helper text-ok">
          Asistencia cerrada: {resultado.presentes} presentes y {resultado.ausentes} ausentes. La
          clase queda dictada.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <BotonEnviar
          texto="Cerrar asistencia"
          cargando="Cerrando…"
          name="accion"
          value="cerrar"
        />
        <BotonEnviar
          texto="Guardar sin cerrar"
          variante="sec"
          name="accion"
          value="guardar"
        />
      </div>
      <p className="helper flex items-center gap-1.5">
        <CheckSquare size={14} aria-hidden="true" />
        Hasta cerrarla, la clase no se factura.
      </p>
    </form>
  );
}

const inicialCorreccion: ResultadoDeGuardado = { estado: 'inicial' };

/**
 * Corregir una fila de una clase ya dictada.
 *
 * Va plegada dentro de la fila y no como una planilla editable entera: sobre una
 * clase cerrada, poder reescribir todo de una vez es indistinguible de volver a
 * tomar la asistencia de memoria una semana después. Corregir es enmendar un
 * dato puntual, y la traza de auditoría guarda cómo estaba antes.
 */
export function Correccion({
  claseId,
  asistenciaId,
  presente,
  caballoId,
  observaciones,
  caballos,
}: {
  claseId: string;
  asistenciaId: string;
  presente: boolean;
  caballoId: string | null;
  observaciones: string;
  caballos: { id: string; nombre: string }[];
}) {
  const [resultado, enviar] = useActionState(corregirAsistencia, inicialCorreccion);

  return (
    <details>
      <summary className="link cursor-pointer text-xs text-accent-ink">Corregir</summary>
      <form action={enviar} className="mt-2 grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="claseId" value={claseId} />
        <input type="hidden" name="asistenciaId" value={asistenciaId} />

        <label className="block">
          <span className="label">Asistió</span>
          <select name="presente" className="input py-1.5 text-sm" defaultValue={presente ? 'si' : 'no'}>
            <option value="si">Presente</option>
            <option value="no">Ausente</option>
          </select>
        </label>

        <label className="block">
          <span className="label">Caballo montado</span>
          <select name="caballoId" className="input py-1.5 text-sm" defaultValue={caballoId ?? ''}>
            <option value="">Sin asignar</option>
            {caballos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Progreso</span>
          <input
            type="text"
            name="observaciones"
            className="input py-1.5 text-sm"
            maxLength={1000}
            defaultValue={observaciones}
          />
        </label>

        {/*
          No hay cartel de «corregido»: al guardar, la fila de arriba pasa a
          mostrar el valor nuevo y este formulario se vuelve a montar con él,
          que es una confirmación más duradera que un texto que desaparece al
          recargar. El error sí queda, porque en ese caso no cambió nada.
        */}
        {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}

        <div className="sm:col-span-3">
          <BotonEnviar texto="Guardar la corrección" variante="sec" tamano="sm" />
        </div>
      </form>
    </details>
  );
}

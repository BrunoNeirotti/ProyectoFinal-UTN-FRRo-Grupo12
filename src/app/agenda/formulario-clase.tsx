'use client';

import { useActionState, useState } from 'react';
import {
  programarClase,
  verificarDisponibilidad,
  type ResultadoDeDisponibilidad,
} from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

export interface Opcion {
  id: string;
  nombre: string;
}

export interface ServicioDeClase extends Opcion {
  modalidad: 'individual' | 'grupal' | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const inicialDisponibilidad: ResultadoDeDisponibilidad = { estado: 'inicial' };

export const NIVELES = [
  { valor: 'inicial', texto: 'Inicial' },
  { valor: 'nivel_1', texto: 'Nivel 1' },
  { valor: 'nivel_2', texto: 'Nivel 2' },
  { valor: 'nivel_3', texto: 'Nivel 3' },
] as const;

/**
 * Alta de clase.
 *
 * El cupo aparece y desaparece según la modalidad del servicio elegido (RN-14):
 * en una clase individual no es que valga uno, es que la pregunta no tiene
 * sentido, y un campo deshabilitado explica eso mejor que un valor fijo.
 *
 * La verificación de disponibilidad es un botón aparte y no una validación al
 * vuelo: cuesta una consulta y el instructor sabe cuándo la necesita.
 */
export function FormularioDeClase({
  servicios,
  instructores,
  instalaciones,
  fechaSugerida,
}: {
  servicios: ServicioDeClase[];
  instructores: Opcion[];
  instalaciones: Opcion[];
  fechaSugerida: string;
}) {
  const [resultado, enviar] = useActionState(programarClase, inicial);
  const [disponibilidad, verificar] = useActionState(
    verificarDisponibilidad,
    inicialDisponibilidad,
  );
  const [servicioId, setServicioId] = useState('');

  const modalidad = servicios.find((s) => s.id === servicioId)?.modalidad ?? null;
  const esIndividual = modalidad === 'individual';

  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium text-fg">Programar una clase</summary>

      <form action={enviar} className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="label">Servicio</span>
          <select
            name="servicioId"
            required
            className="input"
            value={servicioId}
            onChange={(e) => setServicioId(e.target.value)}
          >
            <option value="">Elegir…</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.modalidad === 'individual' ? 'individual' : 'grupal'}
              </option>
            ))}
          </select>
          {servicios.length === 0 && (
            <p className="helper">
              No hay servicios de clase con modalidad declarada. Se cargan en Configuración.
            </p>
          )}
        </label>

        <label className="block">
          <span className="label">Instructor</span>
          <select name="instructorId" required className="input">
            <option value="">Elegir…</option>
            {instructores.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label">Instalación</span>
          <select name="instalacionId" required className="input">
            <option value="">Elegir…</option>
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
            defaultValue={60}
            required
            className="input"
          />
        </label>

        <label className="block">
          <span className="label">Fecha</span>
          <input name="fecha" type="date" defaultValue={fechaSugerida} required className="input" />
        </label>

        <label className="block">
          <span className="label">Hora</span>
          <input name="hora" type="time" defaultValue="09:00" required className="input" />
        </label>

        <label className="block">
          <span className="label">Cupo</span>
          <input
            name="cupo"
            type="number"
            min="1"
            max="50"
            className="input"
            disabled={esIndividual}
            placeholder={esIndividual ? 'No aplica' : 'Sin límite'}
          />
          <p className="helper">
            {esIndividual
              ? 'La clase individual admite un solo alumno (RN-14).'
              : 'Vacío: sin control de cupo.'}
          </p>
        </label>

        <label className="block sm:col-span-2">
          <span className="label">Nivel sugerido (opcional)</span>
          <select name="nivel" className="input" defaultValue="">
            <option value="">Sin nivel</option>
            {NIVELES.map((n) => (
              <option key={n.valor} value={n.valor}>{n.texto}</option>
            ))}
          </select>
          <p className="helper">Orienta a quién inscribir; no restringe (RN-15).</p>
        </label>

        {disponibilidad.estado === 'libre' && (
          <p className="helper text-ok sm:col-span-3">
            La instalación y el instructor están libres en ese horario.
          </p>
        )}
        {disponibilidad.estado === 'ocupado' && (
          <p className="error sm:col-span-3">{disponibilidad.mensaje}</p>
        )}
        {disponibilidad.estado === 'error' && (
          <p className="error sm:col-span-3">{disponibilidad.mensaje}</p>
        )}
        {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}
        {resultado.estado === 'ok' && (
          <p className="helper text-ok sm:col-span-3">Clase programada.</p>
        )}

        {/*
          Los dos botones envían el mismo formulario con los mismos campos: el
          de alta por el `action`, el de verificación por su `formAction`. Así
          se consulta la disponibilidad de lo que está escrito, sin duplicar el
          formulario ni obligar a cargarlo dos veces.
        */}
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <BotonEnviar texto="Programar clase" tamano="sm" cargando="Programando…" />
          <button type="submit" formAction={verificar} className="btn btn-sec btn-sm">
            Verificar disponibilidad
          </button>
        </div>
      </form>
    </details>
  );
}

'use client';

import { useActionState, useState } from 'react';
import { programarOVerificar, type ResultadoDeAltaDeClase } from './acciones';
import { BotonEnviar } from '../botones';

export interface Opcion {
  id: string;
  nombre: string;
}

export interface ServicioDeClase extends Opcion {
  modalidad: 'individual' | 'grupal' | null;
}

const inicial: ResultadoDeAltaDeClase = { estado: 'inicial' };

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
  const [resultado, enviar] = useActionState(programarOVerificar, inicial);
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
              No hay servicios de clase con modalidad declarada. Se registran en Configuración.
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
          <p className="helper">Orienta la inscripción; no la restringe (RN-15).</p>
        </label>

        {resultado.estado === 'libre' && (
          <p className="helper text-ok sm:col-span-3">
            La instalación y el instructor están libres en ese horario.
          </p>
        )}
        {resultado.estado === 'programada' && (
          <p className="helper text-ok sm:col-span-3">Clase programada.</p>
        )}
        {(resultado.estado === 'ocupado' || resultado.estado === 'error') && (
          <p className="error sm:col-span-3">{resultado.mensaje}</p>
        )}

        {/*
          Los dos botones envían el mismo formulario y la misma acción; lo que
          los distingue es el valor de `accion` que cada uno agrega al
          `FormData`. Así se consulta la disponibilidad de lo que está escrito
          sin duplicar el formulario, y el cartel de resultado es uno solo.
        */}
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <BotonEnviar
            texto="Programar clase"
            tamano="sm"
            cargando="Programando…"
            name="accion"
            value="programar"
          />
          <BotonEnviar
            texto="Verificar disponibilidad"
            variante="sec"
            tamano="sm"
            cargando="Verificando…"
            name="accion"
            value="verificar"
          />
        </div>
      </form>
    </details>
  );
}

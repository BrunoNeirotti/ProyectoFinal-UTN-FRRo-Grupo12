'use client';

import { useActionState } from 'react';
import { crearAlumno } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

interface ClienteOpcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function FormularioNuevoAlumno({ clientes }: { clientes: ClienteOpcion[] }) {
  const [resultado, enviar] = useActionState(crearAlumno, inicial);

  return (
    <form action={enviar} className="max-w-2xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nombre</span>
          <input name="nombre" required className="input" />
        </label>
        <label className="block">
          <span className="label">Apellido</span>
          <input name="apellido" required className="input" />
        </label>
        <label className="block">
          <span className="label">Tipo de documento</span>
          <select name="tipoDocumento" className="input">
            <option value="dni">DNI</option>
            <option value="cuit">CUIT</option>
            <option value="cuil">CUIL</option>
            <option value="pasaporte">Pasaporte</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Número de documento</span>
          <input name="numeroDocumento" required className="input" />
        </label>
        <label className="block">
          <span className="label">Fecha de nacimiento</span>
          <input name="fechaNacimiento" type="date" required className="input" />
        </label>
        <label className="block">
          <span className="label">Nivel (opcional, pedagógico)</span>
          <select name="nivel" defaultValue="" className="input">
            <option value="">Sin asignar</option>
            <option value="inicial">Inicial</option>
            <option value="nivel_1">Nivel 1</option>
            <option value="nivel_2">Nivel 2</option>
            <option value="nivel_3">Nivel 3</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="label">Cliente que paga</span>
        <select name="clienteId" required className="input">
          <option value="">Elegir…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">Observaciones médicas (dato sensible, acceso restringido por rol)</span>
        <textarea name="observacionesMedicas" rows={2} className="input" />
      </label>

      <fieldset className="card-accent p-4">
        <legend className="label px-1 text-accent-ink">
          Responsable legal (obligatorio si el alumno es menor de edad, Ley 25.326)
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nombre</span>
            <input name="responsableNombre" className="input" />
          </label>
          <label className="block">
            <span className="label">Apellido</span>
            <input name="responsableApellido" className="input" />
          </label>
          <label className="block">
            <span className="label">Tipo de documento</span>
            <select name="responsableTipoDocumento" defaultValue="dni" className="input">
              <option value="dni">DNI</option>
              <option value="cuit">CUIT</option>
              <option value="cuil">CUIL</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Número de documento</span>
            <input name="responsableNumeroDocumento" className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Consentimiento del tutor otorgado el</span>
            <input name="consentimientoTutorEn" type="date" className="input" />
          </label>
        </div>
      </fieldset>

      {resultado.estado === 'error' && (
        <p role="alert" className="error">{resultado.mensaje}</p>
      )}

      <BotonEnviar texto="Crear alumno" cargando="Creando…" />
    </form>
  );
}

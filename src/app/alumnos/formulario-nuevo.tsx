'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearAlumno } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';

interface ClienteOpcion {
  id: string;
  nombre: string | null;
}

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

export function FormularioNuevoAlumno({ clientes }: { clientes: ClienteOpcion[] }) {
  const [resultado, enviar] = useActionState(crearAlumno, inicial);

  return (
    <form action={enviar} className="max-w-2xl space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Nombre
          <input name="nombre" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Apellido
          <input name="apellido" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Tipo de documento
          <select name="tipoDocumento" className={comun}>
            <option value="dni">DNI</option>
            <option value="cuit">CUIT</option>
            <option value="cuil">CUIL</option>
            <option value="pasaporte">Pasaporte</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Número de documento
          <input name="numeroDocumento" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Fecha de nacimiento
          <input name="fechaNacimiento" type="date" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Nivel (opcional, pedagógico)
          <select name="nivel" defaultValue="" className={comun}>
            <option value="">Sin asignar</option>
            <option value="inicial">Inicial</option>
            <option value="nivel_1">Nivel 1</option>
            <option value="nivel_2">Nivel 2</option>
            <option value="nivel_3">Nivel 3</option>
          </select>
        </label>
      </div>

      <label className="block text-xs text-fg-muted">
        Cliente que paga
        <select name="clienteId" required className={comun}>
          <option value="">Elegir…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-fg-muted">
        Observaciones médicas (dato sensible, acceso restringido por rol)
        <textarea name="observacionesMedicas" rows={2} className={comun} />
      </label>

      <fieldset className="rounded-lg border border-accent bg-accent-soft p-3">
        <legend className="px-1 text-xs font-medium text-accent-ink">
          Responsable legal (obligatorio si el alumno es menor de edad, Ley 25.326)
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-fg-muted">
            Nombre
            <input name="responsableNombre" className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Apellido
            <input name="responsableApellido" className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Tipo de documento
            <select name="responsableTipoDocumento" defaultValue="dni" className={comun}>
              <option value="dni">DNI</option>
              <option value="cuit">CUIT</option>
              <option value="cuil">CUIL</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>
          <label className="block text-xs text-fg-muted">
            Número de documento
            <input name="responsableNumeroDocumento" className={comun} />
          </label>
          <label className="block text-xs text-fg-muted sm:col-span-2">
            Consentimiento del tutor otorgado el
            <input name="consentimientoTutorEn" type="date" className={comun} />
          </label>
        </div>
      </fieldset>

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
      {pending ? 'Creando…' : 'Crear alumno'}
    </button>
  );
}

'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { alternarProveedor, crearProveedor } from '../acciones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function FormularioNuevoProveedor() {
  const [resultado, accion] = useActionState(crearProveedor, inicial);

  return (
    <form action={accion} className="card p-5">
      <h2 className="font-serif text-lg">Nuevo proveedor</h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="label sm:col-span-2">
          Razón social
          <input className="input" type="text" name="razonSocial" maxLength={120} required />
        </label>
        <label className="label">
          CUIT
          <input className="input" type="text" name="cuit" placeholder="30-61234001-9" />
          <span className="helper">Opcional. Once dígitos; los guiones se ignoran.</span>
        </label>
        <label className="label">
          Teléfono
          <input className="input" type="tel" name="telefono" placeholder="+5493414440001" />
        </label>
        <label className="label sm:col-span-2">
          Correo
          <input className="input" type="email" name="email" />
        </label>
      </div>

      <div className="mt-4">
        <BotonEnviar texto="Crear proveedor" />
      </div>

      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="mt-2 text-sm text-ok">Proveedor creado.</p>}
    </form>
  );
}

/** Da de baja o rehabilita. Nunca borra: las órdenes viejas lo referencian. */
export function InterruptorProveedor({
  proveedorId,
  activo,
}: {
  proveedorId: string;
  activo: boolean;
}) {
  const [resultado, accion] = useActionState(alternarProveedor, inicial);

  return (
    <form action={accion}>
      <input type="hidden" name="proveedorId" value={proveedorId} />
      <input type="hidden" name="activo" value={activo ? 'false' : 'true'} />
      <BotonEnviar texto={activo ? 'Desactivar' : 'Reactivar'} variante="sec" tamano="sm" />
      {resultado.estado === 'error' && <p className="error mt-1">{resultado.mensaje}</p>}
    </form>
  );
}

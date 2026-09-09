'use client';

import { useActionState } from 'react';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { cambiarRolUsuario, desactivarUsuario, invitarUsuario } from './acciones-usuarios';
import { BotonEnviar } from '../botones';
import { Modal } from '../modal';

export interface UsuarioVisible {
  id: string;
  rol: 'administrador' | 'instructor' | 'peon' | 'cliente';
  activo: boolean;
  ultimoAccesoEn: string | null;
  persona: { nombre: string; apellido: string; email: string | null } | null;
}

const ROLES = {
  administrador: 'Administrador',
  instructor: 'Instructor',
  peon: 'Peón',
  cliente: 'Cliente',
} as const;

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function SeccionUsuarios({ usuarios }: { usuarios: UsuarioVisible[] }) {
  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg text-fg">Usuarios y roles</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Un usuario con historial no se borra, se desactiva: borrarlo dejaría registros de cuidado y
        asistencias sin autor.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Usuarios del sistema con su rol y último acceso.</caption>
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Último acceso</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {usuarios.map((u) => (
              <FilaUsuario key={u.id} usuario={u} />
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-fg-muted">
                  Todavía no hay usuarios cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <FormularioInvitar />
      </div>
    </section>
  );
}

function FilaUsuario({ usuario: u }: { usuario: UsuarioVisible }) {
  return (
    <tr className={`align-top ${u.activo ? '' : 'text-fg-muted'}`}>
      <td>
        <p className="font-medium">{u.persona ? `${u.persona.apellido}, ${u.persona.nombre}` : '—'}</p>
        <p className="text-xs text-fg-muted">{u.persona?.email ?? ''}</p>
      </td>
      <td>{ROLES[u.rol]}</td>
      <td className="text-xs">{u.ultimoAccesoEn ? new Date(u.ultimoAccesoEn).toLocaleString('es-AR') : 'Nunca'}</td>
      <td>
        <span className={`badge ${u.activo ? 'badge-ok' : ''}`}>{u.activo ? 'Activo' : 'Desactivado'}</span>
        <div className="mt-1.5">
          <Modal etiqueta="Editar" titulo={`${u.persona?.apellido ?? ''}, ${u.persona?.nombre ?? ''}`} tamano="sm">
            <div className="space-y-3">
              <FormularioRol usuario={u} />
              {u.activo && <FormularioDesactivar usuarioId={u.id} />}
            </div>
          </Modal>
        </div>
      </td>
    </tr>
  );
}

function FormularioRol({ usuario: u }: { usuario: UsuarioVisible }) {
  const [resultado, enviar] = useActionState(cambiarRolUsuario, inicial);
  return (
    <form action={enviar} className="flex items-end gap-2">
      <input type="hidden" name="usuarioId" value={u.id} />
      <label className="block">
        <span className="label">Rol</span>
        <select name="rol" defaultValue={u.rol} className="input">
          <option value="administrador">Administrador</option>
          <option value="instructor">Instructor</option>
          <option value="peon">Peón</option>
          <option value="cliente">Cliente</option>
        </select>
      </label>
      <BotonEnviar texto="Guardar rol" variante="sec" tamano="sm" />
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
    </form>
  );
}

function FormularioDesactivar({ usuarioId }: { usuarioId: string }) {
  const [resultado, enviar] = useActionState(desactivarUsuario, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <button type="submit" className="btn btn-gho btn-sm text-bad">Desactivar</button>
      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
    </form>
  );
}

function FormularioInvitar() {
  const [resultado, enviar] = useActionState(invitarUsuario, inicial);
  return (
    <form action={enviar} className="card grid gap-3 p-4 sm:grid-cols-3">
      <h3 className="text-sm font-medium text-fg sm:col-span-3">Invitar usuario</h3>
      <label className="block">
        <span className="label">Nombre</span>
        <input name="nombre" required className="input" />
      </label>
      <label className="block">
        <span className="label">Apellido</span>
        <input name="apellido" required className="input" />
      </label>
      <label className="block">
        <span className="label">Correo</span>
        <input name="email" type="email" required className="input" />
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
        <span className="label">Rol</span>
        <select name="rol" className="input">
          <option value="peon">Peón</option>
          <option value="instructor">Instructor</option>
          <option value="administrador">Administrador</option>
          <option value="cliente">Cliente</option>
        </select>
      </label>
      {resultado.estado === 'error' && <p className="error sm:col-span-3">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok sm:col-span-3">Invitación enviada.</p>}
      <div className="sm:col-span-3">
        <BotonEnviar texto="Invitar" variante="sec" />
      </div>
    </form>
  );
}

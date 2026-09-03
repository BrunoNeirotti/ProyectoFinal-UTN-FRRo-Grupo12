'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { cambiarRolUsuario, desactivarUsuario, invitarUsuario } from './acciones-usuarios';
import type { ResultadoDeGuardado } from './acciones';

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
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

export function SeccionUsuarios({ usuarios }: { usuarios: UsuarioVisible[] }) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
      <h2 className="font-serif text-xl text-fg">Usuarios y roles</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Un usuario con historial no se borra, se desactiva: borrarlo dejaría registros de cuidado y
        asistencias sin autor.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Usuarios del sistema con su rol y último acceso.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="py-2 pr-3 font-medium">Usuario</th>
              <th className="py-2 pr-3 font-medium">Rol</th>
              <th className="py-2 pr-3 font-medium">Último acceso</th>
              <th className="py-2 font-medium">Estado</th>
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
    <tr className={`border-b border-surface-border align-top ${u.activo ? '' : 'text-fg-muted'}`}>
      <td className="py-2 pr-3">
        <p className="font-medium">{u.persona ? `${u.persona.apellido}, ${u.persona.nombre}` : '—'}</p>
        <p className="text-xs text-fg-muted">{u.persona?.email ?? ''}</p>
      </td>
      <td className="py-2 pr-3">{ROLES[u.rol]}</td>
      <td className="py-2 pr-3 text-xs">{u.ultimoAccesoEn ? new Date(u.ultimoAccesoEn).toLocaleString('es-AR') : 'Nunca'}</td>
      <td className="py-2">
        <details>
          <summary className="cursor-pointer text-accent-ink">
            {u.activo ? 'Activo' : 'Desactivado'} · editar
          </summary>
          <div className="mt-2 space-y-2 rounded-lg border border-surface-border p-3">
            <FormularioRol usuario={u} />
            {u.activo && <FormularioDesactivar usuarioId={u.id} />}
          </div>
        </details>
      </td>
    </tr>
  );
}

function FormularioRol({ usuario: u }: { usuario: UsuarioVisible }) {
  const [resultado, enviar] = useActionState(cambiarRolUsuario, inicial);
  return (
    <form action={enviar} className="flex items-end gap-2">
      <input type="hidden" name="usuarioId" value={u.id} />
      <label className="block text-xs text-fg-muted">
        Rol
        <select name="rol" defaultValue={u.rol} className={comun}>
          <option value="administrador">Administrador</option>
          <option value="instructor">Instructor</option>
          <option value="peon">Peón</option>
          <option value="cliente">Cliente</option>
        </select>
      </label>
      <BotonEnviar texto="Guardar rol" />
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad">{resultado.mensaje}</p>
      )}
    </form>
  );
}

function FormularioDesactivar({ usuarioId }: { usuarioId: string }) {
  const [resultado, enviar] = useActionState(desactivarUsuario, inicial);
  return (
    <form action={enviar}>
      <input type="hidden" name="usuarioId" value={usuarioId} />
      <button type="submit" className="text-xs text-bad underline">Desactivar</button>
      {resultado.estado === 'error' && (
        <p role="alert" className="mt-1 text-xs text-bad">{resultado.mensaje}</p>
      )}
    </form>
  );
}

function FormularioInvitar() {
  const [resultado, enviar] = useActionState(invitarUsuario, inicial);
  return (
    <form action={enviar} className="grid gap-2 rounded-lg border border-surface-border p-3 sm:grid-cols-3">
      <h3 className="text-sm font-medium text-fg sm:col-span-3">Invitar usuario</h3>
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" required className={comun} />
      </label>
      <label className="block text-xs text-fg-muted">
        Apellido
        <input name="apellido" required className={comun} />
      </label>
      <label className="block text-xs text-fg-muted">
        Correo
        <input name="email" type="email" required className={comun} />
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
        Rol
        <select name="rol" className={comun}>
          <option value="peon">Peón</option>
          <option value="instructor">Instructor</option>
          <option value="administrador">Administrador</option>
          <option value="cliente">Cliente</option>
        </select>
      </label>
      {resultado.estado === 'error' && (
        <p role="alert" className="text-xs text-bad sm:col-span-3">{resultado.mensaje}</p>
      )}
      {resultado.estado === 'ok' && (
        <p role="status" className="text-xs text-ok sm:col-span-3">Invitación enviada.</p>
      )}
      <div className="sm:col-span-3">
        <BotonEnviar texto="Invitar" />
      </div>
    </form>
  );
}

function BotonEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Guardando…' : texto}
    </button>
  );
}

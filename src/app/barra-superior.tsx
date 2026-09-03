'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { SignOut } from '@phosphor-icons/react';
import { clienteDeNavegador } from '@/lib/supabase/navegador';

const ROLES = {
  administrador: 'Administrador',
  instructor: 'Instructor',
  peon: 'Peón',
  cliente: 'Cliente',
} as const;

export function BarraSuperior({
  nombre,
  apellido,
  rol,
}: {
  nombre: string | null;
  apellido: string | null;
  rol: keyof typeof ROLES;
}) {
  const router = useRouter();
  const [saliendo, iniciarTransicion] = useTransition();

  const iniciales = [nombre?.[0], apellido?.[0]].filter(Boolean).join('').toUpperCase() || '·';
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ') || 'Sin nombre';

  async function cerrarSesion() {
    const supabase = clienteDeNavegador();
    await supabase.auth.signOut();
    iniciarTransicion(() => {
      router.replace('/ingresar');
      router.refresh();
    });
  }

  return (
    <div className="topbar">
      <span className="text-sm text-fg-muted">{ROLES[rol]}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="avatar" aria-hidden="true">{iniciales}</span>
          <span className="hidden text-sm font-medium text-fg sm:inline">{nombreCompleto}</span>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          disabled={saliendo}
          className="ic"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <SignOut size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

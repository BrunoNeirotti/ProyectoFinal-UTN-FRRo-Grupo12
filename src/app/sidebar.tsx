'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Horse, Student, UsersThree, GearSix, Wallet, CreditCard, type Icon } from '@phosphor-icons/react';
import type { Area } from '@/lib/roles';

interface Enlace {
  area: Area;
  href: string;
  texto: string;
  icono: Icon;
}

/**
 * Grupos del sidebar, calcados de `02-sitemap-por-perfil.md`. Un enlace sólo
 * aparece si el rol alcanza su área (mismo criterio que los guardas de tRPC) y
 * si la pantalla ya existe: el sitemap tiene 16 módulos y hoy hay 3.
 */
const GRUPOS: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Gerencia',
    enlaces: [
      { area: 'gerencia', href: '/cobranza', texto: 'Cobranza', icono: Wallet },
      { area: 'gerencia', href: '/pagos', texto: 'Pagos', icono: CreditCard },
    ],
  },
  {
    titulo: 'Clientes y contratos',
    enlaces: [{ area: 'clientes', href: '/clientes', texto: 'Clientes', icono: UsersThree }],
  },
  {
    titulo: 'Enseñanza',
    enlaces: [{ area: 'clientes', href: '/alumnos', texto: 'Alumnos', icono: Student }],
  },
  {
    titulo: 'Bienestar animal',
    enlaces: [{ area: 'bienestar', href: '/caballos', texto: 'Caballos', icono: Horse }],
  },
];

const CONFIGURACION: Enlace = { area: 'configuracion', href: '/configuracion', texto: 'Configuración', icono: GearSix };

export function Sidebar({ areas }: { areas: readonly Area[] }) {
  const pathname = usePathname();
  const esActual = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        <span className="sidebar-mark">R</span>
        RIENDA
      </Link>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        {GRUPOS.map((grupo) => {
          const visibles = grupo.enlaces.filter((e) => areas.includes(e.area));
          if (visibles.length === 0) return null;
          return (
            <div key={grupo.titulo}>
              <p className="sidebar-group">{grupo.titulo}</p>
              {visibles.map((e) => (
                <ItemDeNav key={e.href} enlace={e} actual={esActual(e.href)} />
              ))}
            </div>
          );
        })}

        {areas.includes(CONFIGURACION.area) && (
          <div className="mt-auto">
            <p className="sidebar-group">Sistema</p>
            <ItemDeNav enlace={CONFIGURACION} actual={esActual(CONFIGURACION.href)} />
          </div>
        )}
      </nav>
    </aside>
  );
}

function ItemDeNav({ enlace: e, actual }: { enlace: Enlace; actual: boolean }) {
  const Icono = e.icono;
  return (
    <Link href={e.href} className="nav-item" aria-current={actual ? 'page' : undefined}>
      <Icono size={18} weight={actual ? 'fill' : 'regular'} aria-hidden="true" />
      {e.texto}
    </Link>
  );
}

import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import type { Area } from '@/lib/roles';

/**
 * Barra de navegación mínima.
 *
 * El sidebar denso de la Pantalla 9 en adelante es trabajo de más módulos de
 * los que hay construidos hoy; esto es lo mínimo para que las pantallas que sí
 * existen sean alcanzables sin escribir la URL a mano. Se arma por área del
 * sitemap, no por ruta suelta, para que no haga falta tocar este archivo cada
 * vez que se agregue una pantalla dentro de una misma área.
 */
const ENLACES: { area: Area; href: string; texto: string }[] = [
  { area: 'clientes', href: '/clientes', texto: 'Clientes' },
  { area: 'clientes', href: '/alumnos', texto: 'Alumnos' },
  { area: 'bienestar', href: '/caballos', texto: 'Caballos' },
  { area: 'configuracion', href: '/configuracion', texto: 'Configuración' },
];

export async function Nav() {
  let sesion;
  try {
    sesion = await (await llamador()).quienSoy();
  } catch {
    return null; // sin sesión: el proxy ya se encarga de redirigir a /ingresar
  }

  const visibles = ENLACES.filter((e) => sesion.areas.includes(e.area));
  if (visibles.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className="flex flex-wrap items-center gap-4 border-b border-surface-border bg-surface px-6 py-3"
    >
      <span className="font-serif text-lg text-fg">RIENDA</span>
      {visibles.map((e) => (
        <Link key={e.href} href={e.href} className="text-sm text-fg-muted hover:text-fg">
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}

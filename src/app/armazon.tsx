import type { ReactNode } from 'react';
import { llamador } from '@/lib/trpc/servidor';
import { Sidebar } from './sidebar';
import { BarraSuperior } from './barra-superior';

/**
 * Sidebar y cabecera comparten la misma sesión, así que se resuelve una sola
 * vez acá y se reparte por props. `crearContexto` ya está memoizado por
 * request (`cache()`, ver `server/contexto.ts`); esto evita además la vuelta
 * extra de `quienSoy` (con su propia consulta a `persona`) que salía dos veces
 * por carga de página cuando el sidebar y la cabecera la pedían cada uno por
 * su cuenta.
 */
export async function Armazon({ children }: { children: ReactNode }) {
  let sesion;
  try {
    sesion = await (await llamador()).quienSoy();
  } catch {
    // Sin sesión (p. ej. /ingresar): sin sidebar ni cabecera, sólo la página.
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar areas={sesion.areas} />
      <div className="flex min-w-0 flex-1 flex-col">
        <BarraSuperior nombre={sesion.nombre} apellido={sesion.apellido} rol={sesion.rol} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

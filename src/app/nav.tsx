import { llamador } from '@/lib/trpc/servidor';
import { Sidebar } from './sidebar';

/**
 * Puente entre el servidor (sesión, área por rol) y el sidebar, que necesita
 * ser componente de cliente para resaltar la ruta activa y renderizar los
 * íconos de Phosphor (usan contexto de React, que un Server Component no
 * puede consumir).
 */
export async function Nav() {
  let sesion;
  try {
    sesion = await (await llamador()).quienSoy();
  } catch {
    return null; // sin sesión: el proxy ya se encarga de redirigir a /ingresar
  }

  return <Sidebar areas={sesion.areas} />;
}

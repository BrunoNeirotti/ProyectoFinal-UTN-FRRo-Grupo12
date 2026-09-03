import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';

/**
 * Puerta de entrada. Todavía no hay dashboard (M11), así que en lugar de un
 * placeholder envía a la primera pantalla construida que el rol alcanza — el
 * mismo orden en que aparecen en el sidebar.
 */
export default async function Inicio() {
  const api = await llamador();

  let sesion;
  try {
    sesion = await api.quienSoy();
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'UNAUTHORIZED') redirect('/ingresar');
    throw e;
  }

  if (sesion.areas.includes('clientes')) redirect('/clientes');
  if (sesion.areas.includes('bienestar')) redirect('/caballos');
  if (sesion.areas.includes('configuracion')) redirect('/configuracion');

  redirect('/ingresar');
}

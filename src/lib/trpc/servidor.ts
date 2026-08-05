import 'server-only';
import { crearContexto } from '@/server/contexto';
import { routerApp } from '@/server/routers/_app';

/**
 * Llamador del lado del servidor.
 *
 * Permite que un Server Component consulte los mismos procedimientos que usa el
 * navegador, sin dar una vuelta por la red. Importa que sea el MISMO router:
 * si las pantallas del servidor consultaran la base por su cuenta, se saltearían
 * la validación y los guardas de rol, y las dos vías podrían divergir.
 */
export async function llamador() {
  return routerApp.createCaller(await crearContexto());
}

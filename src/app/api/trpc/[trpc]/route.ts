import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { crearContexto } from '@/server/contexto';
import { routerApp } from '@/server/routers/_app';

/**
 * Único punto de entrada de la API. Todo lo que la aplicación lee o escribe
 * pasa por acá, que es lo que permite tener la validación y el control de rol en
 * un solo lugar en vez de repetidos en cada ruta.
 */
const manejar = (peticion: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: peticion,
    router: routerApp,
    createContext: crearContexto,
    onError({ error, path }) {
      // Los errores del servidor se registran; los de validación y permisos no,
      // porque son respuestas esperables y llenarían el registro de ruido.
      if (error.code === 'INTERNAL_SERVER_ERROR') {
        console.error(`[trpc] ${path ?? '(sin ruta)'}:`, error.cause ?? error.message);
      }
    },
  });

export { manejar as GET, manejar as POST };

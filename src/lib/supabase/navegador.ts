import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para el navegador.
 *
 * Sólo se usa para lo que necesita la sesión del lado del cliente: iniciar y
 * cerrar sesión, y escuchar el cambio de estado de autenticación. Los datos del
 * negocio se piden por tRPC, no desde acá, para que la validación de los bordes
 * y el control de rol pasen siempre por el mismo lugar.
 */
export function clienteDeNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

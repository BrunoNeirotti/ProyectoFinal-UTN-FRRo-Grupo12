import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './tipos-generados';

/**
 * Cliente de Supabase para el servidor, atado a la sesión del usuario.
 *
 * Es el que se usa en todas las consultas de la aplicación, y usa la clave
 * ANÓNIMA a propósito: con ella, cada consulta pasa por las políticas RLS con la
 * identidad de quien la hizo. Es lo que hace que el control de acceso sea real y
 * no una convención.
 */
export async function clienteDeServidor() {
  const almacen = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (nuevas) => {
          try {
            for (const { name, value, options } of nuevas) {
              almacen.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. La renovación
            // del token la hace `proxy.ts`, así que acá se puede ignorar.
          }
        },
      },
    },
  );
}

/**
 * Cliente con la clave de servicio, que SALTA las políticas RLS.
 *
 * Existe sólo para los trabajos programados y los webhooks (M15), que no operan
 * en nombre de ningún usuario: la liquidación mensual del CUS01 tiene que poder
 * leer la cartera completa. La clave nunca se expone al navegador, y por eso no
 * lleva el prefijo `NEXT_PUBLIC_`.
 *
 * Regla: si una función de este módulo aparece en un componente de pantalla, es
 * un error. Las pantallas usan `clienteDeServidor`.
 */
export function clienteDeServicio() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY');

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

import { z } from 'zod';

/**
 * Validación de las variables de entorno.
 *
 * Existe porque el modo de fallar importa: sin esto, olvidarse de completar
 * `.env.local` produce un 500 con un rastro de pila apuntando al cliente de
 * Supabase, que no le dice nada a quien acaba de clonar el repositorio. Con
 * esto, dice qué variable falta.
 *
 * Sólo se validan las que el sistema necesita para arrancar. Las credenciales de
 * las integraciones externas (ARCA, WhatsApp, MercadoPago) se validan en el
 * módulo que las usa: ninguna bloquea el desarrollo, y exigirlas acá impediría
 * levantar el proyecto para trabajar en cualquier otra cosa.
 */
const esquema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: 'NEXT_PUBLIC_SUPABASE_URL tiene que ser la URL del proyecto de Supabase.',
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY no puede estar vacía.'),
});

export type Entorno = z.infer<typeof esquema>;

let cache: Entorno | null = null;

/** Devuelve el entorno validado o corta con un mensaje que se entienda. */
export function entorno(): Entorno {
  if (cache) return cache;

  const resultado = esquema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `  - ${i.message}`).join('\n');
    throw new Error(
      `Faltan variables de entorno o son inválidas:\n${detalle}\n\n` +
        'Copiá `.env.example` a `.env.local` y completalo.',
    );
  }

  cache = resultado.data;
  return cache;
}

/**
 * Si el entorno está completo, sin cortar.
 *
 * Lo usa el proxy: cuando falta configuración conviene dejar pasar hacia una
 * pantalla que lo explique, en lugar de responder 500 en todas las rutas.
 */
export function entornoConfigurado(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

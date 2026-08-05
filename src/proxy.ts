import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { entorno, entornoConfigurado } from '@/lib/entorno';

/**
 * Proxy (lo que hasta Next 15 se llamaba middleware).
 *
 * Hace dos cosas y nada más:
 *
 *   1. **Renueva el token de Supabase**, que es lo único que no puede hacerse
 *      desde un Server Component porque ahí no se pueden escribir cookies.
 *   2. **Redirige de forma optimista** a quien no tiene sesión, para que no vea
 *      el armazón de una pantalla que después va a venir vacía.
 *
 * Lo que NO hace, a propósito: autorizar. La propia documentación de Next lo
 * advierte, y el motivo es bueno: el proxy corre antes de saber qué datos se van
 * a pedir. La autorización vive en las políticas RLS y, como red de fallo
 * temprano, en los guardas de rol de la capa tRPC.
 */

const PUBLICAS = ['/ingresar', '/recuperar-clave', '/api/trpc', '/api/webhooks'];

export async function proxy(peticion: NextRequest) {
  // Sin configuración no hay nada que renovar ni contra qué validar. Se deja
  // pasar para que la aplicación pueda explicar qué falta, en lugar de devolver
  // 500 en todas las rutas con un rastro de pila.
  if (!entornoConfigurado()) return NextResponse.next({ request: peticion });

  let respuesta = NextResponse.next({ request: peticion });

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = entorno();

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => peticion.cookies.getAll(),
        setAll: (nuevas) => {
          for (const { name, value } of nuevas) peticion.cookies.set(name, value);
          respuesta = NextResponse.next({ request: peticion });
          for (const { name, value, options } of nuevas) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Renueva el token si hace falta. No usar `getSession`: no verifica la firma.
  //
  // Si Supabase no responde, se trata como «no hay sesión» en lugar de romper:
  // ante una caída del servicio administrado (riesgo R-11) conviene mostrar la
  // pantalla de ingreso y no un error del servidor en cada ruta.
  let user = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    user = null;
  }

  const ruta = peticion.nextUrl.pathname;
  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

  if (!user && !esPublica) {
    const destino = peticion.nextUrl.clone();
    destino.pathname = '/ingresar';
    // Para poder devolver a la persona a donde iba después de entrar.
    destino.searchParams.set('volver', ruta);
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  // Se excluyen los estáticos y las imágenes: renovar el token en cada ícono es
  // trabajo puro sin efecto.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};

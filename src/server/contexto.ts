import { cache } from 'react';
import { clienteDeServidor } from '@/lib/supabase/servidor';
import type { Rol } from '@/lib/roles';

/**
 * Contexto de cada llamada tRPC: quién está operando y con qué cliente de datos.
 *
 * El rol se lee de la tabla `usuario` y no del token: el token dice quién es la
 * persona, no qué puede hacer. Si el rol viviera en el token, revocarle permisos
 * a alguien no tendría efecto hasta que su sesión venciera.
 *
 * `cache()` lo memoiza por request: el sidebar, la cabecera y la propia pantalla
 * llaman a `llamador()` cada uno por su cuenta, y sin esto cada uno repetía el
 * viaje a Supabase Auth más la consulta a `usuario` — tres veces la misma
 * pregunta en una sola carga de página, cruzando el Atlántico cada vez.
 */
export interface SesionActiva {
  usuarioId: string;
  personaId: string;
  rol: Rol;
}

export type Contexto = Awaited<ReturnType<typeof crearContexto>>;

export const crearContexto = cache(async function crearContexto() {
  const supabase = await clienteDeServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sesion: SesionActiva | null = null;

  if (user) {
    const { data } = await supabase
      .from('usuario')
      .select('id, persona_id, rol, activo')
      .eq('id', user.id)
      .maybeSingle();

    // Un usuario dado de baja conserva su token hasta que vence. Se lo trata
    // como si no tuviera sesión: la baja tiene que surtir efecto ya.
    if (data && data.activo) {
      sesion = {
        usuarioId: data.id as string,
        personaId: data.persona_id as string,
        rol: data.rol as Rol,
      };
    }
  }

  return { supabase, sesion };
});

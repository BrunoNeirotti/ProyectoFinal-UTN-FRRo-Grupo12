import { clienteDeServidor } from '@/lib/supabase/servidor';
import type { Rol } from '@/lib/roles';

/**
 * Contexto de cada llamada tRPC: quién está operando y con qué cliente de datos.
 *
 * El rol se lee de la tabla `usuario` y no del token: el token dice quién es la
 * persona, no qué puede hacer. Si el rol viviera en el token, revocarle permisos
 * a alguien no tendría efecto hasta que su sesión venciera.
 */
export interface SesionActiva {
  usuarioId: string;
  personaId: string;
  rol: Rol;
}

export type Contexto = Awaited<ReturnType<typeof crearContexto>>;

export async function crearContexto() {
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
}

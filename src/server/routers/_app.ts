import { crearRouter, procedimientoAutenticado, procedimientoPublico } from '../trpc';
import { routerParametro } from './parametro';
import { routerUsuario } from './usuario';
import { alcanceDe } from '@/lib/roles';

/**
 * Router raíz.
 *
 * Se arma por módulo y en el orden de prioridad del cronograma. Hoy está M1
 * (acceso, usuarios y configuración); los siguientes se enganchan acá a medida
 * que se construyen.
 */
export const routerApp = crearRouter({
  /** Comprobación de vida. No toca la base ni exige sesión. */
  salud: procedimientoPublico.query(() => ({ ok: true as const })),

  /**
   * Identidad y alcance del usuario actual.
   *
   * Lo consume la navegación para no dibujar accesos que después van a dar
   * `FORBIDDEN`. El alcance sale de la misma tabla que usan los guardas, así que
   * lo que se muestra y lo que se permite no pueden discrepar.
   */
  quienSoy: procedimientoAutenticado.query(({ ctx }) => ({
    usuarioId: ctx.sesion.usuarioId,
    personaId: ctx.sesion.personaId,
    rol: ctx.sesion.rol,
    areas: alcanceDe(ctx.sesion.rol),
  })),

  // --- M1 ---
  parametro: routerParametro,
  usuario: routerUsuario,
});

export type RouterApp = typeof routerApp;

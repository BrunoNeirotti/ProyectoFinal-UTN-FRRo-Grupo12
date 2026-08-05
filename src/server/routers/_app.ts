import { crearRouter, procedimientoAutenticado, procedimientoPublico } from '../trpc';
import { alcanceDe } from '@/lib/roles';

/**
 * Router raíz.
 *
 * Se arma por módulo (M1 acceso, M2 clientes, M3 cuentas corrientes...) y en ese
 * orden, que es el de prioridad del cronograma. Hoy sólo tiene lo que necesitan
 * las bases: verificar que la capa responde y saber quién soy.
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
});

export type RouterApp = typeof routerApp;

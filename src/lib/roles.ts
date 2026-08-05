/**
 * Los cuatro roles del sistema y qué área toca cada uno.
 *
 * Esto NO es el control de acceso: el control de acceso vive en las políticas
 * RLS de la base (`supabase/migrations/…_rls.sql`), que son las que efectivamente
 * impiden leer una fila. Este módulo existe para dos cosas distintas:
 *
 *   1. Fallar temprano y con un mensaje entendible, en lugar de devolver una
 *      lista vacía porque RLS filtró todo, que es imposible de diagnosticar.
 *   2. Decidir qué se muestra en la navegación.
 *
 * La diferencia importa: si algún día esta tabla y las políticas discrepan, la
 * que manda es la base. Acá no puede haber un permiso que allá no exista.
 */

export const ROLES = ['administrador', 'instructor', 'peon', 'cliente'] as const;

export type Rol = (typeof ROLES)[number];

/** Las áreas del sitemap, que son las que agrupan permisos. */
export const AREAS = [
  'gerencia', // cuentas corrientes, cobranza, facturación, pagos, reportes
  'bienestar', // caballos, cuidados, sanidad, inventario
  'ensenanza', // agenda, inscripciones, asistencia, alumnos
  'clientes', // clientes y contratos
  'configuracion', // usuarios, roles, parámetros del establecimiento
  'portal', // lo propio de un cliente: su cuenta, sus caballos, sus alumnos
] as const;

export type Area = (typeof AREAS)[number];

/**
 * Qué áreas alcanza cada rol.
 *
 * El principio rector del sitemap está expresado acá y se puede leer de un
 * vistazo: **el peón no aparece en `gerencia`**, y el cliente sólo tiene
 * `portal`.
 */
const ALCANCE: Record<Rol, readonly Area[]> = {
  administrador: ['gerencia', 'bienestar', 'ensenanza', 'clientes', 'configuracion'],
  instructor: ['ensenanza', 'bienestar'],
  peon: ['bienestar'],
  cliente: ['portal'],
};

export function alcanceDe(rol: Rol): readonly Area[] {
  return ALCANCE[rol];
}

export function puedeVer(rol: Rol, area: Area): boolean {
  return ALCANCE[rol].includes(area);
}

/** Personal del establecimiento, por oposición a un cliente externo. */
export function esPersonal(rol: Rol): boolean {
  return rol !== 'cliente';
}

export function esAdministrador(rol: Rol): boolean {
  return rol === 'administrador';
}

/** Pantalla de entrada de cada perfil, según el sitemap. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  administrador: '/panel',
  instructor: '/campo/hoy',
  peon: '/campo/hoy',
  cliente: '/portal',
};

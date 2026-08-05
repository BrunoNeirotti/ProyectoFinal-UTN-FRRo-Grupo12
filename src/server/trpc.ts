import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Contexto } from './contexto';
import { type Area, type Rol, puedeVer } from '@/lib/roles';

/**
 * Capa de acceso.
 *
 * Dos decisiones que conviene tener claras:
 *
 * 1. **La validación de entrada es obligatoria y va en el borde.** Cada
 *    procedimiento declara su esquema con Zod y tRPC lo aplica antes de ejecutar
 *    nada. Un error de forma se responde con `BAD_REQUEST` y el detalle por
 *    campo, sin llegar a la base.
 *
 * 2. **Los guardas de rol de acá NO son el control de acceso.** El control de
 *    acceso son las políticas RLS. Estos guardas existen para fallar temprano
 *    con un mensaje entendible: sin ellos, un peón que pidiera la cobranza
 *    recibiría una lista vacía en lugar de un «no autorizado», que es la clase
 *    de comportamiento que después nadie sabe diagnosticar.
 */
const t = initTRPC.context<Contexto>().create({
  transformer: superjson, // fechas y numéricos viajan sin pasar por string
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Los errores de validación se devuelven campo por campo, para que la
        // pantalla los muestre donde corresponde y no como un cartel genérico.
        errores: error.cause instanceof ZodError ? error.cause.flatten().fieldErrors : null,
      },
    };
  },
});

export const crearRouter = t.router;
export const middleware = t.middleware;

/** Sin sesión. Sólo para lo que tiene que funcionar antes de entrar. */
export const procedimientoPublico = t.procedure;

const exigeSesion = middleware(({ ctx, next }) => {
  if (!ctx.sesion) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Hay que iniciar sesión.' });
  }
  return next({ ctx: { ...ctx, sesion: ctx.sesion } });
});

export const procedimientoAutenticado = t.procedure.use(exigeSesion);

/** Exige que el rol alcance el área del sitemap que la operación toca. */
export function exigeArea(area: Area) {
  return exigeSesion.unstable_pipe(({ ctx, next }) => {
    if (!puedeVer(ctx.sesion!.rol, area)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `El rol ${ctx.sesion!.rol} no tiene acceso a ${area}.`,
      });
    }
    return next();
  });
}

export function procedimientoDeArea(area: Area) {
  return t.procedure.use(exigeArea(area));
}

const exigeRol = (roles: readonly Rol[]) =>
  exigeSesion.unstable_pipe(({ ctx, next }) => {
    if (!roles.includes(ctx.sesion!.rol)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Operación no habilitada para este rol.' });
    }
    return next();
  });

export const procedimientoAdmin = t.procedure.use(exigeRol(['administrador']));

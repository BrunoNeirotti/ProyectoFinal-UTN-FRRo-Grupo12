import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin, procedimientoAutenticado } from '../trpc';
import {
  CATALOGO,
  CLAVES,
  type Clave,
  type ValorParametro,
  aTexto,
  convertir,
  validar,
  validarConjunto,
} from '@/lib/parametros';

const claveValida = z.enum(CLAVES);

/** M1 · Reglas del establecimiento. */
export const routerParametro = crearRouter({
  /**
   * Consulta de parámetros vigentes.
   *
   * La lee todo el personal, no sólo el dueño: la ventana horaria la necesita el
   * envío de mensajes y el día de vencimiento lo muestra la cobranza. El valor
   * viaja ya convertido a su tipo, para que ninguna pantalla tenga que acordarse
   * de castear.
   */
  vigentes: procedimientoAutenticado.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('parametro')
      .select('clave, valor, tipo, etiqueta, ayuda, actualizado_en')
      .order('clave');

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    return (data ?? []).map((p) => ({
      clave: p.clave as Clave,
      etiqueta: p.etiqueta as string,
      ayuda: p.ayuda as string,
      tipo: p.tipo as (typeof CATALOGO)[Clave]['tipo'],
      valor: convertir(p.valor as string | null, p.tipo as never),
      // Que un parámetro esté sin valor no es un error: es información. La
      // pantalla lo muestra y explica qué queda deshabilitado.
      sinValor: p.valor === null || p.valor === '',
      actualizadoEn: p.actualizado_en as string,
    }));
  }),

  /**
   * Guardar los parámetros del haras.
   *
   * Se guardan **en conjunto** y no de a uno: hay reglas que cruzan dos claves
   * (la franja horaria, el aviso previo contra el día de vencimiento) y
   * validarlas por separado dejaría pasar combinaciones imposibles.
   */
  guardar: procedimientoAdmin
    .input(
      z.object({
        cambios: z
          .array(
            z.object({
              clave: claveValida,
              valor: z.union([z.string(), z.number(), z.boolean(), z.null()]),
            }),
          )
          .min(1, 'No hay nada que guardar.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Cada valor contra su propia declaración.
      const validados = new Map<Clave, ValorParametro>();
      const errores: Record<string, string> = {};

      for (const { clave, valor } of input.cambios) {
        const r = validar(clave, valor as ValorParametro);
        if (r.valido) validados.set(clave, r.valor);
        else errores[clave] = r.motivo;
      }

      if (Object.keys(errores).length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Hay valores inválidos: ' + Object.values(errores).join(' '),
        });
      }

      // 2. Las reglas que cruzan claves, sobre el estado RESULTANTE: lo que se
      //    va a guardar más lo que ya estaba y no se toca.
      const { data: actuales } = await ctx.supabase.from('parametro').select('clave, valor, tipo');

      const resultante: Partial<Record<Clave, ValorParametro>> = {};
      for (const p of actuales ?? []) {
        resultante[p.clave as Clave] = convertir(p.valor as string | null, p.tipo as never);
      }
      for (const [clave, valor] of validados) resultante[clave] = valor;

      const problemas = validarConjunto(resultante);
      if (problemas.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: problemas.join(' ') });
      }

      // 3. Recién ahora se escribe. `actualizado_por` queda registrado, y el
      //    disparador de auditoría guarda además el valor anterior.
      for (const [clave, valor] of validados) {
        const { error } = await ctx.supabase
          .from('parametro')
          .update({ valor: aTexto(valor), actualizado_por: ctx.sesion.usuarioId })
          .eq('clave', clave);

        if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return { guardados: validados.size };
    }),
});

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoDeArea } from '../trpc';

/**
 * Insumos · sólo lectura.
 *
 * **Este router es de M10 y todavía no lo es del todo.** El alta, la edición,
 * los proveedores y las órdenes de compra son de Inventario y llegan con su
 * módulo. Lo que M9 necesita hoy es apenas la nómina: el peón elige contra qué
 * existencia se imputa el material que repuso, y sin poder listarlos ese paso
 * del CUS03 no se puede recorrer.
 *
 * Se agrega la lectura y nada más, en vez de adelantar medio M10, para que
 * cuando llegue Inventario lo que haya acá no haya que deshacerlo.
 *
 * La escritura no falta por olvido: `movimiento_stock` es lo que mueve la
 * existencia y ya lo escribe `registroCuidado`, con el disparador de la base
 * recalculando `insumo.stock_actual`. Nadie escribe esa columna a mano.
 */

const procedimientoLectura = procedimientoDeArea('bienestar');

const CATEGORIAS = ['alimento', 'cama', 'sanidad', 'mantenimiento'] as const;

export const routerInsumo = crearRouter({
  listar: procedimientoLectura
    .input(z.object({ categoria: z.enum(CATEGORIAS).optional() }).optional())
    .query(async ({ ctx, input }) => {
      let consulta = ctx.supabase
        .from('insumo')
        .select('id, nombre, categoria, unidad, stock_actual, stock_minimo')
        .eq('activo', true)
        .order('nombre');

      if (input?.categoria) consulta = consulta.eq('categoria', input.categoria);

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // `bajoMinimo` se deriva y no se guarda, igual que todo lo que M8 informa:
      // una marca almacenada obliga a un proceso que la recalcule, y el día que
      // falla la pantalla muestra un dato viejo con toda confianza.
      return (data ?? []).map((i) => ({
        ...i,
        bajoMinimo: i.stock_actual < i.stock_minimo,
      }));
    }),
});

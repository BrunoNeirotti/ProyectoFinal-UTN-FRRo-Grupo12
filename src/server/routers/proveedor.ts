import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoAdmin } from '../trpc';

/**
 * M10 · Proveedores.
 *
 * La agenda de a quién se le compra. Es la entidad más simple del módulo y la
 * única del sistema que es del dueño de punta a punta: la política
 * `proveedor_admin` no menciona a nadie más, así que ni el instructor ni el peón
 * la ven. No es una omisión del sitemap sino su principio -«el peón no aparece
 * en gerencia»- aplicado a la compra.
 *
 * El CUIT es opcional a propósito. El haras le compra forraje a productores de
 * la zona que facturan cuando facturan, y exigir el CUIT para poder anotar a
 * quién se le compró dejaría fuera del sistema justo a los proveedores que hoy
 * no están anotados en ningún lado.
 *
 * Cuando está, se le controla la forma -once dígitos- y no el dígito
 * verificador. Es el mismo alcance que el sistema le da al CUIT del cliente, y
 * la razón es que acá el CUIT no se usa para emitir nada: el comprobante que
 * importa es el que el proveedor emite, no el haras. Lo que sí evita el control
 * es el error de tipeo que después nadie encuentra.
 */

const datosDeProveedor = z.object({
  razonSocial: z.string().trim().min(1, 'El proveedor necesita un nombre.').max(120),
  cuit: z
    .string()
    .trim()
    // Se guarda sin guiones ni puntos: quien lo tipea lo escribe como quiere y
    // el que después lo busca no tiene por qué adivinar con qué separador entró.
    .transform((v) => v.replace(/[^0-9]/g, ''))
    .refine((v) => v === '' || v.length === 11, 'Un CUIT tiene once dígitos.')
    .optional(),
  telefono: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\+[1-9]\d{7,14}$/.test(v),
      'El teléfono va en formato internacional, por ejemplo +5493415550188.',
    )
    .optional(),
  email: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Ese correo no parece válido.')
    .optional(),
});

function aFila(input: z.infer<typeof datosDeProveedor>) {
  return {
    razon_social: input.razonSocial,
    cuit: input.cuit || null,
    telefono: input.telefono || null,
    email: input.email || null,
  };
}

export const routerProveedor = crearRouter({
  listar: procedimientoAdmin
    .input(z.object({ incluirInactivos: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      let consulta = ctx.supabase
        .from('proveedor')
        .select('id, razon_social, cuit, telefono, email, activo')
        .order('razon_social');

      if (!input?.incluirInactivos) consulta = consulta.eq('activo', true);

      const { data, error } = await consulta;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  crear: procedimientoAdmin.input(datosDeProveedor).mutation(async ({ ctx, input }) => {
    const { data, error } = await ctx.supabase
      .from('proveedor')
      .insert(aFila(input))
      .select('id')
      .single();

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return { id: data.id };
  }),

  editar: procedimientoAdmin
    .input(datosDeProveedor.extend({ proveedorId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('proveedor')
        .update({ ...aFila(input), actualizado_en: new Date().toISOString() })
        .eq('id', input.proveedorId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),

  /**
   * Lo saca de la lista sin borrarlo, igual que el insumo: sus órdenes lo
   * referencian con `on delete restrict` y siguen explicando el gasto del año
   * pasado. Un proveedor inactivo no se ofrece para una orden nueva, y las
   * viejas siguen diciendo a quién se le compró.
   */
  desactivar: procedimientoAdmin
    .input(z.object({ proveedorId: z.uuid(), activo: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('proveedor')
        .update({ activo: input.activo, actualizado_en: new Date().toISOString() })
        .eq('id', input.proveedorId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { ok: true as const };
    }),
});

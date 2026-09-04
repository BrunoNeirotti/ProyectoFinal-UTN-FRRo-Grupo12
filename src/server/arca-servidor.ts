import 'server-only';
import { TRPCError } from '@trpc/server';
import { Arca, AccessTicket, type ArcaServiceName, type ILoginCredentials, type ITicketStoragePort } from '@arcasdk/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/tipos-generados';
import { clienteDeServicio } from '@/lib/supabase/servidor';

/**
 * M6 · Cliente de ARCA (WSAA + WSFEv1), vía `@arcasdk/core`.
 *
 * El Ticket de Acceso de WSAA dura 12 horas y ARCA rechaza pedir otro dentro
 * de esa ventana ("coe.alreadyAuthenticated"); en un backend serverless, que
 * arranca en frío en cada invocación, eso rompe la emisión si no se cachea
 * en algún lado que sobreviva entre invocaciones. La investigación de julio
 * proponía Redis; acá se usa Postgres —una tabla, `arca_ticket`— porque
 * resuelve exactamente lo mismo (leer, guardar, y comparar una fecha de
 * vencimiento) sin sumar una infraestructura nueva para un solo valor de
 * baja frecuencia.
 */
class AlmacenDeTicketPostgres implements ITicketStoragePort {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async get(servicio: ArcaServiceName): Promise<AccessTicket | null> {
    const { data } = await this.supabase
      .from('arca_ticket')
      .select('credenciales')
      .eq('servicio', servicio)
      .maybeSingle();
    if (!data) return null;

    try {
      // AccessTicket.create() valida y decide si el ticket sigue vigente;
      // uno vencido o corrupto simplemente resulta en un WSAA login nuevo.
      return AccessTicket.create(data.credenciales as unknown as ILoginCredentials);
    } catch {
      return null;
    }
  }

  async save(ticket: AccessTicket, servicio: ArcaServiceName): Promise<void> {
    const { error } = await this.supabase.from('arca_ticket').upsert({
      servicio,
      credenciales: ticket.toLoginCredentials() as unknown as Database['public']['Tables']['arca_ticket']['Insert']['credenciales'],
      actualizado_en: new Date().toISOString(),
    });
    if (error) throw new Error(`No se pudo guardar el ticket de ARCA: ${error.message}`);
  }

  async delete(servicio: ArcaServiceName): Promise<void> {
    await this.supabase.from('arca_ticket').delete().eq('servicio', servicio);
  }
}

let instancia: Arca | null = null;

const SIN_CREDENCIALES =
  'Faltan credenciales de ARCA en este entorno (ARCA_CUIT, ARCA_CERTIFICADO_B64, ' +
  'ARCA_CLAVE_PRIVADA_B64). No bloquea el desarrollo de lo demás, pero sin certificado ' +
  'no se puede hablar con ARCA (07-dependencias-externas.md).';

/** Cliente de ARCA, memoizado por proceso. Falla con un mensaje claro sin credenciales. */
export function arcaCliente(): Arca {
  if (instancia) return instancia;

  const cuit = process.env.ARCA_CUIT;
  const certB64 = process.env.ARCA_CERTIFICADO_B64;
  const claveB64 = process.env.ARCA_CLAVE_PRIVADA_B64;
  if (!cuit || !certB64 || !claveB64) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: SIN_CREDENCIALES });
  }

  instancia = new Arca({
    cuit: Number(cuit),
    cert: Buffer.from(certB64, 'base64').toString('utf8'),
    key: Buffer.from(claveB64, 'base64').toString('utf8'),
    production: process.env.ARCA_PRODUCCION === 'true',
    ticketStorage: new AlmacenDeTicketPostgres(clienteDeServicio()),
  });
  return instancia;
}

/** El punto de venta del sistema (RN-03): no es el que el haras usa a mano. */
export function puntoVentaArca(): number {
  const valor = process.env.ARCA_PUNTO_VENTA;
  if (!valor) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Falta ARCA_PUNTO_VENTA en este entorno.' });
  return Number(valor);
}

/** CUIT del emisor tal como lo conoce ARCA (el del certificado configurado). */
export function cuitArca(): number {
  const valor = process.env.ARCA_CUIT;
  if (!valor) throw new TRPCError({ code: 'BAD_REQUEST', message: SIN_CREDENCIALES });
  return Number(valor);
}

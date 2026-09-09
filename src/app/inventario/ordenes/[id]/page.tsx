import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import {
  ESTADO_ORDEN_TEXTO,
  TONO_DE_ESTADO,
  type Tono,
  conUnidad,
  numeroDeOrden,
  pendienteDeRecibir,
} from '@/lib/inventario';
import { AccionesDeOrden, FormularioRecepcion, FormularioRenglon } from './formularios';

export const metadata: Metadata = { title: 'Orden de compra' };

const CLASE_DE_TONO: Record<Tono, string> = {
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  bad: 'badge badge-bad',
  neutro: 'badge',
};

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function fechaLarga(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Ficha de una orden de compra (CUS06, pasos 4 a 7).
 *
 * La pantalla cambia con el estado, y no por adorno: un borrador se edita y no
 * se recibe; una orden enviada se recibe y no se edita. Mostrar los dos juegos
 * de controles a la vez invitaría a corregir la cantidad pedida de una orden que
 * el proveedor ya tiene, que es justamente lo que el disparador
 * `trg_detalle_segun_estado` impide en la base.
 */
export default async function Orden({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await llamador();

  let datos;
  try {
    datos = await api.ordenCompra.ver({ ordenId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const { orden, detalle, entregas } = datos;
  const insumos = await api.insumo.listar();

  const esBorrador = orden.estado === 'borrador';
  // También en `recibida`: el router lo permite y la pantalla lo dice -«una
  // entrega de más se puede seguir informando igual»-. Esconder el formulario
  // apenas se completa la orden convertía esa frase en mentira, y dejaba sin
  // registrar la mercadería de sobra que el proveedor efectivamente mandó.
  const seRecibe = orden.estado !== 'borrador' && orden.estado !== 'anulada';
  const pendientes = detalle.filter(
    (d) => pendienteDeRecibir({ cantidad: d.cantidad, cantidadRecibida: d.cantidad_recibida }) > 0,
  );

  // En el borrador sólo se ofrecen los insumos que todavía no están: agregar uno
  // repetido es, en la cabeza de quien lo hace, corregir la cantidad, y para eso
  // está la fila que ya existe.
  const yaEnLaOrden = new Set(detalle.map((d) => d.insumo?.id));
  const disponibles = insumos.filter((i) => !yaEnLaOrden.has(i.id));

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Link href="/inventario" className="link text-sm">
        ← Inventario
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
            {numeroDeOrden(orden.anio, orden.numero)}
          </p>
          <h1 className="font-serif text-2xl">{orden.proveedor?.razon_social ?? 'Sin proveedor'}</h1>
          <p className="mt-1 text-sm text-muted">
            Emitida el {fechaLarga(orden.fecha_emision)}
            {orden.proveedor?.telefono ? ` · ${orden.proveedor.telefono}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={CLASE_DE_TONO[TONO_DE_ESTADO[orden.estado]]}>
            {ESTADO_ORDEN_TEXTO[orden.estado]}
          </span>
          <p className="font-serif text-xl tnum">{pesos(orden.total)}</p>
        </div>
      </div>

      <section className="card mt-6 overflow-hidden" aria-labelledby="h-detalle">
        <div className="border-b border-surface-border px-4 py-3">
          <h2 id="h-detalle" className="font-serif text-lg">
            Renglones
          </h2>
        </div>

        {detalle.length === 0 ? (
          <p className="p-5 text-sm text-muted">
            La orden no tiene renglones. Se agregan en el formulario inferior; el envío requiere al
            menos uno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[620px]">
              <caption className="sr-only">
                Renglones de la orden con lo pedido, lo recibido y el subtotal.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Insumo</th>
                  <th scope="col" className="num">
                    Pedido
                  </th>
                  <th scope="col" className="num">
                    Recibido
                  </th>
                  <th scope="col" className="num">
                    Precio unitario
                  </th>
                  <th scope="col" className="num">
                    Subtotal
                  </th>
                  {esBorrador && <th scope="col" />}
                </tr>
              </thead>
              <tbody className="tnum">
                {detalle.map((d) => {
                  const falta = pendienteDeRecibir({
                    cantidad: d.cantidad,
                    cantidadRecibida: d.cantidad_recibida,
                  });
                  return (
                    <tr key={d.id}>
                      <td className="font-medium">{d.insumo?.nombre ?? '—'}</td>
                      <td className="num">{conUnidad(d.cantidad, d.insumo?.unidad ?? '')}</td>
                      <td className={`num ${falta > 0 ? 'text-muted' : 'text-ok'}`}>
                        {d.cantidad_recibida ?? 0}
                        {falta > 0 && <span className="text-xs"> · faltan {falta}</span>}
                      </td>
                      <td className="num">{pesos(d.precio_unitario)}</td>
                      <td className="num">{pesos(d.cantidad * d.precio_unitario)}</td>
                      {esBorrador && (
                        <td>
                          <AccionesDeOrden
                            ordenId={orden.id}
                            detalleId={d.id}
                            accion="quitarRenglon"
                          />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {esBorrador && (
        <div className="mt-6 space-y-4">
          <FormularioRenglon ordenId={orden.id} insumos={disponibles} />
          <AccionesDeOrden ordenId={orden.id} accion="enviar" habilitado={detalle.length > 0} />
        </div>
      )}

      {seRecibe && (
        <section className="mt-6" aria-labelledby="h-recepcion">
          <h2 id="h-recepcion" className="font-serif text-lg">
            Registrar una entrega
          </h2>
          <p className="helper mt-1">
            Indicar la cantidad recibida en <b>esta</b> entrega, no el acumulado. Los renglones no
            recibidos se dejan vacíos.
          </p>
          {pendientes.length === 0 ? (
            <p className="card mt-2 p-5 text-sm text-muted">
              La orden está completa. Se admite informar una entrega adicional si el proveedor
              remitió cantidades por encima de lo pedido.
            </p>
          ) : null}
          <FormularioRecepcion
            ordenId={orden.id}
            renglones={detalle.map((d) => ({
              id: d.id,
              nombre: d.insumo?.nombre ?? '—',
              unidad: d.insumo?.unidad ?? '',
              falta: pendienteDeRecibir({
                cantidad: d.cantidad,
                cantidadRecibida: d.cantidad_recibida,
              }),
            }))}
          />
        </section>
      )}

      {entregas.length > 0 && (
        <section className="mt-8" aria-labelledby="h-entregas">
          <h2 id="h-entregas" className="font-serif text-lg">
            Entregas
          </h2>
          <p className="helper mt-1">
            Una fila por remito, con la fecha de ingreso al depósito.
          </p>
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Insumo</th>
                <th scope="col" className="num">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              {entregas.map((e) => {
                const renglon = detalle.find((d) => d.insumo?.id === e.insumo_id);
                return (
                  <tr key={e.id}>
                    <td>{fechaLarga(e.ocurrido_en)}</td>
                    <td>{renglon?.insumo?.nombre ?? '—'}</td>
                    <td className="num">{conUnidad(e.cantidad, renglon?.insumo?.unidad ?? '')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {orden.estado !== 'anulada' && (
        <div className="mt-8 border-t border-surface-border pt-4">
          <AccionesDeOrden
            ordenId={orden.id}
            accion={esBorrador ? 'eliminarBorrador' : 'anular'}
          />
          <p className="helper mt-1">
            {esBorrador
              ? 'Un borrador se elimina definitivamente; no constituye un documento emitido.'
              : 'La anulación cierra la orden y no revierte las recepciones ya registradas.'}
          </p>
        </div>
      )}
    </div>
  );
}

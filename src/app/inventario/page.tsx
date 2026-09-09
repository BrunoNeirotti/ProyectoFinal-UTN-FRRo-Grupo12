import type { Metadata } from 'next';
import Link from 'next/link';
import { Scales, ShoppingCart, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import {
  CATEGORIA_TEXTO,
  ESTADO_ORDEN_TEXTO,
  TONO_DE_ESTADO,
  type Tono,
  numeroDeOrden,
} from '@/lib/inventario';
import { FormularioAjuste, FormularioNuevaOrden, FormularioNuevoInsumo } from './formularios';

export const metadata: Metadata = { title: 'Inventario' };

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function cantidad(n: number, unidad: string): string {
  return `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unidad}`;
}

function fechaCorta(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

const CLASE_DE_TONO: Record<Tono, string> = {
  ok: 'badge badge-ok',
  warn: 'badge badge-warn',
  bad: 'badge badge-bad',
  neutro: 'badge',
};

const COLOR_DE_TONO: Record<Tono, string> = {
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  bad: 'var(--bad)',
  neutro: 'var(--text-muted)',
};

/**
 * Inventario (CUS06).
 *
 * La pantalla está armada alrededor de una sola pregunta -«¿qué hay que
 * comprar?»- y por eso la columna que ordena la tabla es la cobertura y no la
 * existencia. «Quedan 40 bolsas» no dice nada sin saber cuánto se gasta;
 * «alcanza cuatro días» decide la compra sola.
 *
 * El aviso de reposición aparece cuando hay algo que reponer y no siempre: un
 * cartel permanente se vuelve parte del fondo y deja de leerse, que es
 * exactamente lo que le pasa hoy a la planilla del depósito.
 */
export default async function Inventario() {
  const api = await llamador();
  const [panel, ordenes, proveedores] = await Promise.all([
    api.insumo.panel(),
    api.ordenCompra.listar({ soloAbiertas: false, limite: 8 }),
    api.proveedor.listar(),
  ]);

  const abiertas = ordenes.filter(
    (o) => o.estado === 'enviada' || o.estado === 'parcialmente_recibida',
  );
  const gastoDeOrdenes = ordenes
    .filter((o) => o.estado !== 'anulada' && o.estado !== 'borrador')
    .reduce((suma, o) => suma + o.total, 0);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Inventario</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            La existencia baja sola con cada registro de cuidado y con cada recepción. La cobertura
            son días estimados según el consumo de los últimos {panel.ventana.dias} días.
          </p>
        </div>
        <FormularioNuevaOrden proveedores={proveedores} hayQueReponer={panel.aReponer.length > 0} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card-feature on-feature p-4">
          <p className="text-xs text-feature-muted">Insumos bajo mínimo</p>
          <p
            className={`font-serif text-2xl tnum mt-1 ${panel.bajoMinimo > 0 ? 'text-bad' : ''}`}
          >
            {panel.bajoMinimo}
          </p>
          <p className="mt-1 text-xs text-feature-muted">de {panel.insumos.length} insumos</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Órdenes abiertas</p>
          <p className="font-serif text-2xl tnum mt-1">{abiertas.length}</p>
          <p className="mt-1 text-xs text-muted">
            {abiertas.filter((o) => o.estado === 'parcialmente_recibida').length} con entrega parcial
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">A reponer</p>
          <p className="font-serif text-2xl tnum mt-1">{panel.aReponer.length}</p>
          <p className="mt-1 text-xs text-muted">
            para cubrir {panel.diasDeCobertura} días
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Comprometido en órdenes</p>
          <p className="font-serif text-2xl tnum mt-1">{pesos(gastoDeOrdenes)}</p>
          <p className="mt-1 text-xs text-muted">últimas {ordenes.length} órdenes</p>
        </div>
      </div>

      {panel.aReponer.length > 0 && (
        <section className="card-accent mt-6 p-5" role="alert" aria-labelledby="h-alerta">
          <div className="flex flex-wrap items-start gap-3">
            <WarningCircle size={22} className="mt-0.5 text-accent-ink" aria-hidden="true" />
            <div className="min-w-[18rem] flex-1">
              <h2 id="h-alerta" className="font-serif text-lg">
                {panel.aReponer.length === 1
                  ? 'Hay un insumo para reponer'
                  : `Hay ${panel.aReponer.length} insumos para reponer`}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {panel.aReponer
                  .slice(0, 4)
                  .map((r) => `${r.insumo.nombre} (${cantidad(r.cantidad, r.insumo.unidad)})`)
                  .join(', ')}
                {panel.aReponer.length > 4 ? ', y otros más.' : '.'}
              </p>
              <p className="helper mt-1">
                Las cantidades cubren {panel.diasDeCobertura} días de consumo. La orden que se genera
                queda en borrador: se edita antes de enviarla.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2" aria-labelledby="h-insumos">
          <div className="border-b border-surface-border px-4 py-3">
            <h2 id="h-insumos" className="font-serif text-lg">
              Insumos
            </h2>
          </div>

          {panel.insumos.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              Todavía no hay insumos cargados. El primero se da de alta abajo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl min-w-[720px]">
                <caption className="sr-only">
                  Insumos con su existencia, mínimo, consumo promedio y cobertura estimada.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Insumo</th>
                    <th scope="col">Categoría</th>
                    <th scope="col" className="num">
                      Existencia
                    </th>
                    <th scope="col" className="num">
                      Mínimo
                    </th>
                    <th scope="col" className="num">
                      Consumo/día
                    </th>
                    <th scope="col">Cobertura</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {panel.insumos.map((i) => (
                    <tr key={i.id}>
                      <td className="font-medium">
                        <Link href={`/inventario/${i.id}`} className="link">
                          {i.nombre}
                        </Link>
                      </td>
                      <td className="text-xs text-muted">{CATEGORIA_TEXTO[i.categoria]}</td>
                      <td className={`num ${i.bajoMinimo ? 'text-bad' : ''}`}>
                        {cantidad(i.stockActual, i.unidad)}
                      </td>
                      <td className="num text-muted">{i.stockMinimo}</td>
                      <td className="num text-muted">
                        {i.consumoDiario > 0
                          ? i.consumoDiario.toLocaleString('es-AR', { maximumFractionDigits: 1 })
                          : '—'}
                      </td>
                      <td>
                        <span className={CLASE_DE_TONO[i.tono]}>
                          {i.coberturaDias === null ? 'sin consumo' : `${i.coberturaDias} días`}
                        </span>
                        <span className="nivel mt-1.5 block">
                          <i
                            style={{ width: `${i.llenado}%`, background: COLOR_DE_TONO[i.tono] }}
                          />
                          {i.marca !== null && <b style={{ left: `${i.marca}%` }} />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="helper m-0 flex items-start gap-1.5 border-t border-surface-border px-4 py-3">
            <span>
              La marca gris de la barra es dónde queda el mínimo. Un insumo puede estar bajo mínimo y
              tener semanas por delante: el que decide la compra es el semáforo de cobertura.
            </span>
          </p>
        </section>

        <div className="space-y-6">
          <section className="card overflow-hidden" aria-labelledby="h-ordenes">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <h2 id="h-ordenes" className="font-serif text-lg">
                Órdenes de compra
              </h2>
              <Link href="/inventario/proveedores" className="link text-xs">
                Proveedores
              </Link>
            </div>
            {ordenes.length === 0 ? (
              <p className="p-4 text-sm text-muted">Todavía no se emitió ninguna orden.</p>
            ) : (
              <ul className="divide-y divide-surface-border">
                {ordenes.map((o) => (
                  <li key={o.id} className={`p-4 ${o.estado === 'anulada' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/inventario/ordenes/${o.id}`}
                          className="link text-sm font-medium"
                        >
                          {o.proveedor?.razon_social ?? 'Sin proveedor'}
                        </Link>
                        <p className="tnum text-xs text-muted">
                          {numeroDeOrden(o.anio, o.numero)} · {fechaCorta(o.fecha_emision)}
                        </p>
                      </div>
                      <span className={CLASE_DE_TONO[TONO_DE_ESTADO[o.estado]]}>
                        {ESTADO_ORDEN_TEXTO[o.estado]}
                      </span>
                    </div>
                    <p className="tnum mt-2 text-sm">{pesos(o.total)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-feature on-feature p-5" aria-labelledby="h-conteo">
            <div className="mb-2 flex items-center gap-2">
              <Scales size={20} className="text-accent" aria-hidden="true" />
              <h2 id="h-conteo" className="font-serif text-lg">
                Conteo físico
              </h2>
            </div>
            <p className="text-sm text-feature-muted">
              Los conteos nunca coinciden: se rompe una bolsa, se usa de más, alguien se olvida de
              registrar. Se anota lo contado y el sistema calcula la diferencia contra lo registrado.
              Queda auditado con autor, fecha y motivo.
            </p>
            <FormularioAjuste insumos={panel.insumos} />
          </section>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="h-nuevo">
        <h2 id="h-nuevo" className="sr-only">
          Alta de insumo
        </h2>
        <FormularioNuevoInsumo />
      </section>

      {panel.aReponer.length > 0 && proveedores.length === 0 && (
        <p className="helper mt-4 flex items-center gap-1.5">
          <ShoppingCart size={14} aria-hidden="true" />
          Para generar la orden hace falta al menos un proveedor cargado.
        </p>
      )}
    </div>
  );
}

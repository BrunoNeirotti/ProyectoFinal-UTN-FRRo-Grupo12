import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { llamador } from '@/lib/trpc/servidor';
import {
  CATEGORIA_TEXTO,
  TIPO_MOVIMIENTO_TEXTO,
  conUnidad,
  enDias,
  numeroDeOrden,
  saldoDelMovimiento,
} from '@/lib/inventario';
import { FormularioEditarInsumo } from './formularios';

export const metadata: Metadata = { title: 'Insumo' };

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Ficha de un insumo: de dónde salió su existencia.
 *
 * El libro de movimientos es la pantalla entera, y no un apéndice: `stock_actual`
 * es la suma de estas filas y nada más. Poder recorrerlas es lo que convierte
 * «quedan 40 bolsas» en una afirmación verificable en vez de un número que hay
 * que creer.
 */
export default async function Insumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = await llamador();

  const [panel, movimientos] = await Promise.all([
    api.insumo.panel(),
    api.insumo.movimientos({ insumoId: id }),
  ]);

  const insumo = panel.insumos.find((i) => i.id === id);
  if (!insumo) notFound();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <Link href="/inventario" className="link text-sm">
        ← Inventario
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
            {CATEGORIA_TEXTO[insumo.categoria]}
          </p>
          <h1 className="font-serif text-2xl">{insumo.nombre}</h1>
        </div>
        <div className="text-right">
          <p className={`font-serif text-2xl tnum ${insumo.bajoMinimo ? 'text-bad' : ''}`}>
            {conUnidad(insumo.stockActual, insumo.unidad)}
          </p>
          <p className="text-xs text-muted">
            mínimo {insumo.stockMinimo} ·{' '}
            {insumo.coberturaDias === null
              ? 'sin consumo registrado'
              : `alcanza ${enDias(insumo.coberturaDias)}`}
          </p>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="h-libro">
        <h2 id="h-libro" className="font-serif text-lg">
          Movimientos
        </h2>
        <p className="helper mt-1">
          Movimientos que componen la existencia actual.
        </p>

        {movimientos.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">
            Este insumo no registra movimientos.
          </p>
        ) : (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">
                  Cantidad
                </th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {movimientos.map((m) => {
                const saldo = saldoDelMovimiento({ tipo: m.tipo, cantidad: m.cantidad });
                return (
                  <tr key={m.id}>
                    <td>{fechaLarga(m.ocurrido_en)}</td>
                    <td className="text-muted">{TIPO_MOVIMIENTO_TEXTO[m.tipo]}</td>
                    <td className={`num ${saldo < 0 ? 'text-bad' : 'text-ok'}`}>
                      {saldo > 0 ? '+' : ''}
                      {saldo}
                    </td>
                    <td className="text-muted">
                      {m.motivo ?? '—'}
                      {m.orden && (
                        <Link href={`/inventario/ordenes/${m.orden.id}`} className="link ml-1">
                          {numeroDeOrden(m.orden.anio, m.orden.numero)}
                        </Link>
                      )}
                      {m.registro_cuidado_id && (
                        <span className="ml-1 text-xs">· registro del peón</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <FormularioEditarInsumo
          insumo={{
            id: insumo.id,
            nombre: insumo.nombre,
            categoria: insumo.categoria,
            unidad: insumo.unidad,
            stockMinimo: insumo.stockMinimo,
          }}
        />
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioRegistrarPago } from './formulario-registrar';
import { FormularioGenerarEnlace } from './formulario-enlace';
import { BotonImputar } from './boton-imputar';

export const metadata: Metadata = { title: 'Pagos' };

const ESTADO_BADGE = { acreditado: 'badge-ok', pendiente: 'badge-warn', rechazado: 'badge-bad', devuelto: 'badge-accent' } as const;
const ESTADO_TEXTO = { acreditado: 'Acreditado', pendiente: 'Pendiente', rechazado: 'Rechazado', devuelto: 'Devuelto' } as const;
const MEDIO_TEXTO = { mercadopago: 'MercadoPago', transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque' } as const;

function formatoDinero(n: number) {
  return `$${n.toLocaleString('es-AR')}`;
}

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Pantalla propia de Gerencia: cierra el circuito del dinero que abre Cobranza (M3). */
export default async function Pagos({ searchParams }: PageProps<'/pagos'>) {
  const { periodo: periodoParam } = await searchParams;
  const periodo = typeof periodoParam === 'string' && periodoParam ? periodoParam : periodoActual();

  const api = await llamador();
  const [pagos, sinImputar, clientes] = await Promise.all([
    api.pago.listarDelPeriodo({ periodo }),
    api.pago.conciliacionSinImputar(),
    api.cliente.listar(),
  ]);

  const clientesActivos = clientes.filter((c) => c.activo).map((c) => ({ id: c.id, nombre: c.nombre }));
  const totalAcreditado = pagos.filter((p) => p.estado === 'acreditado').reduce((acc, p) => acc + Number(p.importe), 0);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia</p>
      <h1 className="font-serif text-3xl text-fg">Pagos</h1>
      <p className="mt-1 text-fg-muted">
        Pagos registrados con su estado y su imputación a las cuentas corrientes.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="label">Acreditado en el período</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(totalAcreditado)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Pagos del período</p>
          <p className="font-serif text-2xl tnum text-fg">{pagos.length}</p>
        </div>
        <div className="card p-4">
          <p className="label">Sin imputar (todos los períodos)</p>
          <p className="font-serif text-2xl tnum text-warn">{sinImputar.length}</p>
        </div>
      </div>

      <form className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <label className="block">
          <span className="label">Período</span>
          <input name="periodo" type="date" defaultValue={periodo} className="input" />
        </label>
        <button type="submit" className="btn btn-sec">Ver</button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <FormularioRegistrarPago clientes={clientesActivos} />
        <FormularioGenerarEnlace clientes={clientesActivos} />
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Pagos del período, con su estado.</caption>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Medio</th>
              <th scope="col" className="num">Importe</th>
              <th scope="col">Estado</th>
              <th scope="col">Fecha</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody className="tnum">
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/pagos/${p.id}`} className="font-medium text-fg hover:text-accent-ink">
                    {p.nombreCliente}
                  </Link>
                </td>
                <td>{MEDIO_TEXTO[p.medio as keyof typeof MEDIO_TEXTO]}</td>
                <td className="num font-medium">{formatoDinero(Number(p.importe))}</td>
                <td>
                  <span className={`badge ${ESTADO_BADGE[p.estado as keyof typeof ESTADO_BADGE]}`}>
                    {ESTADO_TEXTO[p.estado as keyof typeof ESTADO_TEXTO]}
                  </span>
                </td>
                <td className="text-xs">{new Date(p.creado_en).toLocaleDateString('es-AR')}</td>
                <td>{p.estado === 'acreditado' && !p.imputado && <BotonImputar pagoId={p.id} />}</td>
              </tr>
            ))}
            {pagos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-fg-muted">
                  Sin pagos en este período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-serif text-lg text-fg">Conciliación: pagos acreditados sin imputar</h2>
          <p className="helper">Incluye todos los períodos, no sólo el seleccionado.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">Pagos acreditados que todavía no se imputaron a ninguna cuenta.</caption>
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Medio</th>
                <th scope="col" className="num">Importe</th>
                <th scope="col">Acreditado</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody className="tnum">
              {sinImputar.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombreCliente}</td>
                  <td>{MEDIO_TEXTO[p.medio as keyof typeof MEDIO_TEXTO]}</td>
                  <td className="num font-medium">{formatoDinero(Number(p.importe))}</td>
                  <td className="text-xs">{p.acreditado_en ? new Date(p.acreditado_en).toLocaleDateString('es-AR') : '—'}</td>
                  <td><BotonImputar pagoId={p.id} /></td>
                </tr>
              ))}
              {sinImputar.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-fg-muted">Todo lo acreditado está imputado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';

export const metadata: Metadata = { title: 'Reportes' };

function formatoDinero(n: number) {
  const signo = n < 0 ? '-' : '';
  return `${signo}$${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;
}

/** Con mayúscula sólo al principio: `capitalize` en CSS pondría «Abril De 2026». */
function mesLargo(periodo: string) {
  const texto = new Date(`${periodo}T12:00:00Z`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Ingresos, egresos y resultado mensual (M11, sitemap «Reportes / BI —
 * ingresos, rentabilidad»). El presupuesto del período siguiente, que es
 * consulta a futuro y no historia, vive aparte en `/reportes/presupuesto`.
 */
export default async function Reportes() {
  const api = await llamador();
  const meses = await api.panel.reporteIngresosEgresos();

  const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0);
  const totalEgresos = meses.reduce((s, m) => s + m.egresos, 0);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia</p>
          <h1 className="font-serif text-3xl text-fg">Reportes</h1>
          <p className="mt-1 max-w-xl text-fg-muted">Ingresos y rentabilidad, mes a mes.</p>
        </div>
        <Link href="/reportes/presupuesto" className="btn btn-pri">
          Presupuesto del mes que viene
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="label">Ingresos del período</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(totalIngresos)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Egresos del período</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(totalEgresos)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Resultado</p>
          <p className={`font-serif text-2xl tnum ${totalIngresos - totalEgresos >= 0 ? 'text-ok' : 'text-bad'}`}>
            {formatoDinero(totalIngresos - totalEgresos)}
          </p>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Ingresos, egresos y resultado por mes.</caption>
          <thead>
            <tr>
              <th scope="col">Período</th>
              <th scope="col" className="num">
                Ingresos
              </th>
              <th scope="col" className="num">
                Egresos
              </th>
              <th scope="col" className="num">
                Resultado
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            {meses.map((m) => (
              <tr key={m.periodo}>
                <td className="font-medium">{mesLargo(m.periodo)}</td>
                <td className="num">{formatoDinero(m.ingresos)}</td>
                <td className="num">{formatoDinero(m.egresos)}</td>
                <td className={`num ${m.resultado >= 0 ? 'text-ok' : 'text-bad'}`}>{formatoDinero(m.resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-fg-muted">
        Ingresos: cargos generados en el período. Egresos: órdenes de compra recibidas y costos sanitarios
        aplicados, según la fecha en que ocurrieron.
      </p>
    </div>
  );
}

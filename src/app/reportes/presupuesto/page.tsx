import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { SimuladorDeVariacion } from './simulador';

export const metadata: Metadata = { title: 'Presupuesto mensual' };

function formatoDinero(n: number) {
  const signo = n < 0 ? '-' : '';
  return `${signo}$${Math.round(Math.abs(n)).toLocaleString('es-AR')}`;
}

function mesLargo(periodo: string) {
  return new Date(`${periodo}T12:00:00Z`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * CUS07 «Elaborar el Presupuesto Mensual».
 *
 * No hay nada que guardar acá: la proyección se recompone en cada visita a
 * partir de los contratos, las tarifas, la cartera y las órdenes de compra
 * vigentes (ver la nota del modelo de datos en `14-casos-de-uso.md`). Lo único
 * que persiste, si el Administrador decide actuar sobre la simulación, es la
 * tarifa nueva — y eso pasa por el formulario que ya existe en Configuración.
 */
export default async function Presupuesto() {
  const api = await llamador();
  const presupuesto = await api.panel.presupuesto();

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href="/reportes" className="hover:underline">
          Reportes
        </Link>
      </p>
      <h1 className="font-serif text-3xl text-fg">Presupuesto de {mesLargo(presupuesto.periodo)}</h1>
      <p className="mt-1 max-w-2xl text-fg-muted">
        Proyección a partir de los contratos vigentes, la deuda de la cartera y las compras en curso.
        No se guarda: se recalcula cada vez que se abre esta pantalla.
      </p>

      {presupuesto.advertencias.length > 0 && (
        <div className="card-feature on-feature mt-4 p-4 text-sm">
          {presupuesto.advertencias.map((a) => (
            <p key={a}>{a}</p>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="label">Ingresos recurrentes previstos</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(presupuesto.ingresos.proyectado)}</p>
          {presupuesto.ingresos.excluidos.length > 0 && (
            <p className="mt-1 text-xs text-fg-muted">
              {presupuesto.ingresos.excluidos.length} sin tarifa: no se proyectan
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="label">Egresos previstos</p>
          <p className="font-serif text-2xl tnum text-fg">{formatoDinero(presupuesto.resultado.egresos.total)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Resultado proyectado</p>
          <p className={`font-serif text-2xl tnum ${presupuesto.resultado.resultado >= 0 ? 'text-ok' : 'text-bad'}`}>
            {formatoDinero(presupuesto.resultado.resultado)}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Deuda exigible</p>
          <p className="font-serif text-2xl tnum text-bad">{formatoDinero(presupuesto.deuda.vencido)}</p>
          <p className="mt-1 text-xs text-fg-muted">
            {formatoDinero(presupuesto.deuda.porVencer)} por vencer · {presupuesto.deuda.cuentasVencidas}{' '}
            {presupuesto.deuda.cuentasVencidas === 1 ? 'cuenta' : 'cuentas'} vencidas
          </p>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-1 font-serif text-lg text-fg">Ingresos por servicio</h2>
        {presupuesto.ingresos.porServicio.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">No hay contratos vigentes de servicio mensual.</p>
        ) : (
          <table className="tbl mt-2">
            <caption className="sr-only">Ingreso recurrente proyectado por servicio.</caption>
            <thead>
              <tr>
                <th scope="col">Servicio</th>
                <th scope="col" className="num">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody className="tnum">
              {presupuesto.ingresos.porServicio.map((s) => (
                <tr key={s.servicioId}>
                  <td>{s.servicioNombre}</td>
                  <td className="num">{formatoDinero(s.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-1 font-serif text-lg text-fg">Egresos por concepto</h2>
        <table className="tbl mt-2">
          <caption className="sr-only">Egreso previsto, abierto por concepto.</caption>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col" className="num">
                Importe
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            <tr>
              <td>
                Órdenes de compra pendientes de recibir{' '}
                <Link href="/inventario/ordenes" className="link text-xs">
                  ver
                </Link>
              </td>
              <td className="num">{formatoDinero(presupuesto.resultado.egresos.ordenesCompra)}</td>
            </tr>
            <tr>
              <td>
                Consumo proyectado de insumos ({presupuesto.diasDeCobertura} días){' '}
                <Link href="/inventario" className="link text-xs">
                  ver
                </Link>
              </td>
              <td className="num">{formatoDinero(presupuesto.resultado.egresos.insumos)}</td>
            </tr>
            <tr>
              <td>Costo sanitario, promedio histórico</td>
              <td className="num">{formatoDinero(presupuesto.resultado.egresos.sanidad)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card mt-6 p-5">
        <h2 className="mb-1 font-serif text-lg text-fg">Simular una variación de precios</h2>
        <div className="mt-3">
          <SimuladorDeVariacion
            contratos={presupuesto.contratos}
            ultimoPeriodoLiquidado={presupuesto.ultimoPeriodoLiquidado}
          />
        </div>
      </div>
    </div>
  );
}

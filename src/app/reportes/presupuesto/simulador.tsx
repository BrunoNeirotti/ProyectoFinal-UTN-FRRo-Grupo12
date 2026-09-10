'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { simularVariacion, type ContratoResuelto } from '@/lib/gerencia';

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
 * CUS07, pasos 6-7: el efecto de variar el precio de uno o varios servicios,
 * recalculado en el momento y sin tocar ninguna tarifa. Corre entero en el
 * cliente porque `simularVariacion` es la misma función pura que usó el
 * servidor para armar la proyección base: no hace falta ir a la base para
 * saber qué pasaría.
 */
export function SimuladorDeVariacion({
  contratos,
  ultimoPeriodoLiquidado,
}: {
  contratos: ContratoResuelto[];
  /** ISO yyyy-mm-dd del último mes con cargos generados, o null si todavía no se generó ninguno. */
  ultimoPeriodoLiquidado: string | null;
}) {
  const servicios = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of contratos) {
      if (!c.esPactado && c.importe !== null) mapa.set(c.servicioId, c.servicioNombre);
    }
    return [...mapa.entries()].map(([servicioId, servicioNombre]) => ({ servicioId, servicioNombre }));
  }, [contratos]);

  const [variaciones, setVariaciones] = useState<Record<string, number>>({});

  const simulado = useMemo(() => {
    const mapa = new Map(Object.entries(variaciones).map(([id, pct]) => [id, pct / 100]));
    return simularVariacion(contratos, mapa);
  }, [contratos, variaciones]);

  const base = useMemo(() => simularVariacion(contratos, new Map()), [contratos]);
  const hayVariacion = Object.values(variaciones).some((v) => v !== 0 && !Number.isNaN(v));

  if (servicios.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        No hay contratos de tarifa (todos son importe pactado o no hay contratos vigentes): no hay nada
        que simular.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Una variación se aplica a los contratos de tarifa del servicio; los de importe pactado no se
        mueven, porque ese precio lo negoció el cliente aparte.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {servicios.map((s) => (
          <label key={s.servicioId} className="block">
            <span className="label">{s.servicioNombre} · variación</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                className="input"
                placeholder="0"
                value={variaciones[s.servicioId] ?? ''}
                onChange={(e) =>
                  setVariaciones((prev) => ({ ...prev, [s.servicioId]: Number(e.target.value) }))
                }
              />
              <span className="text-sm text-fg-muted">%</span>
            </div>
          </label>
        ))}
      </div>

      <div className="card p-4">
        <table className="tbl">
          <caption className="sr-only">Ingresos recurrentes proyectados por servicio, base y simulado.</caption>
          <thead>
            <tr>
              <th scope="col">Servicio</th>
              <th scope="col" className="num">
                Base
              </th>
              <th scope="col" className="num">
                Simulado
              </th>
            </tr>
          </thead>
          <tbody className="tnum">
            {base.porServicio.map((b) => {
              const s = simulado.porServicio.find((x) => x.servicioId === b.servicioId);
              return (
                <tr key={b.servicioId}>
                  <td>{b.servicioNombre}</td>
                  <td className="num">{formatoDinero(b.importe)}</td>
                  <td className="num font-medium">{formatoDinero(s?.importe ?? b.importe)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num tnum">{formatoDinero(base.proyectado)}</td>
              <td className="num tnum font-medium">{formatoDinero(simulado.proyectado)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {hayVariacion && (
        <p className="text-sm">
          Si te convence esta variación, registrá la tarifa nueva en{' '}
          <Link href="/configuracion#servicios" className="link">
            Configuración · Servicios y tarifas
          </Link>
          . Ahí queda con su fecha de vigencia, sin borrar la anterior
          {ultimoPeriodoLiquidado && <> — eso sí, tiene que regir después de {mesLargo(ultimoPeriodoLiquidado)}, que es el último período con cargos generados</>}
          .
        </p>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { tipoEnTexto } from '@/lib/bienestar';
import { FormularioAplicar, FormularioOmitir, FormularioProgramar } from './formularios';

export const metadata: Metadata = { title: 'Sanidad' };

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Cronograma sanitario (CUS04).
 *
 * Tres bloques, en el orden en que se miran: qué está por vencer, qué está
 * agendado y sin aplicar, y el formulario para agendar lo que sigue.
 *
 * Los vencimientos y el cronograma son listas distintas a propósito, aunque las
 * dos hablen de fechas: un vencimiento dice «a este caballo le toca» y sale de
 * lo aplicado; el cronograma dice «esto está agendado» y sale de lo previsto.
 * Mezclarlas haría que agendar un ciclo pareciera resolver el vencimiento antes
 * de que nadie aplicara nada.
 */
export default async function Sanidad() {
  const api = await llamador();
  const [sanidad, previstos, caballos] = await Promise.all([
    api.eventoSanitario.alertas(),
    api.eventoSanitario.previstos(),
    api.caballo.listar(),
  ]);

  const enPie = caballos.filter((c) => c.estado !== 'retirado');

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="font-serif text-2xl">Sanidad</h1>
      <p className="mt-1 text-sm text-muted">
        Vencimientos, ciclos agendados y programación. Los avisos salen con{' '}
        {sanidad.diasDeAviso} días de anticipación, configurables en Configuración.
      </p>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Vencimientos</h2>
        {sanidad.alertas.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">
            Nada por vencer en los próximos {sanidad.diasDeAviso} días.
          </p>
        ) : (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Caballo</th>
                <th>Tipo</th>
                <th>Vence</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sanidad.alertas.map((a) => (
                <tr key={`${a.caballoId}-${a.tipo}`}>
                  <td>{a.caballoNombre ?? '—'}</td>
                  <td>{tipoEnTexto(a.tipo)}</td>
                  <td className="tnum">{fechaLarga(a.proximaFecha)}</td>
                  <td>
                    <span className={`badge ${a.estado === 'vencido' ? 'badge-bad' : 'badge-warn'}`}>
                      {a.estado === 'vencido'
                        ? `vencido hace ${Math.abs(a.diasRestantes)} d`
                        : `en ${a.diasRestantes} d`}
                    </span>
                  </td>
                  <td>
                    <Link href={`/caballos/${a.caballoId}`} className="link">
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Agendado y sin aplicar</h2>
        {previstos.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">No hay ciclos programados.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {previstos.map((e) => (
              <li key={e.id} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    {e.caballo?.nombre ?? 'Caballo'} ·{' '}
                    {tipoEnTexto(e.tipo)}
                  </p>
                  <p className="tnum text-sm text-muted">previsto {fechaLarga(e.fecha)}</p>
                </div>
                {(e.producto || e.dosis || e.observaciones) && (
                  <p className="mt-1 text-sm text-muted">
                    {[e.producto, e.dosis, e.observaciones].filter(Boolean).join(' · ')}
                  </p>
                )}

                <FormularioAplicar
                  eventoId={e.id}
                  caballoId={e.caballo?.id ?? ''}
                  producto={e.producto}
                  dosis={e.dosis}
                />
                <FormularioOmitir eventoId={e.id} caballoId={e.caballo?.id ?? ''} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        {enPie.length === 0 ? (
          <p className="card p-5 text-sm text-muted">
            <WarningCircle size={16} className="inline text-warn" aria-hidden="true" /> No hay
            caballos activos para programar.
          </p>
        ) : (
          <FormularioProgramar
            caballos={enPie.map((c) => ({
              id: c.id,
              nombre: c.nombre,
              enTratamiento: c.estado === 'en_tratamiento',
            }))}
          />
        )}
      </section>
    </div>
  );
}

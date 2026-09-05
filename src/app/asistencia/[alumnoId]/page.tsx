import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { ZONA_HARAS } from '@/lib/agenda';
import { nombreDePeriodo } from '@/lib/asistencia';

export const metadata: Metadata = { title: 'Historial de asistencia' };

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

function fechaYHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: ZONA_HARAS,
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

/**
 * Historial de asistencia de un alumno (M8).
 *
 * Clase por clase y de lo más nuevo a lo más viejo, que es como se lee un
 * antecedente. Es la pantalla a la que se llega desde el reporte cuando un
 * alumno aparece en riesgo: el porcentaje dice que algo pasa y esto muestra
 * cuándo empezó a pasar.
 */
export default async function HistorialDeAlumno({ params }: PageProps<'/asistencia/[alumnoId]'>) {
  const { alumnoId } = await params;
  const api = await llamador();

  let historial;
  try {
    historial = await api.asistencia.historialDeAlumno({ alumnoId });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const { alumno, conteo, clases, desde, hasta } = historial;

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href="/asistencia" className="hover:underline">
          <ArrowLeft size={12} className="inline" aria-hidden="true" /> Asistencia y progreso
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl text-fg">{alumno.nombre}</h1>
        {!alumno.activo && <span className="badge badge-warn">Inactivo</span>}
      </div>
      <p className="mt-1 text-fg-muted">
        {alumno.nivel ? NIVEL_TEXTO[alumno.nivel] : 'Sin nivel'}
        {alumno.cliente ? ` · factura a ${alumno.cliente}` : ''}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="label">Clases dictadas</p>
          <p className="font-serif text-2xl tnum text-fg">{conteo.dictadas}</p>
          <p className="helper">de {nombreDePeriodo(desde)} a {nombreDePeriodo(hasta)}</p>
        </div>
        <div className="card p-4">
          <p className="label">Asistió</p>
          <p className="font-serif text-2xl tnum text-ok">{conteo.asistidas}</p>
        </div>
        <div className="card p-4">
          <p className="label">Ausencias</p>
          <p className="font-serif text-2xl tnum text-fg">{conteo.ausencias}</p>
          <p className="helper">sin aviso previo</p>
        </div>
        <div className="card p-4">
          <p className="label">Asistencia</p>
          <p className="font-serif text-2xl tnum text-fg">
            {conteo.porcentaje === null ? '—' : `${Math.round(conteo.porcentaje)}%`}
          </p>
        </div>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="border-b border-surface-border px-5 py-4">
          <h2 className="font-serif text-lg text-fg">Clase por clase</h2>
          <p className="helper">
            Sólo figuran las clases dictadas en las que estaba inscripto. Las que canceló en término
            no llegan a generar asistencia, y por eso no aparecen acá como ausencias.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <caption className="sr-only">
              Historial de asistencia de {alumno.nombre}, de la clase más reciente a la más antigua.
            </caption>
            <thead>
              <tr>
                <th scope="col">Cuándo</th>
                <th scope="col">Clase</th>
                <th scope="col">Caballo</th>
                <th scope="col">Asistió</th>
                <th scope="col">Progreso</th>
              </tr>
            </thead>
            <tbody>
              {clases.map((c) => (
                <tr key={c.claseId}>
                  <td className="tnum text-xs">
                    <Link href={`/agenda/${c.claseId}`} className="hover:text-accent-ink">
                      {fechaYHora(c.iniciaEn)}
                    </Link>
                  </td>
                  <td>
                    {c.servicio ?? 'Clase'}
                    {c.nivel && <span className="text-xs text-fg-muted"> · {NIVEL_TEXTO[c.nivel]}</span>}
                  </td>
                  <td className="text-fg-muted">{c.caballo ?? '—'}</td>
                  <td>
                    <span className={`badge ${c.presente ? 'badge-ok' : 'badge-bad'}`}>
                      {c.presente ? 'Presente' : 'Ausente'}
                    </span>
                  </td>
                  <td className="text-sm text-fg-muted">{c.observaciones ?? '—'}</td>
                </tr>
              ))}
              {clases.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-fg-muted">
                    No hay clases dictadas en el período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

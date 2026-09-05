import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { ArrowLeft, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { partesLocales } from '@/lib/agenda';
import { Correccion, Planilla } from './planilla';

export const metadata: Metadata = { title: 'Asistencia de clase' };

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

/**
 * Asistencia de una clase (M8).
 *
 * Cuelga de la clase y no de una sección propia porque es lo que la pantalla del
 * prototipo hace: se entra desde la clase del día. El perfil de campo del
 * sitemap le da además un lugar en la barra inferior, y esa barra —con su cola
 * de sincronización— es de M14; hasta entonces se llega desde la agenda, que es
 * el camino que ya existe.
 */
export default async function AsistenciaDeClase({ params }: PageProps<'/agenda/[id]/asistencia'>) {
  const { id } = await params;
  const api = await llamador();

  let planilla;
  try {
    planilla = await api.asistencia.planilla({ claseId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const { clase, alumnos, caballos, estado } = planilla;
  const cuando = partesLocales(clase.inicia_en);
  const nombreDeCaballo = new Map(caballos.map((c) => [c.id, c.nombre]));
  const dictada = clase.estado === 'dictada';
  const suspendida = clase.estado === 'cancelada';

  const fechaLarga = new Date(`${cuando.fecha}T12:00:00Z`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href={`/agenda/${clase.id}`} className="hover:underline">
          <ArrowLeft size={12} className="inline" aria-hidden="true" /> Volver a la clase
        </Link>
      </p>

      <div className="card-feature on-feature mt-2 p-5">
        <p className="tnum text-xs uppercase tracking-wide text-feature-muted first-letter:uppercase">
          {fechaLarga} · {cuando.hora} · {clase.instalacion?.nombre ?? 'sin instalación'}
        </p>
        <h1 className="font-serif text-2xl text-feature-fg">
          {clase.servicio?.nombre ?? 'Clase'}
          {clase.nivel ? ` · ${NIVEL_TEXTO[clase.nivel]}` : ''}
        </h1>
        <p className="tnum mt-1 text-sm text-feature-muted">
          {estado.inscriptos} {estado.inscriptos === 1 ? 'inscripto' : 'inscriptos'}
          {estado.registrados > 0 &&
            ` · ${estado.presentes} ${estado.presentes === 1 ? 'presente' : 'presentes'} · ${estado.ausentes} ${estado.ausentes === 1 ? 'ausente' : 'ausentes'}`}
          {dictada ? ' · dictada' : suspendida ? ' · suspendida' : ''}
        </p>
      </div>

      {suspendida && (
        <p className="mt-4 text-sm text-bad">
          La clase está suspendida{clase.motivo_suspension ? `: ${clase.motivo_suspension}` : '.'} No
          genera asistencia ni entra en la liquidación del período.
        </p>
      )}

      {/*
        El vacío del prototipo: se avisa ANTES de que el instructor cruce el
        predio. Que no haya nadie anotado no es un error de la pantalla, es una
        respuesta, y la más útil que puede dar a las nueve de la mañana.
      */}
      {!suspendida && alumnos.length === 0 && (
        <div className="card mt-6 grid place-items-center gap-3 p-8 text-center" role="status">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-accent-soft text-accent-ink">
            <UsersThree size={36} aria-hidden="true" />
          </span>
          <div>
            <p className="font-serif text-xl text-fg">Nadie se inscribió</p>
            <p className="mt-1 text-sm text-fg-muted">
              Esta clase no tiene alumnos anotados. No hace falta ir a la pista.
            </p>
          </div>
          <Link href={`/agenda/${clase.id}`} className="btn btn-sec">
            Inscribir o suspender la clase
          </Link>
        </div>
      )}

      {!suspendida && alumnos.length > 0 && !dictada && (
        <section className="mt-6">
          <h2 className="sr-only">Planilla de asistencia</h2>
          <Planilla
            claseId={clase.id}
            alumnos={alumnos}
            caballos={caballos}
            bloqueada={false}
            motivoBloqueo={null}
          />
        </section>
      )}

      {/*
        Ya dictada: la planilla pasa a ser un documento y se lee como tal. Lo que
        queda habilitado es corregir fila por fila, porque lo que hay detrás ya
        es el respaldo de un cargo.
      */}
      {dictada && (
        <section className="card mt-6 overflow-hidden">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-serif text-lg text-fg">Asistencia registrada</h2>
            <p className="helper">
              La clase está cerrada y disponible para liquidar. Una corrección queda asentada en la
              traza de auditoría con quién la hizo.
            </p>
          </div>
          <ul className="divide-y divide-surface-border">
            {alumnos.map((a) => (
              <li key={a.alumnoId} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{a.nombre}</span>
                    <span className="block text-xs text-fg-muted">
                      {a.presente
                        ? ((a.caballoRegistrado && nombreDeCaballo.get(a.caballoRegistrado)) ?? 'Sin caballo')
                        : 'No montó'}
                      {a.observaciones ? ` · ${a.observaciones}` : ''}
                    </span>
                  </span>
                  <span className={`badge ${a.presente ? 'badge-ok' : 'badge-bad'}`}>
                    {a.presente ? 'Presente' : 'Ausente'}
                  </span>
                </div>
                {a.asistenciaId && (
                  <div className="mt-2">
                    {/*
                      La clave lleva los valores guardados para que, al
                      corregir, el formulario se vuelva a montar con los nuevos.
                      Sin esto quedaba plegado debajo de una fila ya corregida
                      mostrando todavía lo anterior, y un segundo «Guardar»
                      deshacía en silencio la corrección recién hecha.
                    */}
                    <Correccion
                      key={`${a.asistenciaId}-${a.presente}-${a.caballoRegistrado ?? ''}-${a.observaciones}`}
                      claseId={clase.id}
                      asistenciaId={a.asistenciaId}
                      presente={a.presente}
                      caballoId={a.caballoRegistrado}
                      observaciones={a.observaciones}
                      caballos={caballos}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

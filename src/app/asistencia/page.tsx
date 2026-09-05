import type { Metadata } from 'next';
import Link from 'next/link';
import { Horse, TrendDown, TrendUp, Minus } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import {
  MESES_DE_REFERENCIA,
  nombreDePeriodo,
  periodoCorrido,
  periodoDe,
} from '@/lib/asistencia';
import { EvolucionPorNivel } from './evolucion';

export const metadata: Metadata = { title: 'Asistencia y progreso' };

const NIVEL_TEXTO = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

function porcentaje(valor: number | null): string {
  return valor === null ? '—' : `${Math.round(valor)}%`;
}

function colorDePorcentaje(valor: number | null): string {
  if (valor === null) return 'text-fg-muted';
  if (valor >= 85) return 'text-ok';
  if (valor >= 65) return '';
  return 'text-bad';
}

/**
 * Asistencia y reportes de progreso (M8).
 *
 * Contesta dos preguntas que el haras hoy responde tarde: qué se dictó
 * realmente —que es lo que se factura— y cómo viene cada alumno.
 *
 * Ninguno de estos números está guardado: se cuentan sobre `asistencia` cada vez
 * que se abre la pantalla. «Alumnos en riesgo» es el ejemplo claro y por eso
 * tiene su propia explicación al costado: es una consulta, no un campo, y por lo
 * tanto no puede quedar desactualizada.
 */
export default async function AsistenciaYProgreso({ searchParams }: PageProps<'/asistencia'>) {
  const parametros = await searchParams;
  const pedido = typeof parametros.periodo === 'string' ? parametros.periodo : undefined;

  const api = await llamador();
  const [progreso, caballos] = await Promise.all([
    api.asistencia.progreso({ periodo: pedido }),
    api.asistencia.cargaDeCaballos({ periodo: pedido }),
  ]);

  const hoy = periodoDe(new Date());
  const elegibles = Array.from({ length: 12 }, (_, i) => periodoCorrido(hoy, -i));
  if (!elegibles.includes(progreso.periodo)) elegibles.unshift(progreso.periodo);

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
            Enseñanza · {nombreDePeriodo(progreso.periodo)}
          </p>
          <h1 className="font-serif text-3xl text-fg">Asistencia y progreso</h1>
          <p className="mt-1 max-w-xl text-fg-muted">
            Qué se dictó realmente —que es lo que se factura— y cómo viene cada alumno.
          </p>
        </div>

        <form className="flex items-end gap-2">
          <label className="block">
            <span className="label">Período</span>
            <select
              name="periodo"
              defaultValue={progreso.periodo}
              className="input w-44 py-1.5 text-sm"
            >
              {elegibles.map((p) => (
                <option key={p} value={p}>{nombreDePeriodo(p)}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-sec">Ver</button>
        </form>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="label">Clases dictadas</p>
          <p className="font-serif text-2xl tnum text-fg">{progreso.clases.dictadas}</p>
          <p className="helper">
            de {progreso.clases.total} agendadas
            {progreso.clases.suspendidas > 0 && ` · ${progreso.clases.suspendidas} suspendidas`}
          </p>
        </div>
        <div className="card p-4">
          <p className="label">Asistencia promedio</p>
          <p className={`font-serif text-2xl tnum ${colorDePorcentaje(progreso.general.porcentaje)}`}>
            {porcentaje(progreso.general.porcentaje)}
          </p>
          <p className="helper">sobre {progreso.general.dictadas} asistencias registradas</p>
        </div>
        <div className="card p-4">
          <p className="label">Ausencias sin aviso</p>
          <p className="font-serif text-2xl tnum text-fg">{progreso.general.ausencias}</p>
          <p className="helper">se facturan igual</p>
        </div>
        {/*
          No es un campo del modelo: es una consulta sobre las últimas semanas.
          Guardarlo obligaría a un proceso que lo recalcule y abriría la puerta a
          mostrar un dato viejo.
        */}
        <div className="card-feature on-feature p-4">
          <p className="label text-feature-muted">Alumnos en riesgo</p>
          <p className="font-serif text-2xl tnum text-warn">{progreso.enRiesgo}</p>
          <p className="helper text-feature-muted">bajaron su asistencia</p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-serif text-lg text-fg">Por alumno</h2>
            <p className="helper">
              Primero los que conviene mirar. El denominador es la cantidad de clases en las que
              estaba inscripto y que efectivamente se dictaron.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl min-w-[720px]">
              <caption className="sr-only">
                Asistencia por alumno en {nombreDePeriodo(progreso.periodo)}: clases dictadas,
                asistidas, porcentaje, último caballo montado y evolución respecto de los meses
                anteriores.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Alumno</th>
                  <th scope="col" className="num">Clases</th>
                  <th scope="col" className="num">Asistió</th>
                  <th scope="col" className="num">%</th>
                  <th scope="col">Último caballo</th>
                  <th scope="col">Progreso</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {progreso.alumnos.map((a) => (
                  <tr key={a.alumnoId}>
                    <td>
                      <Link
                        href={`/asistencia/${a.alumnoId}`}
                        className="font-medium text-fg hover:text-accent-ink"
                      >
                        {a.nombre}
                      </Link>
                      <p className="text-xs text-fg-muted">
                        {a.nivel ? NIVEL_TEXTO[a.nivel] : 'Sin nivel'}
                        {progreso.verClientes && a.cliente ? ` · ${a.cliente}` : ''}
                      </p>
                    </td>
                    <td className="num">{a.conteo.dictadas}</td>
                    <td className="num">{a.conteo.asistidas}</td>
                    <td className={`num font-medium ${colorDePorcentaje(a.conteo.porcentaje)}`}>
                      {porcentaje(a.conteo.porcentaje)}
                    </td>
                    <td className="text-sm text-fg-muted">{a.ultimoCaballo ?? '—'}</td>
                    <td>
                      <Tendencia riesgo={a.riesgo} />
                    </td>
                  </tr>
                ))}
                {progreso.alumnos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-fg-muted">
                      No hay asistencia registrada en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          {/* El aviso temprano de baja: hoy se detecta cuando el cliente deja de pagar. */}
          <section className="card p-5">
            <h2 className="mb-1 font-serif text-lg text-fg">Por qué «en riesgo»</h2>
            <p className="text-sm text-fg-muted">
              Un alumno que bajó su asistencia de forma sostenida casi siempre está por darse de
              baja. Hoy eso se descubre cuando el cliente deja de pagar; acá se ve varias semanas
              antes, cuando todavía se puede llamar y preguntar qué pasó.
            </p>
            <p className="mt-3 text-sm text-fg">
              Se marca cuando la asistencia cae <b>más de {progreso.umbral} puntos</b> respecto del
              promedio de los {MESES_DE_REFERENCIA} meses anteriores. El umbral se cambia en
              Configuración.
            </p>
          </section>

          {/* La asistencia también es un dato de bienestar animal. */}
          <section className="card p-5">
            <h2 className="mb-3 font-serif text-lg text-fg">Carga por caballo</h2>
            <p className="mb-3 text-sm text-fg-muted">
              La columna «último caballo» no es un detalle de color: sirve para vigilar cuánto
              trabaja cada animal. La asistencia también es un dato de bienestar.
            </p>
            <ul className="space-y-2.5 text-sm">
              {caballos.carga.map((c, i) => (
                <li key={c.caballoId} className="flex items-center gap-3">
                  <span className="flex flex-1 items-center gap-2 text-fg">
                    <Horse size={16} className="text-accent-ink" aria-hidden="true" />
                    {c.nombre}
                  </span>
                  <span
                    className={`tnum ${i === 0 && c.montadas > 0 ? 'font-medium text-bad' : 'text-fg'}`}
                  >
                    {c.montadas} {c.montadas === 1 ? 'clase' : 'clases'}
                  </span>
                  {c.montadas !== c.previstas && (
                    <span className="tnum text-xs text-fg-muted">({c.previstas} prev.)</span>
                  )}
                </li>
              ))}
              {caballos.carga.length === 0 && (
                <li className="text-fg-muted">Todavía no se registró ningún caballo montado.</li>
              )}
            </ul>
            {caballos.carga.some((c) => c.montadas !== c.previstas) && (
              <p className="helper">
                Entre paréntesis, las veces que se lo había previsto al inscribir. La diferencia
                puede ser una sustitución o un alumno que faltó; la sustitución repetida sobre el
                mismo caballo es la que termina en sobrecarga.
              </p>
            )}
          </section>
        </div>
      </div>

      <EvolucionPorNivel
        series={progreso.evolucion.map((s) => ({
          nombre: NIVEL_TEXTO[s.nivel] ?? s.nivel,
          puntos: s.puntos,
        }))}
      />
    </div>
  );
}

/** La flecha de la última columna: subió, bajó o se mantuvo. */
function Tendencia({ riesgo }: { riesgo: { enRiesgo: boolean; caida: number | null } }) {
  if (riesgo.caida === null) {
    return <span className="text-xs text-fg-muted">Sin historial</span>;
  }

  const puntos = Math.round(riesgo.caida);

  if (riesgo.enRiesgo) {
    return (
      <span className="badge badge-bad">
        <TrendDown size={12} aria-hidden="true" />−{puntos} pts
      </span>
    );
  }
  if (puntos <= -5) {
    return (
      <span className="badge badge-ok">
        <TrendUp size={12} aria-hidden="true" />+{Math.abs(puntos)} pts
      </span>
    );
  }
  if (puntos >= 5) {
    return (
      <span className="badge badge-warn">
        <TrendDown size={12} aria-hidden="true" />−{puntos} pts
      </span>
    );
  }
  return (
    <span className="badge">
      <Minus size={12} aria-hidden="true" />Estable
    </span>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Scales } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { esMenorDeEdad } from '@/lib/personas';
import { FilaAlumno } from './fila-alumno';

export const metadata: Metadata = { title: 'Alumnos' };

/** Pantalla 7 del prototipo: padrón de alumnos con nivel, responsable y consentimiento. */
export default async function Alumnos() {
  const api = await llamador();
  const alumnos = await api.alumno.listar();
  const sinConsentimiento = alumnos.filter(
    (a) => !a.consentimiento_tutor_en && a.persona?.fecha_nacimiento && esMenorDeEdad(a.persona.fecha_nacimiento),
  );

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Enseñanza</p>
          <h1 className="font-serif text-3xl text-fg">Alumnos</h1>
          <p className="mt-1 text-fg-muted">
            Padrón con su nivel, quién paga por ellos y quién es su responsable legal.
          </p>
        </div>
        <Link href="/alumnos/nuevo" className="btn btn-pri">
          <Plus size={16} aria-hidden="true" />
          Nuevo alumno
        </Link>
      </div>

      {sinConsentimiento.length > 0 && (
        <div className="card-accent mt-6 p-4">
          <p className="flex items-center gap-2 font-medium text-bad">
            <Scales size={18} aria-hidden="true" />
            {sinConsentimiento.length} {sinConsentimiento.length === 1 ? 'menor sin' : 'menores sin'} consentimiento de tutor
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            La Ley 25.326 exige el consentimiento del responsable para tratar datos de un menor.
            Hasta regularizarlo no pueden inscribirse a clases.
          </p>
        </div>
      )}

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl min-w-[860px]">
          <caption className="sr-only">
            Padrón de alumnos con edad, nivel, responsable legal, cliente que paga y consentimiento.
          </caption>
          <thead>
            <tr>
              <th scope="col">Alumno</th>
              <th scope="col" className="num">Edad</th>
              <th scope="col">Nivel</th>
              <th scope="col">Responsable</th>
              <th scope="col">Paga</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {alumnos.map((a) => (
              <FilaAlumno key={a.id} alumno={a} />
            ))}
            {alumnos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-fg-muted">
                  Todavía no hay alumnos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

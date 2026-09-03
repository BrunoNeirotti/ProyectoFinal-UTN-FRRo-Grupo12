import type { Metadata } from 'next';
import Link from 'next/link';
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
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-fg">Alumnos</h1>
          <p className="mt-1 text-fg-muted">
            Padrón con su nivel, quién paga por ellos y quién es su responsable legal.
          </p>
        </div>
        <Link href="/alumnos/nuevo" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          Nuevo alumno
        </Link>
      </div>

      {sinConsentimiento.length > 0 && (
        <div className="mt-6 rounded-xl border border-bad bg-bad-bg p-4 text-sm text-bad">
          <p className="font-medium">
            {sinConsentimiento.length} {sinConsentimiento.length === 1 ? 'menor sin' : 'menores sin'} consentimiento de tutor
          </p>
          <p className="mt-1">
            La Ley 25.326 exige el consentimiento del responsable para tratar datos de un menor.
            Hasta regularizarlo no pueden inscribirse a clases.
          </p>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Padrón de alumnos con edad, nivel, responsable legal, cliente que paga y consentimiento.
          </caption>
          <thead>
            <tr className="border-b border-surface-border px-4 text-left text-fg-muted">
              <th className="px-4 py-3 font-medium">Alumno</th>
              <th className="px-4 py-3 text-right font-medium">Edad</th>
              <th className="px-4 py-3 font-medium">Nivel</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Paga</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {alumnos.map((a) => (
              <FilaAlumno key={a.id} alumno={a} />
            ))}
            {alumnos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-fg-muted">
                  Todavía no hay alumnos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

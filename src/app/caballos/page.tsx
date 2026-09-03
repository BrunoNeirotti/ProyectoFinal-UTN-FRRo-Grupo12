import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { edadEn } from '@/lib/personas';

export const metadata: Metadata = { title: 'Caballos' };

const ESTADOS = { activo: 'Activo', en_tratamiento: 'En tratamiento', retirado: 'Retirado' } as const;

export default async function Caballos() {
  const api = await llamador();
  const caballos = await api.caballo.listar();

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-fg">Caballos</h1>
          <p className="mt-1 text-fg-muted">Padrón con su alojamiento y su propietario.</p>
        </div>
        <Link href="/caballos/nuevo" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          Nuevo caballo
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">Padrón de caballos con raza, edad, instalación, propietario y estado.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="px-4 py-3 font-medium">Caballo</th>
              <th className="px-4 py-3 font-medium">Raza</th>
              <th className="px-4 py-3 text-right font-medium">Edad</th>
              <th className="px-4 py-3 font-medium">Instalación</th>
              <th className="px-4 py-3 font-medium">Propietario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {caballos.map((c) => {
              const nombrePropietario =
                c.propietario?.tipo === 'persona_juridica'
                  ? c.propietario.razon_social
                  : c.propietario?.persona
                    ? `${c.propietario.persona.apellido}, ${c.propietario.persona.nombre}`
                    : null;
              return (
                <tr key={c.id} className="border-b border-surface-border">
                  <td className="px-4 py-3">
                    <Link href={`/caballos/${c.id}`} className="font-medium text-fg hover:text-accent-ink">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.raza ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{c.fecha_nacimiento ? edadEn(c.fecha_nacimiento) : '—'}</td>
                  <td className="px-4 py-3 text-xs">{c.instalacion?.nombre ?? 'Sin asignar'}</td>
                  <td className="px-4 py-3 text-xs">{nombrePropietario ?? 'Del haras'}</td>
                  <td className="px-4 py-3 text-xs">{ESTADOS[c.estado]}</td>
                </tr>
              );
            })}
            {caballos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-fg-muted">
                  Todavía no hay caballos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

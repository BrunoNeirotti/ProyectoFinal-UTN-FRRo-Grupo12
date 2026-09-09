import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { edadEn } from '@/lib/personas';

export const metadata: Metadata = { title: 'Caballos' };

const ESTADOS = { activo: 'Activo', en_tratamiento: 'En tratamiento', retirado: 'Retirado' } as const;
const ESTADO_BADGE = { activo: 'badge-ok', en_tratamiento: 'badge-warn', retirado: '' } as const;

export default async function Caballos() {
  const api = await llamador();
  const caballos = await api.caballo.listar();

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Bienestar animal</p>
          <h1 className="font-serif text-3xl text-fg">Caballos</h1>
          <p className="mt-1 text-fg-muted">
            Padrón de caballos con su alojamiento, propietario y estado.
          </p>
        </div>
        <Link href="/caballos/nuevo" className="btn btn-pri">
          <Plus size={16} aria-hidden="true" />
          Nuevo caballo
        </Link>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="tbl min-w-[720px]">
          <caption className="sr-only">Padrón de caballos con raza, edad, instalación, propietario y estado.</caption>
          <thead>
            <tr>
              <th scope="col">Caballo</th>
              <th scope="col">Raza</th>
              <th scope="col" className="num">Edad</th>
              <th scope="col">Instalación</th>
              <th scope="col">Propietario</th>
              <th scope="col">Estado</th>
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
                <tr key={c.id}>
                  <td>
                    <Link href={`/caballos/${c.id}`} className="font-medium text-fg hover:text-accent-ink">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="text-xs">{c.raza ?? '—'}</td>
                  <td className="num">{c.fecha_nacimiento ? edadEn(c.fecha_nacimiento) : '—'}</td>
                  <td className="text-xs">{c.instalacion?.nombre ?? 'Sin asignar'}</td>
                  <td className="text-xs">{nombrePropietario ?? 'Del haras'}</td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[c.estado]}`}>{ESTADOS[c.estado]}</span>
                  </td>
                </tr>
              );
            })}
            {caballos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-fg-muted">
                  Todavía no hay caballos cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

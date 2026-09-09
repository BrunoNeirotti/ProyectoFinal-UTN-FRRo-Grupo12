import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { PlanillaDeHigiene } from './planilla';

export const metadata: Metadata = { title: 'Registrar la higiene' };

/**
 * Higiene de boxes (CUS03).
 *
 * La nómina son los boxes activos con su caballo alojado y cuándo se repuso la
 * cama por última vez, que es lo que el peón necesita para decidir si hoy toca
 * reponer o sólo limpiar.
 */
export default async function Higiene() {
  const api = await llamador();
  const [boxes, insumos] = await Promise.all([
    api.registroCuidado.boxesParaHigiene(),
    api.insumo.listar({ categoria: 'cama' }),
  ]);

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href="/campo/hoy" className="hover:underline">
          <ArrowLeft size={12} className="inline" aria-hidden="true" /> Mi jornada
        </Link>
      </p>

      <h1 className="mt-2 font-serif text-2xl">Higiene de boxes</h1>
      <p className="mt-1 text-sm text-muted">
        {boxes.length} {boxes.length === 1 ? 'box activo' : 'boxes activos'} con su última higiene
        registrada. Seleccionar los boxes higienizados.
      </p>

      {insumos.length === 0 && (
        <p className="helper mt-3">
          No hay material de cama registrado como insumo: la reposición se registra sin descontar
          existencias. Los insumos se dan de alta en Inventario.
        </p>
      )}

      <PlanillaDeHigiene
        boxes={boxes.map((b) => ({
          instalacionId: b.instalacionId,
          nombre: b.nombre,
          caballoId: b.caballo?.id ?? null,
          caballoNombre: b.caballo?.nombre ?? null,
          ultimaHigiene: b.ultimaHigiene,
        }))}
        insumos={insumos.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad }))}
      />
    </div>
  );
}

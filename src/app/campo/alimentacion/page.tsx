import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { MOMENTOS, MOMENTO_TEXTO, type Momento } from '@/lib/bienestar';
import { PlanillaDeAlimentacion, type TareaVisible } from './planilla';

export const metadata: Metadata = { title: 'Registrar la alimentación' };

function momentoValido(valor: string | undefined): Momento | undefined {
  return MOMENTOS.find((m) => m === valor);
}

/**
 * Alimentación de la jornada (CUS02).
 *
 * El momento viene por la URL para que sea compartible y recargable, y si no
 * viene lo propone el reloj. La pantalla no lo impone: los tres momentos están a
 * un toque, porque el peón puede estar registrando la toma del mediodía a las
 * once menos cinco.
 */
export default async function Alimentacion({
  searchParams,
}: PageProps<'/campo/alimentacion'>) {
  const { momento: pedido } = await searchParams;
  const api = await llamador();

  const turno = await api.registroCuidado.tareasDelTurno({
    momento: momentoValido(typeof pedido === 'string' ? pedido : undefined),
  });

  const tareas: TareaVisible[] = turno.tareas.map((t) => ({
    caballoId: t.caballo.id,
    nombre: t.caballo.nombre,
    instalacionNombre: t.caballo.instalacionNombre,
    enTratamiento: t.caballo.estado === 'en_tratamiento',
    hecho: t.hecho,
    descripcion: t.plan?.descripcion ?? null,
    cantidadKg: t.plan?.cantidadKg ?? null,
    insumoId: t.plan?.insumoId ?? null,
    insumoNombre: t.insumo?.nombre ?? null,
    insumoUnidad: t.insumo?.unidad ?? null,
    motivoSinRacion: t.motivoSinRacion,
  }));

  return (
    <div className="mx-auto max-w-2xl p-4 pb-24 md:p-8">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">
        <Link href="/campo/hoy" className="hover:underline">
          <ArrowLeft size={12} className="inline" aria-hidden="true" /> Mi jornada
        </Link>
      </p>

      <h1 className="mt-2 font-serif text-2xl">Alimentación</h1>
      <p className="mt-1 text-sm text-muted">
        {turno.pendientes === 0
          ? 'Toda la toma registrada.'
          : `${turno.pendientes} ${turno.pendientes === 1 ? 'caballo' : 'caballos'} por servir.`}
      </p>

      {/*
        Botones y no enlaces: el chip del prototipo se marca con `aria-pressed`,
        que es de botón. Van dentro de un formulario GET para que el momento
        siga viajando en la URL y la pantalla se pueda recargar y compartir.
      */}
      <form method="get" className="mt-4 flex gap-2" aria-label="Momento de la jornada">
        {MOMENTOS.map((m) => (
          <button
            key={m}
            type="submit"
            name="momento"
            value={m}
            className="chip"
            aria-pressed={m === turno.momento}
          >
            {MOMENTO_TEXTO[m]}
          </button>
        ))}
      </form>

      <PlanillaDeAlimentacion
        tareas={tareas}
        momento={turno.momento}
        momentoTexto={MOMENTO_TEXTO[turno.momento]}
        fecha={turno.fecha}
      />
    </div>
  );
}

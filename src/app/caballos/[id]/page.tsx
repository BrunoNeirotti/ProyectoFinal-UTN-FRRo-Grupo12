import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { FichaDeCaballo } from './ficha';
import { BienestarDelCaballo } from './bienestar';

export const metadata: Metadata = { title: 'Ficha de caballo' };

export default async function FichaCaballo({ params }: PageProps<'/caballos/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let ficha, clientes, instalaciones;
  try {
    // Las tres son independientes: se piden juntas para no pagar la latencia tres veces.
    [ficha, clientes, instalaciones] = await Promise.all([
      api.caballo.ficha({ caballoId: id }),
      api.cliente.listar(),
      api.instalacion.listar(),
    ]);
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <FichaDeCaballo
        ficha={ficha}
        propietarios={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
        instalaciones={instalaciones.map((i) => ({ id: i.id, nombre: i.nombre }))}
      />
      <BienestarDelCaballo caballoId={id} />
    </div>
  );
}

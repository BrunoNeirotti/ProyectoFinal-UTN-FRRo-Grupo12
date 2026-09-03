import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { FichaDeCaballo } from './ficha';

export const metadata: Metadata = { title: 'Ficha de caballo' };

export default async function FichaCaballo({ params }: PageProps<'/caballos/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let ficha;
  try {
    ficha = await api.caballo.ficha({ caballoId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const [clientes, instalaciones] = await Promise.all([api.cliente.listar(), api.instalacion.listar()]);

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-10">
      <FichaDeCaballo
        ficha={ficha}
        propietarios={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
        instalaciones={instalaciones.map((i) => ({ id: i.id, nombre: i.nombre }))}
      />
    </main>
  );
}

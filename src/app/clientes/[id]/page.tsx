import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { FichaCliente } from './ficha-cliente';

export const metadata: Metadata = { title: 'Ficha de cliente' };

export default async function FichaDeCliente({ params }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let ficha;
  try {
    ficha = await api.cliente.ficha({ clienteId: id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const servicios = await api.servicio.listar();

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <FichaCliente ficha={ficha} servicios={servicios} />
    </main>
  );
}

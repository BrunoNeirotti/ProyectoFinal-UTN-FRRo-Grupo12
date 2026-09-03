import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { FichaCliente } from './ficha-cliente';

export const metadata: Metadata = { title: 'Ficha de cliente' };

export default async function FichaDeCliente({ params }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let ficha, servicios;
  try {
    // Independientes entre sí: se piden juntas para no pagar la latencia dos veces.
    [ficha, servicios] = await Promise.all([api.cliente.ficha({ clienteId: id }), api.servicio.listar()]);
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <FichaCliente ficha={ficha} servicios={servicios} />
    </div>
  );
}

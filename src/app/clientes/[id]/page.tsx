import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { FichaCliente } from './ficha-cliente';
import { SeccionMensajes } from './mensajes';

export const metadata: Metadata = { title: 'Ficha de cliente' };

export default async function FichaDeCliente({ params }: PageProps<'/clientes/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let ficha, servicios, mensajes, plantillas;
  try {
    // Independientes entre sí: se piden juntas para no pagar la latencia varias veces.
    [ficha, servicios, mensajes, plantillas] = await Promise.all([
      api.cliente.ficha({ clienteId: id }),
      api.servicio.listar(),
      api.mensaje.historialDeCliente({ clienteId: id }),
      api.plantillaMensaje.listar(),
    ]);
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <FichaCliente ficha={ficha} servicios={servicios} />
      <SeccionMensajes clienteId={id} mensajes={mensajes} plantillas={plantillas} />
    </div>
  );
}

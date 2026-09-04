import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { DetalleDePago } from './detalle';

export const metadata: Metadata = { title: 'Detalle de pago' };

export default async function PagoDetalle({ params }: PageProps<'/pagos/[id]'>) {
  const { id } = await params;
  const api = await llamador();

  let pago;
  try {
    pago = await api.pago.detalle({ id });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia · Pagos</p>
      <h1 className="font-serif text-3xl text-fg">{pago.nombreCliente}</h1>
      <div className="mt-6">
        <DetalleDePago pago={pago} />
      </div>
    </div>
  );
}

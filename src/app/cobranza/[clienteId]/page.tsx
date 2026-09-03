import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { DetalleDeCuenta } from './detalle';

export const metadata: Metadata = { title: 'Cuenta corriente' };

export default async function CuentaDelCliente({ params }: PageProps<'/cobranza/[clienteId]'>) {
  const { clienteId } = await params;
  const api = await llamador();

  let ficha;
  try {
    ficha = await api.cliente.ficha({ clienteId });
  } catch (e) {
    if (e instanceof TRPCError && e.code === 'NOT_FOUND') notFound();
    throw e;
  }

  const [mayor, antiguedad, mora] = await Promise.all([
    api.cuentaCorriente.libroMayor({ clienteId }),
    api.cuentaCorriente.antiguedadDeuda({ clienteId }),
    api.cuentaCorriente.calcularMoraPropuesta({ clienteId }),
  ]);

  const nombre =
    ficha.cliente.tipo === 'persona_juridica'
      ? ficha.cliente.razon_social
      : `${ficha.cliente.persona?.apellido}, ${ficha.cliente.persona?.nombre}`;

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Gerencia · Cobranza</p>
      <h1 className="font-serif text-3xl text-fg">{nombre}</h1>
      <div className="mt-6">
        <DetalleDeCuenta clienteId={clienteId} mayor={mayor} antiguedad={antiguedad} mora={mora} />
      </div>
    </div>
  );
}

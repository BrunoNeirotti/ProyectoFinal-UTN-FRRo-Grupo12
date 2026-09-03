import type { Metadata } from 'next';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioNuevoAlumno } from '../formulario-nuevo';

export const metadata: Metadata = { title: 'Nuevo alumno' };

export default async function NuevoAlumno() {
  const api = await llamador();
  const clientes = await api.cliente.listar();

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-serif text-3xl text-fg">Nuevo alumno</h1>
      <p className="mt-1 text-fg-muted">
        Quien monta puede no ser quien paga: el cliente que se elige acá es quién factura por él.
      </p>
      <div className="mt-6">
        <FormularioNuevoAlumno clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
      </div>
    </div>
  );
}

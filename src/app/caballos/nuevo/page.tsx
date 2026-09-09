import type { Metadata } from 'next';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioNuevoCaballo } from '../formulario-nuevo';

export const metadata: Metadata = { title: 'Nuevo caballo' };

export default async function NuevoCaballo() {
  const api = await llamador();
  const [clientes, instalaciones] = await Promise.all([api.cliente.listar(), api.instalacion.listar()]);

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-serif text-3xl text-fg">Nuevo caballo</h1>
      <p className="mt-1 text-fg-muted">
        Alta de caballo. Sin propietario asignado se registra como caballo del establecimiento.
      </p>
      <div className="mt-6">
        <FormularioNuevoCaballo
          propietarios={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
          instalaciones={instalaciones.map((i) => ({ id: i.id, nombre: i.nombre }))}
        />
      </div>
    </div>
  );
}

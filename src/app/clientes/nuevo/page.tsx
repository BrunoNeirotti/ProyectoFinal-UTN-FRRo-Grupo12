import type { Metadata } from 'next';
import { FormularioNuevoCliente } from '../formulario-nuevo';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default function NuevoCliente() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-serif text-3xl text-fg">Nuevo cliente</h1>
      <p className="mt-1 text-fg-muted">
        Alta de cliente. Es la unidad de facturación y titular de la cuenta corriente.
      </p>
      <div className="mt-6">
        <FormularioNuevoCliente />
      </div>
    </div>
  );
}

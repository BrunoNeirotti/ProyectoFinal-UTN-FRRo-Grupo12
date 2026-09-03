import type { Metadata } from 'next';
import { FormularioNuevoCliente } from '../formulario-nuevo';

export const metadata: Metadata = { title: 'Nuevo cliente' };

export default function NuevoCliente() {
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="font-serif text-3xl text-fg">Nuevo cliente</h1>
      <p className="mt-1 text-fg-muted">
        La unidad de facturación: quien tiene cuenta corriente. No es lo mismo que el alumno que
        monta ni que el caballo que se aloja.
      </p>
      <div className="mt-6">
        <FormularioNuevoCliente />
      </div>
    </main>
  );
}

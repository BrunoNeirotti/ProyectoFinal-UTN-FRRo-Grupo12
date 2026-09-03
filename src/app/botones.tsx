'use client';

import { useFormStatus } from 'react-dom';

/** Botón de envío de formulario, con su propio estado de carga vía `useFormStatus`. */
export function BotonEnviar({
  texto,
  cargando,
  variante = 'pri',
  tamano,
}: {
  texto: string;
  cargando?: string;
  variante?: 'pri' | 'sec';
  tamano?: 'sm';
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn btn-${variante}${tamano ? ` btn-${tamano}` : ''}`}
    >
      {pending ? (cargando ?? 'Guardando…') : texto}
    </button>
  );
}

'use client';

import { useFormStatus } from 'react-dom';

/** Botón de envío de formulario, con su propio estado de carga vía `useFormStatus`. */
export function BotonEnviar({
  texto,
  cargando,
  variante = 'pri',
  tamano,
  name,
  value,
}: {
  texto: string;
  cargando?: string;
  variante?: 'pri' | 'sec';
  tamano?: 'sm';
  /** Para formularios con más de un botón de envío: llega en el `FormData`. */
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`btn btn-${variante}${tamano ? ` btn-${tamano}` : ''}`}
    >
      {pending ? (cargando ?? 'Guardando…') : texto}
    </button>
  );
}

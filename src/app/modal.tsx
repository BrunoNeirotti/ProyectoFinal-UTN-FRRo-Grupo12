'use client';

import { useRef } from 'react';
import { X } from '@phosphor-icons/react';

/**
 * Diálogo modal para los formularios de edición.
 *
 * Reemplaza a los `<details>` que se abrían dentro de una celda: un panel
 * adentro de una tabla le ensancha la columna, deforma la grilla entera y deja
 * el formulario en un espacio angosto, que es exactamente lo que no se quiere
 * para editar seis campos.
 *
 * Usa el `<dialog>` del navegador y no una superposición armada a mano. Lo que
 * se gana no es sólo código de menos: `showModal()` atrapa el foco adentro del
 * diálogo, cierra con Esc, vuelve el foco al botón que lo abrió e inertiza el
 * resto de la página. Reproducir eso a mano es la clase de trabajo que siempre
 * queda a medias y se nota recién con el teclado.
 *
 * El diálogo NO se cierra solo al guardar. La acción revalida la página que
 * quedó atrás, y dejarlo abierto es lo que permite leer el resultado —«Guardado»
 * o el error— donde uno estaba mirando.
 */
export function Modal({
  etiqueta,
  titulo,
  children,
  variante = 'gho',
  tamano = 'sm',
}: {
  /** Texto del botón que lo abre. */
  etiqueta: string;
  /** Encabezado del diálogo. Dice sobre qué se está actuando. */
  titulo: string;
  children: React.ReactNode;
  variante?: 'pri' | 'sec' | 'gho';
  tamano?: 'sm';
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className={`btn btn-${variante}${tamano ? ` btn-${tamano}` : ''}`}
        onClick={() => dialogo.current?.showModal()}
      >
        {etiqueta}
      </button>

      <dialog
        ref={dialogo}
        className="modal"
        aria-label={titulo}
        // Cerrar al apretar el fondo: el `::backdrop` no recibe eventos propios,
        // pero un clic sobre él llega al `<dialog>` y no a la caja de adentro.
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
      >
        <div className="modal-caja">
          <div className="modal-encabezado">
            <h3 className="font-serif text-lg">{titulo}</h3>
            <button
              type="button"
              className="ic"
              onClick={() => dialogo.current?.close()}
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="modal-cuerpo">{children}</div>
        </div>
      </dialog>
    </>
  );
}

/**
 * Isotipo de RIENDA.
 *
 * Copia literal de la geometría de `RIENDA-Diseño/fase2/assets/marca.svg`, que
 * es la fuente de verdad del dibujo: un gesto continuo —asta, lazada y remate
 * que vuelve hacia la derecha, como una rienda que se enrolla y se suelta— más
 * la pierna, el trazo corto que baja al ángulo inferior derecho y fija la
 * lectura en R y no en P. La pierna va despegada de la panza a propósito:
 * pegadas, las dos curvas se empastan en el cruce.
 *
 * **Va en línea y no como `<img src="marca.svg">`** por la misma razón que en el
 * prototipo: una imagen externa no hereda `currentColor`, y la barra lateral
 * necesita que el isotipo tome el oro del tema activo. Las tres versiones de la
 * identidad —oro sobre cacao, cacao sobre crema y monocroma— son este mismo
 * dibujo con otro color heredado.
 *
 * Si se corrige un trazo, se corrige en `marca.svg` primero y después acá.
 */
export function Isotipo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={6.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M26.8,82 V24 C26.8,10 62.8,10 62.8,28 C62.8,48 32.8,44 20.8,56 C28.8,68 50.8,66 66.8,58" />
      <path d="M60.4,48 L77,71.5" />
    </svg>
  );
}

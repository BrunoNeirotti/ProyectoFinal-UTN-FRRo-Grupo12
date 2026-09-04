'use client';

export function BotonImprimir() {
  return (
    <button type="button" className="btn btn-sec" onClick={() => window.print()}>
      Imprimir
    </button>
  );
}

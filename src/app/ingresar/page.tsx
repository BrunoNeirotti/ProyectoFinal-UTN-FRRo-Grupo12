import { Suspense } from 'react';
import type { Metadata } from 'next';
import { FormularioDeIngreso } from './formulario';

export const metadata: Metadata = { title: 'Acceso al sistema' };

/**
 * Pantalla de acceso.
 *
 * Sigue la pantalla 1 del prototipo: bloque oscuro sobre el fondo crema, una
 * sola llamada a la acción y el mínimo de campos. No se explica de más ni se
 * ofrece registro: los usuarios los da de alta el administrador (M1), no se
 * autorregistran.
 */
export default function Ingresar() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-feature p-8 text-feature-fg shadow-md">
        <p className="text-xs tracking-widest text-feature-muted uppercase">Haras Las Lechuzas</p>
        <h1 className="mt-1 font-serif text-2xl">Acceso al sistema</h1>
        {/* El formulario lee `volver` de la URL, y eso obliga a un límite de
            suspenso para que la pantalla se pueda prerenderizar. Sin él, la
            compilación falla al exportar esta ruta. */}
        <Suspense fallback={<p className="mt-6 text-feature-muted">Cargando…</p>}>
          <FormularioDeIngreso />
        </Suspense>
      </div>
    </div>
  );
}

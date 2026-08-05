/**
 * Página provisoria del andamiaje.
 *
 * No es una pantalla del sistema: las 23 pantallas están diseñadas y se
 * construyen módulo por módulo, empezando por M1. Esto existe para verificar que
 * los tokens de color portados desde `rienda.css` se resuelven, que las dos
 * familias tipográficas cargan y que el tema oscuro conmuta. Se reemplaza al
 * montar el acceso.
 */
export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <p className="text-sm tracking-wide text-fg-muted uppercase">Haras Las Lechuzas</p>
        <h1 className="font-serif text-4xl text-fg">RIENDA</h1>
        <p className="mt-1 text-fg-muted">
          Red Integral Ecuestre de Negocio, Datos y Administración
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-sm">
        <h2 className="font-serif text-xl text-fg">Bases de arquitectura</h2>
        <ul className="mt-3 space-y-1 text-sm text-fg-muted">
          <li>Esquema de 33 entidades con sus invariantes en la base</li>
          <li>Control de acceso por rol con seguridad a nivel de fila</li>
          <li>Traza de auditoría por disparador</li>
          <li>Capa de acceso con validación en los bordes</li>
        </ul>
      </div>

      <div className="rounded-xl bg-accent px-4 py-3 text-accent-fg">
        <span className="font-semibold">Tokens activos.</span> Si este bloque se ve dorado con
        texto cacao, el sistema de diseño quedó bien portado.
      </div>
    </main>
  );
}

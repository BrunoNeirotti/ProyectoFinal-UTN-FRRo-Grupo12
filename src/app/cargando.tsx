/**
 * Esqueleto de carga compartido por las rutas de listado.
 *
 * Next dibuja esto de inmediato al navegar mientras la pantalla server-side
 * todavía está pidiendo datos: sin esto, un clic no muestra nada hasta que la
 * consulta a la base vuelve, y eso se siente como que el sistema no respondió.
 */
export function Cargando() {
  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="shimmer h-3 w-24 rounded" />
          <div className="shimmer h-8 w-56 rounded" />
        </div>
        <div className="shimmer h-9 w-32 rounded-lg" />
      </div>
      <div className="card mt-6 space-y-3 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="shimmer h-8 rounded" />
        ))}
      </div>
    </div>
  );
}

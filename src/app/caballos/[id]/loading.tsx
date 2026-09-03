export default function Cargando() {
  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="card space-y-3 p-5">
        <div className="shimmer h-7 w-48 rounded" />
        <div className="shimmer h-4 w-32 rounded" />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-10 rounded" />)}
        </div>
      </div>
    </div>
  );
}

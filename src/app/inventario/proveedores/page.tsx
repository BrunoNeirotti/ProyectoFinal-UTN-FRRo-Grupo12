import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';
import { FormularioNuevoProveedor, InterruptorProveedor } from './formularios';

export const metadata: Metadata = { title: 'Proveedores' };

/** Se guarda sin separadores; se muestra como se lee. */
function cuitLegible(cuit: string | null): string {
  if (!cuit || cuit.length !== 11) return cuit ?? '—';
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
}

/**
 * Proveedores.
 *
 * La agenda de a quién se le compra. Los inactivos se listan igual, en gris:
 * borrarlos no es una opción -sus órdenes los referencian y siguen explicando el
 * gasto del año pasado- y esconderlos haría que un proveedor desactivado por
 * error fuera imposible de recuperar.
 */
export default async function Proveedores() {
  const api = await llamador();
  const proveedores = await api.proveedor.listar({ incluirInactivos: true });

  const activos = proveedores.filter((p) => p.activo);
  const inactivos = proveedores.filter((p) => !p.activo);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <Link href="/inventario" className="link text-sm">
        ← Inventario
      </Link>

      <h1 className="mt-2 font-serif text-2xl">Proveedores</h1>
      <p className="mt-1 text-sm text-muted">
        Proveedores habilitados para emitir órdenes de compra. El CUIT es opcional.
      </p>

      <section className="mt-6" aria-labelledby="h-activos">
        <h2 id="h-activos" className="font-serif text-lg">
          Activos
        </h2>
        {activos.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">
            No hay proveedores registrados. Se requiere al menos uno para emitir órdenes de compra.
          </p>
        ) : (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th scope="col">Razón social</th>
                <th scope="col">CUIT</th>
                <th scope="col">Contacto</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {activos.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.razon_social}</td>
                  <td className="tnum text-muted">{cuitLegible(p.cuit)}</td>
                  <td className="text-muted">
                    {p.telefono ?? p.email ?? '—'}
                    {p.telefono && p.email && <span className="block text-xs">{p.email}</span>}
                  </td>
                  <td>
                    <InterruptorProveedor proveedorId={p.id} activo={p.activo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {inactivos.length > 0 && (
        <section className="mt-8" aria-labelledby="h-inactivos">
          <h2 id="h-inactivos" className="font-serif text-lg">
            Inactivos
          </h2>
          <p className="helper mt-1">
            No se ofrecen al emitir una orden nueva. Las órdenes anteriores conservan su proveedor.
          </p>
          <table className="tbl mt-2 opacity-70">
            <thead>
              <tr>
                <th scope="col">Razón social</th>
                <th scope="col">CUIT</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {inactivos.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.razon_social}</td>
                  <td className="tnum text-muted">{cuitLegible(p.cuit)}</td>
                  <td>
                    <InterruptorProveedor proveedorId={p.id} activo={p.activo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-8">
        <FormularioNuevoProveedor />
      </section>
    </div>
  );
}

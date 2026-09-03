import type { Metadata } from 'next';
import Link from 'next/link';
import { llamador } from '@/lib/trpc/servidor';

export const metadata: Metadata = { title: 'Clientes y contratos' };

/** Pantalla 8 del prototipo: padrón de clientes con el aviso de contratos por vencer. */
export default async function Clientes() {
  const api = await llamador();
  const [clientes, porVencer] = await Promise.all([
    api.cliente.listar(),
    api.contrato.porVencer({ dentroDeDias: 30 }),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-fg">Clientes y contratos</h1>
          <p className="mt-1 text-fg-muted">
            El origen de todos los cargos. Un cliente sin contratos vigentes no genera ni un cargo.
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg"
        >
          Nuevo cliente
        </Link>
      </div>

      {porVencer.length > 0 && (
        <div className="mt-6 rounded-xl border border-accent bg-accent-soft p-4">
          <p className="font-medium text-fg">
            {porVencer.length} {porVencer.length === 1 ? 'contrato vence' : 'contratos vencen'} dentro de los próximos 30 días
          </p>
          <ul className="mt-2 space-y-1 text-sm text-fg-muted">
            {porVencer.map((c) => (
              <li key={c.id}>
                <Link href={`/clientes/${c.cliente?.id}`} className="text-accent-ink underline">
                  {c.cliente?.tipo === 'persona_juridica'
                    ? c.cliente.razon_social
                    : `${c.cliente?.persona?.apellido}, ${c.cliente?.persona?.nombre}`}
                </Link>{' '}
                · {c.servicio?.nombre} · vence {c.fecha_fin}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-surface-border bg-surface shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">Padrón de clientes con lo que cada uno tiene enganchado.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Contratos</th>
              <th className="px-4 py-3 text-right font-medium">Caballos</th>
              <th className="px-4 py-3 text-right font-medium">Alumnos</th>
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {clientes.map((c) => (
              <tr key={c.id} className={`border-b border-surface-border ${c.activo ? '' : 'text-fg-muted'}`}>
                <td className="px-4 py-3">
                  <Link href={`/clientes/${c.id}`} className="font-medium text-fg hover:text-accent-ink">
                    {c.nombre}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">{c.tipo === 'persona_juridica' ? 'Jurídica' : 'Física'}</td>
                <td className="px-4 py-3 text-right">{c.contratos}</td>
                <td className="px-4 py-3 text-right">{c.caballos}</td>
                <td className="px-4 py-3 text-right">{c.alumnos}</td>
                <td className="px-4 py-3 text-xs">{c.canalPreferido === 'whatsapp' ? 'WhatsApp' : 'Correo'}</td>
                <td className="px-4 py-3 text-xs">{c.activo ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-fg-muted">
                  Todavía no hay clientes cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

import { llamador } from '@/lib/trpc/servidor';
import { MOMENTO_TEXTO, clasificarVencimiento } from '@/lib/bienestar';
import { esAdministrador } from '@/lib/roles';
import { antelacionDeAvisoSanitario } from '@/server/parametros-servidor';
import { clienteDeServidor } from '@/lib/supabase/servidor';
import { FormularioPlan } from './formulario-plan';

const TIPO_TEXTO: Record<string, string> = {
  desparasitacion: 'Desparasitación',
  vacunacion: 'Vacunación',
  herrador: 'Herrador',
  veterinario: 'Veterinario',
  otro: 'Otro',
  alimentacion: 'Alimentación',
  higiene: 'Higiene',
};

const ESTADO_BADGE: Record<string, string> = {
  previsto: 'badge-accent',
  aplicado: 'badge-ok',
  omitido: 'badge-warn',
};

function fechaCorta(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: iso.length === 10 ? 'UTC' : 'America/Argentina/Buenos_Aires',
  });
}

/**
 * Las secciones de M9 dentro de la ficha del caballo.
 *
 * Van como componente aparte y no dentro de `ficha.tsx` porque esa ficha es de
 * M2 y es un componente de cliente: meter acá las tres consultas nuevas la
 * obligaría a recibirlas por props desde la página y a re-renderizarse entera
 * cuando cambia cualquiera. Así cada módulo trae lo suyo y la ficha de M2 queda
 * como estaba, que es lo que su propio comentario anticipaba.
 */
export async function BienestarDelCaballo({ caballoId }: { caballoId: string }) {
  const api = await llamador();
  const supabase = await clienteDeServidor();

  const [quien, planes, sanidad, registros, insumos, diasDeAviso] = await Promise.all([
    api.quienSoy(),
    api.planAlimentario.porCaballo({ caballoId }),
    api.eventoSanitario.porCaballo({ caballoId }),
    api.registroCuidado.listar({ caballoId }),
    api.insumo.listar({ categoria: 'alimento' }),
    antelacionDeAvisoSanitario(supabase),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const esAdmin = esAdministrador(quien.rol);

  return (
    <>
      <section className="mt-8">
        <h2 className="font-serif text-lg">Plan alimentario</h2>
        {planes.planes.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">
            Sin plan cargado. La toma se registra igual, con carga manual de la cantidad.
          </p>
        ) : (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Momento</th>
                <th>Ración</th>
                <th>Cantidad</th>
                <th>Insumo</th>
                <th>Rige desde</th>
              </tr>
            </thead>
            <tbody>
              {planes.planes.map((p) => (
                <tr key={p.id} className={p.vigente ? undefined : 'opacity-55'}>
                  <td>
                    {MOMENTO_TEXTO[p.momento]}
                    {p.vigente && <span className="badge badge-ok ml-2">vigente</span>}
                  </td>
                  <td>{p.descripcion}</td>
                  <td className="tnum">{p.cantidad_kg ?? '—'}</td>
                  <td>{p.insumo?.nombre ?? 'no descuenta'}</td>
                  <td className="tnum">{fechaCorta(p.vigente_desde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {esAdmin && (
          <FormularioPlan
            caballoId={caballoId}
            insumos={insumos.map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad }))}
          />
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Historial sanitario</h2>
        {sanidad.rotacion.length > 1 && (
          <p className="mt-1 text-sm text-muted">
            Rotación de droga: {sanidad.rotacion.join(' → ')}
          </p>
        )}

        {sanidad.eventos.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">Sin eventos sanitarios registrados.</p>
        ) : (
          <table className="tbl mt-2">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Producto</th>
                <th>Próxima</th>
              </tr>
            </thead>
            <tbody>
              {sanidad.eventos.map((e) => {
                const vence =
                  e.estado === 'aplicado'
                    ? clasificarVencimiento(e.proxima_fecha, hoy, diasDeAviso)
                    : null;
                return (
                  <tr key={e.id}>
                    <td className="tnum">{fechaCorta(e.fecha)}</td>
                    <td>{TIPO_TEXTO[e.tipo] ?? e.tipo}</td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[e.estado]}`}>{e.estado}</span>
                    </td>
                    <td>
                      {[e.producto, e.dosis].filter(Boolean).join(' · ') || '—'}
                      {e.observaciones && (
                        <span className="block text-sm text-muted">{e.observaciones}</span>
                      )}
                    </td>
                    <td className="tnum">
                      {e.proxima_fecha ? fechaCorta(e.proxima_fecha) : '—'}
                      {vence === 'vencido' && <span className="badge badge-bad ml-2">vencido</span>}
                      {vence === 'por_vencer' && (
                        <span className="badge badge-warn ml-2">por vencer</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg">Cuidados de los últimos 30 días</h2>
        {registros.length === 0 ? (
          <p className="card mt-2 p-5 text-sm text-muted">Sin registros en el período.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {registros.slice(0, 20).map((r) => (
              <li key={r.id} className="card flex flex-wrap items-baseline gap-x-3 p-3 text-sm">
                <span className="tnum text-muted">{fechaCorta(r.ocurrido_en)}</span>
                <span className="font-medium">{TIPO_TEXTO[r.tipo] ?? r.tipo}</span>
                {r.instalacion?.nombre && <span className="text-muted">{r.instalacion.nombre}</span>}
                <span className="text-muted">
                  {r.usuario?.persona
                    ? `${r.usuario.persona.nombre} ${r.usuario.persona.apellido}`
                    : ''}
                </span>
                {r.observaciones && <span className="w-full text-muted">{r.observaciones}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

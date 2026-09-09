'use client';

import { useActionState, useMemo, useState } from 'react';
import { WhatsappLogo, Envelope, CheckCircle, Clock, XCircle } from '@phosphor-icons/react';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { enviarMensaje } from '../acciones-mensaje';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { rotuloDeVariable, variablesDe } from '@/lib/mensajeria';
import { BotonEnviar } from '../../botones';
import { Modal } from '../../modal';

type Salidas = inferRouterOutputs<RouterApp>;
type Mensaje = Salidas['mensaje']['historialDeCliente'][number];
type Plantilla = Salidas['plantillaMensaje']['listar'][number];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

const ESTADO_BADGE = {
  pendiente: '',
  enviado: 'badge-accent',
  entregado: 'badge-ok',
  leido: 'badge-ok',
  fallido: 'badge-bad',
} as const;
const ESTADO_TEXTO = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  leido: 'Leído',
  fallido: 'Fallido',
} as const;
const ESTADO_ICONO = {
  pendiente: Clock,
  enviado: CheckCircle,
  entregado: CheckCircle,
  leido: CheckCircle,
  fallido: XCircle,
} as const;

export function SeccionMensajes({
  clienteId,
  mensajes,
  plantillas,
}: {
  clienteId: string;
  mensajes: Mensaje[];
  plantillas: Plantilla[];
}) {
  const enviables = plantillas.filter(
    (p) => p.activa && (p.canal === 'email' || p.estado_aprobacion === 'aprobada'),
  );

  return (
    <section className="card p-5">
      <h2 className="font-serif text-lg text-fg">Mensajes</h2>
      <p className="mt-1 text-xs text-fg-muted">Trazabilidad de «se le avisó»: qué se le mandó, por dónde y con qué resultado.</p>

      <div className="mt-3 overflow-x-auto">
        <table className="tbl">
          <caption className="sr-only">Historial de mensajes enviados al cliente.</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Plantilla</th>
              <th scope="col">Canal</th>
              <th scope="col">Destino</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {mensajes.map((m) => {
              const Icono = ESTADO_ICONO[m.estado];
              return (
                <tr key={m.id}>
                  <td className="text-xs">{new Date(m.creado_en).toLocaleString('es-AR')}</td>
                  <td>
                    <code className="text-xs">{m.plantilla?.codigo ?? '—'}</code>
                  </td>
                  <td className="text-xs">
                    {m.canal === 'whatsapp' ? <WhatsappLogo size={14} aria-hidden="true" /> : <Envelope size={14} aria-hidden="true" />}
                  </td>
                  <td className="text-xs">{m.destino}</td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[m.estado]}`}>
                      <Icono size={12} aria-hidden="true" />
                      {ESTADO_TEXTO[m.estado]}
                    </span>
                    {m.error && <p className="mt-0.5 text-xs text-bad">{m.error}</p>}
                  </td>
                </tr>
              );
            })}
            {mensajes.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-fg-muted">Sin mensajes enviados.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Modal etiqueta="Enviar un mensaje" titulo="Enviar un mensaje" variante="sec">
          <FormularioEnvio clienteId={clienteId} plantillas={enviables} />
        </Modal>
      </div>
    </section>
  );
}

function FormularioEnvio({ clienteId, plantillas }: { clienteId: string; plantillas: Plantilla[] }) {
  const [resultado, enviar] = useActionState(enviarMensaje, inicial);
  const [plantillaId, setPlantillaId] = useState(plantillas[0]?.id ?? '');
  const [valores, setValores] = useState<Record<string, string>>({});

  const plantilla = plantillas.find((p) => p.id === plantillaId);
  const variables = useMemo(() => (plantilla ? variablesDe(plantilla.cuerpo) : []), [plantilla]);

  if (plantillas.length === 0) {
    return <p className="helper mt-2">No hay plantillas activas y aprobadas para enviar.</p>;
  }

  return (
    <form action={enviar} className="card mt-2 space-y-3 p-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="plantillaId" value={plantillaId} />
      <input type="hidden" name="variables" value={JSON.stringify(valores)} />

      <label className="block">
        <span className="label">Plantilla</span>
        <select
          value={plantillaId}
          onChange={(e) => {
            setPlantillaId(e.target.value);
            setValores({});
          }}
          className="input"
        >
          {plantillas.map((p) => (
            <option key={p.id} value={p.id}>{p.codigo} · {p.canal === 'whatsapp' ? 'WhatsApp' : 'Correo'}</option>
          ))}
        </select>
      </label>

      {plantilla && (
        <p className="helper rounded-lg border border-surface-border bg-bg p-2 font-mono text-xs">{plantilla.cuerpo}</p>
      )}

      {variables.map((v) => (
        <label key={v} className="block">
          <span className="label">{rotuloDeVariable(v)}</span>
          <input
            required
            value={valores[v] ?? ''}
            onChange={(e) => setValores((prev) => ({ ...prev, [v]: e.target.value }))}
            className="input"
          />
        </label>
      ))}

      {resultado.estado === 'error' && <p className="error">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="helper text-ok">Mensaje encolado.</p>}
      <BotonEnviar texto="Enviar" cargando="Enviando…" variante="sec" />
    </form>
  );
}

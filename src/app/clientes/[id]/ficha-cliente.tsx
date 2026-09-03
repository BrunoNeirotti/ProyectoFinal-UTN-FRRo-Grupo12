'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { desactivarCliente, modificarCliente, registrarConsentimiento, revocarConsentimiento } from '../acciones';
import { crearContrato, darDeBajaContrato, modificarContrato } from '../acciones-contrato';
import type { ResultadoDeGuardado } from '@/lib/formularios';

type Salidas = inferRouterOutputs<RouterApp>;
type Ficha = Salidas['cliente']['ficha'];
type Servicio = Salidas['servicio']['listar'][number];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

function nombreCliente(cliente: Ficha['cliente']) {
  return cliente.tipo === 'persona_juridica'
    ? (cliente.razon_social ?? '')
    : `${cliente.persona?.apellido ?? ''}, ${cliente.persona?.nombre ?? ''}`;
}

export function FichaCliente({ ficha, servicios }: { ficha: Ficha; servicios: Servicio[] }) {
  const { cliente, contratos, caballos, alumnos } = ficha;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-fg">{nombreCliente(cliente)}</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              {cliente.tipo === 'persona_juridica' ? 'Persona jurídica' : 'Persona física'}
              {!cliente.activo && ' · inactivo'}
            </p>
          </div>
          <details>
            <summary className="cursor-pointer rounded-lg border border-surface-border px-3 py-1.5 text-sm text-fg-muted">
              Editar
            </summary>
            <FormularioEditar cliente={cliente} />
          </details>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-fg-muted">CUIT</dt>
            <dd className="tnum">{cliente.cuit ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Condición IVA</dt>
            <dd>{cliente.condicion_iva ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Canal preferido</dt>
            <dd>{cliente.canal_preferido === 'whatsapp' ? 'WhatsApp' : 'Correo'}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-muted">Día de vencimiento</dt>
            <dd className="tnum">{cliente.dia_vencimiento ?? 'Por omisión'}</dd>
          </div>
        </dl>

        <ConsentimientoWidget cliente={cliente} />
      </section>

      <SeccionContratos
        clienteId={cliente.id}
        contratos={contratos}
        servicios={servicios}
        caballos={caballos}
        alumnos={alumnos}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
          <h2 className="font-serif text-lg text-fg">Caballos</h2>
          {caballos.length === 0 && <p className="mt-2 text-sm text-fg-muted">Sin caballos a pupilaje.</p>}
          <ul className="mt-2 space-y-2">
            {caballos.map((c) => (
              <li key={c.id}>
                <Link href={`/caballos/${c.id}`} className="text-sm font-medium text-fg hover:text-accent-ink">
                  {c.nombre}
                </Link>
                <span className="ml-2 text-xs text-fg-muted">{c.instalacion?.nombre ?? 'sin instalación'}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
          <h2 className="font-serif text-lg text-fg">Alumnos</h2>
          {alumnos.length === 0 && <p className="mt-2 text-sm text-fg-muted">Sin alumnos.</p>}
          <ul className="mt-2 space-y-2">
            {alumnos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-fg">{a.persona?.apellido}, {a.persona?.nombre}</span>
                {a.consentimiento_tutor_en ? (
                  <span className="text-xs text-ok">Consentimiento OK</span>
                ) : (
                  <span className="text-xs text-bad">Sin consentimiento</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-bad">Desactivar cliente</summary>
        <FormularioDesactivar clienteId={cliente.id} />
      </details>
    </div>
  );
}

function ConsentimientoWidget({ cliente }: { cliente: Ficha['cliente'] }) {
  const vigente = cliente.consentimiento_en && !cliente.consentimiento_revocado_en;
  const [resultadoReg, enviarReg] = useActionState(registrarConsentimiento, inicial);
  const [resultadoRev, enviarRev] = useActionState(revocarConsentimiento, inicial);

  return (
    <div className="mt-4 rounded-lg border border-surface-border p-3 text-sm">
      <p>
        Consentimiento de mensajería:{' '}
        {vigente ? (
          <span className="text-ok">otorgado el {cliente.consentimiento_en?.slice(0, 10)}</span>
        ) : (
          <span className="text-bad">no vigente</span>
        )}
      </p>
      {vigente ? (
        <form action={enviarRev} className="mt-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <BotonSecundario texto="Revocar" />
          {resultadoRev.estado === 'error' && <p className="mt-1 text-xs text-bad">{resultadoRev.mensaje}</p>}
        </form>
      ) : (
        <form action={enviarReg} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="clienteId" value={cliente.id} />
          <label className="text-xs text-fg-muted">
            Medio
            <input name="medio" required placeholder="WhatsApp, verbal, formulario…" className={comun} />
          </label>
          <BotonSecundario texto="Registrar consentimiento" />
          {resultadoReg.estado === 'error' && <p className="text-xs text-bad">{resultadoReg.mensaje}</p>}
        </form>
      )}
    </div>
  );
}

function FormularioEditar({ cliente }: { cliente: Ficha['cliente'] }) {
  const [resultado, enviar] = useActionState(modificarCliente, inicial);
  const [requiereFactura, setRequiereFactura] = useState(cliente.requiere_factura);

  return (
    <form action={enviar} className="mt-3 max-w-xl space-y-3 rounded-lg border border-surface-border p-4">
      <input type="hidden" name="clienteId" value={cliente.id} />
      {cliente.tipo === 'persona_juridica' && (
        <label className="block text-xs text-fg-muted">
          Razón social
          <input name="razonSocial" defaultValue={cliente.razon_social ?? ''} required className={comun} />
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Canal preferido
          <select name="canalPreferido" defaultValue={cliente.canal_preferido} className={comun}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Día de vencimiento pactado
          <input
            name="diaVencimiento"
            type="number"
            min="1"
            max="28"
            defaultValue={cliente.dia_vencimiento ?? ''}
            className={comun}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          name="requiereFactura"
          value="true"
          checked={requiereFactura}
          onChange={(e) => setRequiereFactura(e.target.checked)}
        />
        Pide factura
      </label>
      {requiereFactura && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-fg-muted">
            CUIT
            <input name="cuit" defaultValue={cliente.cuit ?? ''} required className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Condición frente al IVA
            <select name="condicionIva" defaultValue={cliente.condicion_iva ?? ''} required className={comun}>
              <option value="">Elegir…</option>
              <option value="responsable_inscripto">Responsable inscripto</option>
              <option value="monotributo">Monotributo</option>
              <option value="consumidor_final">Consumidor final</option>
              <option value="exento">Exento</option>
            </select>
          </label>
        </div>
      )}
      {resultado.estado === 'error' && <p className="text-xs text-bad">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="text-xs text-ok">Guardado.</p>}
      <BotonEnviar texto="Guardar cambios" />
    </form>
  );
}

function FormularioDesactivar({ clienteId }: { clienteId: string }) {
  const [resultado, enviar] = useActionState(desactivarCliente, inicial);
  return (
    <form action={enviar} className="mt-2">
      <input type="hidden" name="clienteId" value={clienteId} />
      <p className="text-xs text-fg-muted">
        No borra nada: el cliente queda inactivo pero su historial se conserva.
      </p>
      <div className="mt-2">
        <BotonSecundario texto="Confirmar baja" />
      </div>
      {resultado.estado === 'error' && <p className="mt-1 text-xs text-bad">{resultado.mensaje}</p>}
    </form>
  );
}

function SeccionContratos({
  clienteId,
  contratos,
  servicios,
  caballos,
  alumnos,
}: {
  clienteId: string;
  contratos: Ficha['contratos'];
  servicios: Servicio[];
  caballos: Ficha['caballos'];
  alumnos: Ficha['alumnos'];
}) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
      <h2 className="font-serif text-lg text-fg">Contratos</h2>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Contratos del cliente con su servicio, importe y estado.</caption>
          <thead>
            <tr className="border-b border-surface-border text-left text-fg-muted">
              <th className="py-2 pr-3 font-medium">Servicio</th>
              <th className="py-2 pr-3 font-medium">Aplica a</th>
              <th className="py-2 pr-3 font-medium">Desde</th>
              <th className="py-2 pr-3 text-right font-medium">Importe pactado</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {contratos.map((c) => (
              <FilaContrato key={c.id} contrato={c} clienteId={clienteId} />
            ))}
            {contratos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-fg-muted">Sin contratos.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-accent-ink">Nuevo contrato</summary>
        <FormularioNuevoContrato
          clienteId={clienteId}
          servicios={servicios}
          caballos={caballos}
          alumnos={alumnos}
        />
      </details>
    </section>
  );
}

function FilaContrato({ contrato: c, clienteId }: { contrato: Ficha['contratos'][number]; clienteId: string }) {
  const objeto = c.caballo ? c.caballo.nombre : c.alumno ? `${c.alumno.persona?.apellido}, ${c.alumno.persona?.nombre}` : '—';
  return (
    <tr className="border-b border-surface-border align-top">
      <td className="py-2 pr-3 font-medium">{c.servicio?.nombre}</td>
      <td className="py-2 pr-3">{objeto}</td>
      <td className="py-2 pr-3">{c.fecha_inicio}</td>
      <td className="py-2 pr-3 text-right">{c.importe_pactado ? `$${Number(c.importe_pactado).toLocaleString('es-AR')}` : '—'}</td>
      <td className="py-2">
        <details>
          <summary className="cursor-pointer text-accent-ink">{c.estado}</summary>
          <FormularioEditarContrato contrato={c} clienteId={clienteId} />
        </details>
      </td>
    </tr>
  );
}

function FormularioEditarContrato({
  contrato: c,
  clienteId,
}: {
  contrato: Ficha['contratos'][number];
  clienteId: string;
}) {
  const [resultado, enviar] = useActionState(modificarContrato, inicial);
  const [resultadoBaja, enviarBaja] = useActionState(darDeBajaContrato, inicial);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-surface-border p-3">
      <form action={enviar} className="space-y-2">
        <input type="hidden" name="contratoId" value={c.id} />
        <input type="hidden" name="clienteId" value={clienteId} />
        <label className="block text-xs text-fg-muted">
          Estado
          <select name="estado" defaultValue={c.estado ?? 'vigente'} className={comun}>
            <option value="vigente">Vigente</option>
            <option value="suspendido">Suspendido</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Importe pactado (vacío = tarifa vigente)
          <input name="importePactado" type="number" min="0" step="0.01" defaultValue={c.importe_pactado ?? ''} className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Fecha de fin
          <input name="fechaFin" type="date" defaultValue={c.fecha_fin ?? ''} className={comun} />
        </label>
        {resultado.estado === 'error' && <p className="text-xs text-bad">{resultado.mensaje}</p>}
        <BotonSecundario texto="Guardar" />
      </form>
      <form action={enviarBaja}>
        <input type="hidden" name="contratoId" value={c.id} />
        <input type="hidden" name="clienteId" value={clienteId} />
        <button type="submit" className="text-xs text-bad underline">Dar de baja ahora</button>
        {resultadoBaja.estado === 'error' && <p className="mt-1 text-xs text-bad">{resultadoBaja.mensaje}</p>}
      </form>
    </div>
  );
}

function FormularioNuevoContrato({
  clienteId,
  servicios,
  caballos,
  alumnos,
}: {
  clienteId: string;
  servicios: Servicio[];
  caballos: Ficha['caballos'];
  alumnos: Ficha['alumnos'];
}) {
  const [resultado, enviar] = useActionState(crearContrato, inicial);
  const [servicioId, setServicioId] = useState(servicios[0]?.id ?? '');
  const servicio = servicios.find((s) => s.id === servicioId);

  return (
    <form action={enviar} className="mt-2 space-y-3 rounded-lg border border-surface-border p-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <label className="block text-xs text-fg-muted">
        Servicio
        <select
          name="servicioId"
          value={servicioId}
          onChange={(e) => setServicioId(e.target.value)}
          className={comun}
        >
          {servicios.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      {servicio?.aplicaA === 'caballo' ? (
        <label className="block text-xs text-fg-muted">
          Caballo
          <select name="caballoId" required className={comun}>
            <option value="">Elegir…</option>
            {caballos.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-xs text-fg-muted">
          Alumno
          <select name="alumnoId" required className={comun}>
            <option value="">Elegir…</option>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>{a.persona?.apellido}, {a.persona?.nombre}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Fecha de inicio
          <input name="fechaInicio" type="date" required className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Importe pactado (opcional; pisa la tarifa)
          <input name="importePactado" type="number" min="0" step="0.01" className={comun} />
        </label>
      </div>

      {resultado.estado === 'error' && <p className="text-xs text-bad">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="text-xs text-ok">Contrato creado.</p>}
      <BotonEnviar texto="Crear contrato" />
    </form>
  );
}

function BotonEnviar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Guardando…' : texto}
    </button>
  );
}

function BotonSecundario({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-fg disabled:opacity-60"
    >
      {pending ? 'Guardando…' : texto}
    </button>
  );
}

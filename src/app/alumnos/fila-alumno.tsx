'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { desactivarAlumno, modificarAlumno } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { edadEn } from '@/lib/personas';

type Alumno = inferRouterOutputs<RouterApp>['alumno']['listar'][number];

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

const NIVELES = {
  inicial: 'Inicial',
  nivel_1: 'Nivel 1',
  nivel_2: 'Nivel 2',
  nivel_3: 'Nivel 3',
} as const;

export function FilaAlumno({ alumno: a }: { alumno: Alumno }) {
  const edad = a.persona?.fecha_nacimiento ? edadEn(a.persona.fecha_nacimiento) : null;
  const nombreCliente =
    a.cliente?.tipo === 'persona_juridica'
      ? a.cliente.razon_social
      : `${a.cliente?.persona?.apellido ?? ''}, ${a.cliente?.persona?.nombre ?? ''}`;

  return (
    <tr className={`border-b border-surface-border align-top ${a.activo ? '' : 'text-fg-muted'}`}>
      <td className="py-2 pr-3 font-medium">{a.persona?.apellido}, {a.persona?.nombre}</td>
      <td className="py-2 pr-3 text-right">{edad ?? '—'}</td>
      <td className="py-2 pr-3">{a.nivel ? NIVELES[a.nivel] : '—'}</td>
      <td className="py-2 pr-3">{a.responsable ? `${a.responsable.apellido}, ${a.responsable.nombre}` : 'No aplica · mayor'}</td>
      <td className="py-2 pr-3">
        {a.cliente && <Link href={`/clientes/${a.cliente.id}`} className="text-accent-ink hover:underline">{nombreCliente}</Link>}
      </td>
      <td className="py-2">
        {a.consentimiento_tutor_en ? (
          <span className="text-ok">Consent. {a.consentimiento_tutor_en.slice(0, 10)}</span>
        ) : edad !== null && edad < 18 ? (
          <span className="text-bad">Sin consentimiento</span>
        ) : (
          <span className="text-fg-muted">No requiere</span>
        )}
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-accent-ink">editar</summary>
          <FormularioEditar alumno={a} />
        </details>
      </td>
    </tr>
  );
}

function FormularioEditar({ alumno: a }: { alumno: Alumno }) {
  const [resultado, enviar] = useActionState(modificarAlumno, inicial);
  const [resultadoBaja, enviarBaja] = useActionState(desactivarAlumno, inicial);

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-surface-border p-3">
      <form action={enviar} className="space-y-2">
        <input type="hidden" name="alumnoId" value={a.id} />
        <input type="hidden" name="responsableId" value={a.responsable?.id ?? ''} />
        <label className="block text-xs text-fg-muted">
          Nivel
          <select name="nivel" defaultValue={a.nivel ?? ''} className={comun}>
            <option value="">Sin asignar</option>
            <option value="inicial">Inicial</option>
            <option value="nivel_1">Nivel 1</option>
            <option value="nivel_2">Nivel 2</option>
            <option value="nivel_3">Nivel 3</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Consentimiento del tutor otorgado el
          <input
            name="consentimientoTutorEn"
            type="date"
            defaultValue={a.consentimiento_tutor_en?.slice(0, 10) ?? ''}
            className={comun}
          />
        </label>
        {resultado.estado === 'error' && <p className="text-xs text-bad">{resultado.mensaje}</p>}
        <BotonEnviar texto="Guardar" />
      </form>
      {a.activo && (
        <form action={enviarBaja}>
          <input type="hidden" name="alumnoId" value={a.id} />
          <button type="submit" className="text-xs text-bad underline">Desactivar</button>
          {resultadoBaja.estado === 'error' && <p className="mt-1 text-xs text-bad">{resultadoBaja.mensaje}</p>}
        </form>
      )}
    </div>
  );
}

function BotonEnviar({ texto }: { texto: string }) {
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

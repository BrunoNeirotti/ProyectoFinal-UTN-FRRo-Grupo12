'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import type { RouterApp } from '@/server/routers/_app';
import { darDeBajaCaballo, modificarCaballo } from '../acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { edadEn } from '@/lib/personas';

type Salidas = inferRouterOutputs<RouterApp>;
type Ficha = Salidas['caballo']['ficha'];
type Opcion = { id: string; nombre: string | null };

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';
const ESTADOS = { activo: 'Activo', en_tratamiento: 'En tratamiento', retirado: 'Retirado' } as const;

export function FichaDeCaballo({
  ficha,
  propietarios,
  instalaciones,
}: {
  ficha: Ficha;
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const { caballo, contratos } = ficha;
  const nombrePropietario =
    caballo.propietario?.tipo === 'persona_juridica'
      ? caballo.propietario.razon_social
      : caballo.propietario?.persona
        ? `${caballo.propietario.persona.apellido}, ${caballo.propietario.persona.nombre}`
        : null;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-fg">{caballo.nombre}</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              {caballo.instalacion?.nombre ?? 'Sin instalación asignada'} · {ESTADOS[caballo.estado]}
            </p>
          </div>
          <details>
            <summary className="cursor-pointer rounded-lg border border-surface-border px-3 py-1.5 text-sm text-fg-muted">
              Editar
            </summary>
            <FormularioEditar caballo={caballo} propietarios={propietarios} instalaciones={instalaciones} />
          </details>
        </div>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-fg-muted">Raza</dt><dd>{caballo.raza ?? '—'}</dd></div>
          <div><dt className="text-xs text-fg-muted">Sexo</dt><dd>{caballo.sexo ?? '—'}</dd></div>
          <div>
            <dt className="text-xs text-fg-muted">Edad</dt>
            <dd className="tnum">{caballo.fecha_nacimiento ? `${edadEn(caballo.fecha_nacimiento)} años` : '—'}</dd>
          </div>
          <div><dt className="text-xs text-fg-muted">Pelaje</dt><dd>{caballo.pelaje ?? '—'}</dd></div>
          <div><dt className="text-xs text-fg-muted">Peso</dt><dd className="tnum">{caballo.peso_kg ? `${caballo.peso_kg} kg` : '—'}</dd></div>
          <div>
            <dt className="text-xs text-fg-muted">Propietario</dt>
            <dd>
              {caballo.propietario ? (
                <Link href={`/clientes/${caballo.propietario.id}`} className="text-accent-ink hover:underline">
                  {nombrePropietario}
                </Link>
              ) : (
                'Del haras'
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface p-5 shadow-sm">
        <h2 className="font-serif text-lg text-fg">Contratos</h2>
        <p className="mt-1 text-xs text-fg-muted">
          Se dan de alta desde la ficha del cliente propietario.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Contratos de este caballo con su servicio, importe y estado.</caption>
            <thead>
              <tr className="border-b border-surface-border text-left text-fg-muted">
                <th className="py-2 pr-3 font-medium">Servicio</th>
                <th className="py-2 pr-3 font-medium">Desde</th>
                <th className="py-2 pr-3 text-right font-medium">Importe</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-surface-border">
                  <td className="py-2 pr-3 font-medium">{c.servicio?.nombre}</td>
                  <td className="py-2 pr-3">{c.fecha_inicio}</td>
                  <td className="py-2 pr-3 text-right">{c.importe_pactado ? `$${Number(c.importe_pactado).toLocaleString('es-AR')}` : '—'}</td>
                  <td className="py-2">{c.estado}</td>
                </tr>
              ))}
              {contratos.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-fg-muted">Sin contratos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-surface-border bg-surface p-5 text-sm text-fg-muted shadow-sm">
        Sanidad, alimentación e historial de cuidados se suman acá cuando M9 esté construido: hoy la
        ficha muestra lo que M2 ya sostiene.
      </div>

      {caballo.estado !== 'retirado' && (
        <details>
          <summary className="cursor-pointer text-sm text-bad">Dar de baja</summary>
          <FormularioBaja caballoId={caballo.id} />
        </details>
      )}
    </div>
  );
}

function FormularioEditar({
  caballo,
  propietarios,
  instalaciones,
}: {
  caballo: Ficha['caballo'];
  propietarios: Opcion[];
  instalaciones: Opcion[];
}) {
  const [resultado, enviar] = useActionState(modificarCaballo, inicial);
  return (
    <form action={enviar} className="mt-3 max-w-xl space-y-3 rounded-lg border border-surface-border p-4">
      <input type="hidden" name="caballoId" value={caballo.id} />
      <label className="block text-xs text-fg-muted">
        Nombre
        <input name="nombre" defaultValue={caballo.nombre} required className={comun} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Propietario
          <select name="propietarioId" defaultValue={caballo.propietario?.id ?? ''} className={comun}>
            <option value="">Del haras</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Instalación
          <select name="instalacionId" defaultValue={caballo.instalacion?.id ?? ''} className={comun}>
            <option value="">Sin asignar</option>
            {instalaciones.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Raza
          <input name="raza" defaultValue={caballo.raza ?? ''} className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Sexo
          <select name="sexo" defaultValue={caballo.sexo ?? ''} className={comun}>
            <option value="">Sin especificar</option>
            <option value="macho">Macho</option>
            <option value="macho_castrado">Macho castrado</option>
            <option value="hembra">Hembra</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Pelaje
          <input name="pelaje" defaultValue={caballo.pelaje ?? ''} className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Peso (kg)
          <input name="pesoKg" type="number" min="0" step="0.1" defaultValue={caballo.peso_kg ?? ''} className={comun} />
        </label>
        <label className="block text-xs text-fg-muted">
          Estado
          <select name="estado" defaultValue={caballo.estado} className={comun}>
            <option value="activo">Activo</option>
            <option value="en_tratamiento">En tratamiento</option>
            <option value="retirado">Retirado</option>
          </select>
        </label>
      </div>
      {resultado.estado === 'error' && <p className="text-xs text-bad">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="text-xs text-ok">Guardado.</p>}
      <BotonEnviar texto="Guardar cambios" />
    </form>
  );
}

function FormularioBaja({ caballoId }: { caballoId: string }) {
  const [resultado, enviar] = useActionState(darDeBajaCaballo, inicial);
  return (
    <form action={enviar} className="mt-2">
      <input type="hidden" name="caballoId" value={caballoId} />
      <BotonEnviar texto="Confirmar baja" />
      {resultado.estado === 'error' && <p className="mt-1 text-xs text-bad">{resultado.mensaje}</p>}
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

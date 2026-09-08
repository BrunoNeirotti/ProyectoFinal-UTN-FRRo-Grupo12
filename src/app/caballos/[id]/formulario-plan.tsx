'use client';

import { useActionState } from 'react';
import { MOMENTOS, MOMENTO_TEXTO } from '@/lib/bienestar';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { crearPlan } from './acciones-plan';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export interface InsumoOpcion {
  id: string;
  nombre: string;
  unidad: string;
}

/** Alta del plan que rige desde una fecha. No edita el anterior: lo supersede. */
export function FormularioPlan({
  caballoId,
  insumos,
}: {
  caballoId: string;
  insumos: InsumoOpcion[];
}) {
  const [resultado, accion] = useActionState(crearPlan, inicial);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="mt-3 border-t border-[var(--surface-border)] pt-3">
      <input type="hidden" name="caballoId" value={caballoId} />

      <div className="grid gap-2 sm:grid-cols-5">
        <label className="label">
          Momento
          <select className="input" name="momento" defaultValue="manana" required>
            {MOMENTOS.map((m) => (
              <option key={m} value={m}>
                {MOMENTO_TEXTO[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="label sm:col-span-2">
          Qué se le da
          <input
            className="input"
            type="text"
            name="descripcion"
            required
            placeholder="Pastura + balanceado"
          />
        </label>
        <label className="label">
          Cantidad (kg)
          <input className="input tnum" type="text" inputMode="decimal" name="cantidadKg" />
        </label>
        <label className="label">
          Rige desde
          <input className="input" type="date" name="vigenteDesde" defaultValue={hoy} required />
        </label>
        <label className="label sm:col-span-3">
          Insumo que consume
          <select className="input" name="insumoId" defaultValue="">
            <option value="">Ninguno (no descuenta stock)</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="helper mt-1">
        Sin insumo, la ración se registra pero no descuenta existencias: es el caso de la pastura de
        piquete.
      </p>

      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="mt-2 text-sm text-ok">Plan guardado.</p>}

      <div className="mt-3">
        <BotonEnviar texto="Guardar el plan" cargando="Guardando…" tamano="sm" />
      </div>
    </form>
  );
}

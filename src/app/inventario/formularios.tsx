'use client';

import { useActionState, useState } from 'react';
import { CATEGORIAS_INSUMO, CATEGORIA_TEXTO, type InsumoConCobertura } from '@/lib/inventario';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';
import { ajustarInsumo, crearInsumo, crearOrden } from './acciones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

function Aviso({ resultado, exito }: { resultado: ResultadoDeGuardado; exito: string }) {
  if (resultado.estado === 'error') return <p className="error mt-2">{resultado.mensaje}</p>;
  if (resultado.estado === 'ok') return <p className="mt-2 text-sm text-ok">{exito}</p>;
  return null;
}

export interface ProveedorOpcion {
  id: string;
  razon_social: string;
}

/**
 * Nueva orden, con o sin la propuesta del sistema.
 *
 * Los dos caminos comparten formulario y se distinguen por el botón que se
 * apretó, en lugar de ser dos formularios con el mismo selector de proveedor
 * repetido. Elegir a quién se le compra es el paso común; que la orden nazca
 * vacía o con lo que hay que reponer es la variante.
 */
export function FormularioNuevaOrden({
  proveedores,
  hayQueReponer,
}: {
  proveedores: ProveedorOpcion[];
  hayQueReponer: boolean;
}) {
  const [resultado, accion] = useActionState(crearOrden, inicial);

  if (proveedores.length === 0) return null;

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <label className="label">
        Proveedor
        <select className="input" name="proveedorId" required>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.razon_social}
            </option>
          ))}
        </select>
      </label>
      <BotonEnviar texto="Orden vacía" variante="sec" name="sugerir" value="false" />
      {hayQueReponer && (
        <BotonEnviar texto="Orden con lo que falta" name="sugerir" value="true" cargando="Armando…" />
      )}
      {resultado.estado === 'error' && (
        <p className="error basis-full">{resultado.mensaje}</p>
      )}
    </form>
  );
}

/**
 * Conteo físico.
 *
 * Pide **lo contado**, no la diferencia, porque es lo que la persona tiene
 * delante cuando vuelve del depósito. La diferencia la calcula el sistema, que
 * es justamente la cuenta que hoy se hace mal en una planilla aparte.
 */
export function FormularioAjuste({ insumos }: { insumos: InsumoConCobertura[] }) {
  const [resultado, accion] = useActionState(ajustarInsumo, inicial);
  const [elegido, setElegido] = useState(insumos[0]?.id ?? '');

  const insumo = insumos.find((i) => i.id === elegido);

  if (insumos.length === 0) return null;

  return (
    <form action={accion} className="mt-4 space-y-3">
      <label className="label">
        Insumo
        <select
          className="input"
          name="insumoId"
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          required
        >
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="label">
        Contado {insumo ? `(${insumo.unidad})` : ''}
        <input
          className="input"
          type="number"
          name="contado"
          min="0"
          step="0.01"
          placeholder={insumo ? String(insumo.stockActual) : ''}
          required
        />
        {insumo && (
          <span className="helper">
            El sistema tiene registradas {insumo.stockActual} {insumo.unidad}.
          </span>
        )}
      </label>

      <label className="label">
        Motivo
        <input
          className="input"
          type="text"
          name="motivo"
          placeholder="Rotura en depósito"
          maxLength={200}
          required
        />
      </label>

      <BotonEnviar texto="Registrar conteo" variante="sec" cargando="Ajustando…" />

      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p className="mt-2 text-sm text-ok">
          {resultado.guardados === 0
            ? 'El conteo coincidió con lo registrado: no hizo falta ajustar nada.'
            : 'Ajuste registrado.'}
        </p>
      )}
    </form>
  );
}

/** Alta de insumo. El mínimo es lo que después enciende la alerta de reposición. */
export function FormularioNuevoInsumo() {
  const [resultado, accion] = useActionState(crearInsumo, inicial);

  return (
    <form action={accion} className="card p-5">
      <h2 className="font-serif text-lg">Nuevo insumo</h2>
      <p className="helper mt-1">
        La existencia no se carga acá: arranca en cero y se mueve con una recepción, un consumo o un
        conteo físico. Un número escrito a mano no dice de dónde salió.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="label sm:col-span-2">
          Nombre
          <input className="input" type="text" name="nombre" maxLength={80} required />
        </label>
        <label className="label">
          Categoría
          <select className="input" name="categoria" defaultValue="alimento" required>
            {CATEGORIAS_INSUMO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_TEXTO[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Unidad
          <input
            className="input"
            type="text"
            name="unidad"
            placeholder="kg, bolsa, dosis"
            maxLength={20}
            required
          />
        </label>
        <label className="label">
          Mínimo
          <input className="input" type="number" name="stockMinimo" min="0" step="0.01" defaultValue="0" required />
        </label>
      </div>

      <div className="mt-4">
        <BotonEnviar texto="Crear insumo" />
      </div>
      <Aviso resultado={resultado} exito="Insumo creado." />
    </form>
  );
}

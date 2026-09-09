'use client';

import { useActionState } from 'react';
import { CATEGORIAS_INSUMO, CATEGORIA_TEXTO, type CategoriaInsumo } from '@/lib/inventario';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../botones';
import { editarInsumo } from '../acciones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export interface InsumoEditable {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidad: string;
  stockMinimo: number;
}

/**
 * Edición del insumo.
 *
 * La existencia no está entre los campos y no es un olvido: se mueve con un
 * ajuste, que pide un motivo y deja rastro. Un campo «stock» editable acá sería
 * la puerta por la que se corrige un faltante sin que quede escrito por qué.
 */
export function FormularioEditarInsumo({ insumo }: { insumo: InsumoEditable }) {
  const [resultado, accion] = useActionState(editarInsumo, inicial);

  return (
    <form action={accion} className="card p-5">
      <h2 className="font-serif text-lg">Datos del insumo</h2>
      <input type="hidden" name="insumoId" value={insumo.id} />

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="label sm:col-span-2">
          Nombre
          <input
            className="input"
            type="text"
            name="nombre"
            defaultValue={insumo.nombre}
            maxLength={80}
            required
          />
        </label>
        <label className="label">
          Categoría
          <select className="input" name="categoria" defaultValue={insumo.categoria} required>
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
            defaultValue={insumo.unidad}
            maxLength={20}
            required
          />
        </label>
        <label className="label">
          Mínimo
          <input
            className="input"
            type="number"
            name="stockMinimo"
            min="0"
            step="0.01"
            defaultValue={insumo.stockMinimo}
            required
          />
          <span className="helper">Es lo que enciende la alerta de reposición.</span>
        </label>
      </div>

      <div className="mt-4">
        <BotonEnviar texto="Guardar" variante="sec" />
      </div>

      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && <p className="mt-2 text-sm text-ok">Guardado.</p>}
    </form>
  );
}

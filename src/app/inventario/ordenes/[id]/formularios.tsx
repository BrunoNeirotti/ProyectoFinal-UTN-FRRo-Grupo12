'use client';

import { useActionState } from 'react';
import { unidadPlural } from '@/lib/inventario';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../../../botones';
import {
  anularOrden,
  eliminarBorrador,
  enviarOrden,
  guardarRenglon,
  quitarRenglon,
  recibirEntrega,
} from '../../acciones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export interface InsumoOpcion {
  id: string;
  nombre: string;
  unidad: string;
}

/** Agrega un renglón al borrador. Sólo aparece mientras la orden se puede editar. */
export function FormularioRenglon({
  ordenId,
  insumos,
}: {
  ordenId: string;
  insumos: InsumoOpcion[];
}) {
  const [resultado, accion] = useActionState(guardarRenglon, inicial);

  if (insumos.length === 0) {
    return (
      <p className="helper">
        Todos los insumos activos ya están en la orden. Para pedir más de uno, se corrige su
        cantidad.
      </p>
    );
  }

  return (
    <form action={accion} className="card p-5">
      <h2 className="font-serif text-lg">Agregar un renglón</h2>
      <input type="hidden" name="ordenId" value={ordenId} />

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="label">
          Insumo
          <select className="input" name="insumoId" required>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} ({i.unidad})
              </option>
            ))}
          </select>
        </label>
        <label className="label">
          Cantidad
          <input className="input" type="number" name="cantidad" min="0.01" step="0.01" required />
        </label>
        <label className="label">
          Precio unitario
          <input
            className="input"
            type="number"
            name="precioUnitario"
            min="0"
            step="0.01"
            defaultValue="0"
            required
          />
          <span className="helper">
            Queda congelado al momento de la compra: no se lee de ninguna lista vigente.
          </span>
        </label>
      </div>

      <div className="mt-4">
        <BotonEnviar texto="Agregar" variante="sec" />
      </div>
      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
    </form>
  );
}

/**
 * Los botones de una sola acción: enviar, quitar un renglón, anular, borrar.
 *
 * Van todos por el mismo componente porque son la misma cosa -un formulario de
 * un solo campo oculto- y tenerlos separados multiplicaría cuatro veces el mismo
 * manejo de error.
 */
export function AccionesDeOrden({
  ordenId,
  detalleId,
  accion,
  habilitado = true,
}: {
  ordenId: string;
  detalleId?: string;
  accion: 'enviar' | 'quitarRenglon' | 'anular' | 'eliminarBorrador';
  habilitado?: boolean;
}) {
  const funcion = {
    enviar: enviarOrden,
    quitarRenglon,
    anular: anularOrden,
    eliminarBorrador,
  }[accion];

  const [resultado, ejecutar] = useActionState(funcion, inicial);

  const rotulo = {
    enviar: 'Enviar al proveedor',
    quitarRenglon: 'Quitar',
    anular: 'Anular la orden',
    eliminarBorrador: 'Borrar el borrador',
  }[accion];

  const variante = accion === 'enviar' ? 'pri' : 'sec';

  return (
    <form action={ejecutar} className="inline-block">
      <input type="hidden" name="ordenId" value={ordenId} />
      {detalleId && <input type="hidden" name="detalleId" value={detalleId} />}
      {habilitado ? (
        <BotonEnviar texto={rotulo} variante={variante} tamano={detalleId ? 'sm' : undefined} />
      ) : (
        <span className="btn btn-sec" aria-disabled="true">
          {rotulo}
        </span>
      )}
      {resultado.estado === 'error' && <p className="error mt-1">{resultado.mensaje}</p>}
    </form>
  );
}

export interface RenglonRecibible {
  id: string;
  nombre: string;
  unidad: string;
  falta: number;
}

/**
 * Registra una entrega contra el remito.
 *
 * Cada casillero pide lo que llegó **ahora**, y el que no vino se deja vacío.
 * Precargar lo que falta ahorraría tipeo y convertiría la recepción en un
 * «aceptar todo» que nadie mira: la mitad del valor de esta pantalla es que
 * alguien compare el remito con lo pedido.
 */
export function FormularioRecepcion({
  ordenId,
  renglones,
}: {
  ordenId: string;
  renglones: RenglonRecibible[];
}) {
  const [resultado, accion] = useActionState(recibirEntrega, inicial);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="card mt-2 p-5">
      <input type="hidden" name="ordenId" value={ordenId} />

      <label className="label max-w-xs">
        Fecha del remito
        <input className="input" type="date" name="fecha" defaultValue={hoy} max={hoy} required />
        <span className="helper">
          El día en que entró la mercadería, que no siempre es el día en que se carga.
        </span>
      </label>

      <div className="mt-4 space-y-2">
        {renglones.map((r) => (
          // `.label` es `display:block`, así que la fila necesita su propio
          // `flex`: con sólo `flex-row` el rótulo queda arriba y el casillero
          // ocupa el ancho entero, y seis renglones se vuelven una página.
          <label key={r.id} className="label flex items-center gap-3">
            <span className="flex-1 text-sm">
              {r.nombre}
              <span className="ml-1 text-xs text-muted">
                {r.falta > 0
                  ? `· faltan ${r.falta} ${unidadPlural(r.falta, r.unidad)}`
                  : '· completo'}
              </span>
            </span>
            {/* El ancho va en el envoltorio: `.input` declara `width: 100%` y
                le gana a la utilidad, así que fijarlo en el propio campo no
                tiene efecto. */}
            <span className="w-28 shrink-0">
              <input
                className="input"
                type="number"
                name={`recibido-${r.id}`}
                min="0"
                step="0.01"
                placeholder="0"
                aria-label={`Cantidad recibida de ${r.nombre}`}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <BotonEnviar texto="Registrar la entrega" cargando="Registrando…" />
      </div>

      {resultado.estado === 'error' && <p className="error mt-2">{resultado.mensaje}</p>}
      {resultado.estado === 'ok' && (
        <p className="mt-2 text-sm text-ok">
          Entrega registrada: {resultado.guardados}{' '}
          {resultado.guardados === 1 ? 'renglón' : 'renglones'}. La existencia ya quedó actualizada.
        </p>
      )}
    </form>
  );
}

/**
 * M10 · Inventario y compras.
 *
 * Todo lo que la pantalla de Inventario muestra y que no es una fila de la base:
 * cuánto se consume por día, para cuántos días alcanza lo que hay, y cuánto
 * habría que comprar. Ninguno toca Supabase, y por eso los tres se prueban acá
 * en lugar de descubrirse en producción.
 *
 * La propiedad que ordena el módulo es que **la existencia es un saldo, no un
 * campo**. `insumo.stock_actual` lo mantiene un disparador sobre
 * `movimiento_stock`, igual que el saldo de la cuenta corriente en M3: nadie lo
 * escribe, ni siquiera este módulo. Comprar, recibir, consumir y ajustar son
 * todos lo mismo visto de afuera —un asiento en el libro de existencias— y esa
 * uniformidad es la que permite que el consumo de M9 y una recepción de M10
 * convivan sin que ninguno de los dos sepa del otro.
 *
 * La segunda es del negocio y decide la pantalla entera: **el dato que dispara
 * una compra es la cobertura, no el faltante**. «Quedan 40 bolsas» no dice nada
 * si no se sabe cuánto se gasta; «alcanza cuatro días» sí. De ahí que el mínimo
 * quede como una marca de referencia sobre la barra y no como el semáforo: un
 * insumo puede estar bajo mínimo y tener veinte días por delante, que es
 * exactamente el caso del antiparasitario en el prototipo.
 */

import { fechaCorrida } from './bienestar';

export const CATEGORIAS_INSUMO = ['alimento', 'cama', 'sanidad', 'mantenimiento'] as const;

export type CategoriaInsumo = (typeof CATEGORIAS_INSUMO)[number];

export const CATEGORIA_TEXTO: Record<CategoriaInsumo, string> = {
  alimento: 'Alimento',
  cama: 'Cama',
  sanidad: 'Sanidad',
  mantenimiento: 'Mantenimiento',
};

export const TIPOS_MOVIMIENTO = ['ingreso', 'egreso', 'ajuste'] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const TIPO_MOVIMIENTO_TEXTO: Record<TipoMovimiento, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  ajuste: 'Ajuste',
};

export const ESTADOS_ORDEN = [
  'borrador',
  'enviada',
  'parcialmente_recibida',
  'recibida',
  'anulada',
] as const;

export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export const ESTADO_ORDEN_TEXTO: Record<EstadoOrden, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  parcialmente_recibida: 'Parcialmente recibida',
  recibida: 'Recibida',
  anulada: 'Anulada',
};

/** Tono del distintivo. `neutro` es el `badge` sin modificador. */
export type Tono = 'ok' | 'warn' | 'bad' | 'neutro';

export const TONO_DE_ESTADO: Record<EstadoOrden, Tono> = {
  borrador: 'neutro',
  enviada: 'warn',
  parcialmente_recibida: 'warn',
  recibida: 'ok',
  anulada: 'neutro',
};

/**
 * Cómo se nombra una orden fuera del sistema: «OC 2026-018».
 *
 * El número se rellena a tres dígitos porque así se lee una serie —018 y 019 se
 * ordenan a ojo, 18 y 9 no—, y el año va completo porque la serie reinicia cada
 * enero y sin el año dos órdenes distintas se llaman igual.
 */
export function numeroDeOrden(anio: number, numero: number): string {
  return `OC ${anio}-${String(numero).padStart(3, '0')}`;
}

/** Un asiento del libro de existencias, con lo mínimo para hacer cuentas. */
export interface MovimientoComputable {
  tipo: TipoMovimiento;
  cantidad: number;
  ocurridoEn: string;
}

/** Cuánto suma o resta un movimiento al saldo. Mismo criterio que el disparador. */
export function saldoDelMovimiento(m: Pick<MovimientoComputable, 'tipo' | 'cantidad'>): number {
  if (m.tipo === 'egreso') return -m.cantidad;
  return m.cantidad; // `ingreso` suma; `ajuste` ya trae su signo
}

/** Cuántos días cubre una ventana de fechas, con los dos extremos incluidos. */
export function diasDeVentana(desde: string, hasta: string): number {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fin) || fin < inicio) return 0;
  return Math.round((fin - inicio) / 86_400_000) + 1;
}

export const DIAS_DE_CONSUMO = 90;

/** La ventana de referencia del consumo: los noventa días que cierran en `hasta`. */
export function ventanaDeConsumo(hasta: string, dias: number = DIAS_DE_CONSUMO) {
  return { desde: fechaCorrida(hasta, -(dias - 1)), hasta };
}

/**
 * Consumo promedio por día en la ventana.
 *
 * Sólo cuenta los egresos. Un ajuste no es consumo aunque reste: es la
 * corrección de lo que no se registró, y sumarlo al promedio haría que un
 * conteo físico se pareciera a un aumento del uso. Un ingreso, obviamente,
 * tampoco.
 *
 * Se divide por los días de la ventana y no por los días con movimiento: los
 * días en que no se sirvió nada son parte del promedio, no huecos.
 */
export function consumoDiario(
  movimientos: readonly MovimientoComputable[],
  desde: string,
  hasta: string,
): number {
  const dias = diasDeVentana(desde, hasta);
  if (dias === 0) return 0;

  const total = movimientos
    .filter((m) => m.tipo === 'egreso')
    .filter((m) => {
      const dia = m.ocurridoEn.slice(0, 10);
      return dia >= desde && dia <= hasta;
    })
    .reduce((suma, m) => suma + m.cantidad, 0);

  return total / dias;
}

/**
 * Para cuántos días alcanza lo que hay.
 *
 * `null` cuando no hay consumo con qué dividir, y eso es distinto de «alcanza
 * para siempre»: un insumo que nunca se movió no tiene cobertura estimable, y
 * mostrarlo en verde sería afirmar algo que no se sabe.
 */
export function coberturaEnDias(stock: number, porDia: number): number | null {
  if (porDia <= 0) return null;
  if (stock <= 0) return 0;
  return Math.floor(stock / porDia);
}

export const COBERTURA_CRITICA = 7;
export const COBERTURA_ATENCION = 21;

/**
 * El semáforo de la fila.
 *
 * Una semana es el corte de abajo porque es lo que tarda un proveedor de forraje
 * en entregar: por debajo de eso, pedir hoy ya llega tarde. Tres semanas es el
 * de arriba, que deja margen para juntar el pedido con la compra del mes en
 * lugar de salir a comprar de urgencia.
 */
export function tonoDeCobertura(dias: number | null): Tono {
  if (dias === null) return 'neutro';
  if (dias < COBERTURA_CRITICA) return 'bad';
  if (dias < COBERTURA_ATENCION) return 'warn';
  return 'ok';
}

/**
 * La barra de nivel: cuánto se llena y dónde queda la marca del mínimo.
 *
 * La escala es tres veces el mínimo, así que la marca cae en el tercio y la
 * barra se lee sin números: por debajo de la marca hay que comprar. Cuando el
 * stock se pasa de esa escala, la escala se estira hasta el stock —la barra
 * nunca desborda— y la marca se corre a la izquierda, que es justo lo que se
 * quiere ver en un insumo de sobra.
 *
 * Sin mínimo cargado no hay marca: devolver 0 la pegaría al borde izquierdo y
 * parecería un mínimo de cero, que es una afirmación y no una ausencia.
 */
export function nivelDeBarra(
  stock: number,
  minimo: number,
): { llenado: number; marca: number | null } {
  const piso = Math.max(stock, 0);
  const escala = Math.max(minimo * 3, piso);
  if (escala <= 0) return { llenado: 0, marca: null };
  return {
    llenado: Math.min(100, (piso / escala) * 100),
    marca: minimo > 0 ? (minimo / escala) * 100 : null,
  };
}

export interface InsumoComputable {
  id: string;
  nombre: string;
  categoria: CategoriaInsumo;
  unidad: string;
  stockActual: number;
  stockMinimo: number;
}

export interface InsumoConCobertura extends InsumoComputable {
  consumoDiario: number;
  /** Lo que se gastó en la ventana, que es lo que la columna «Consumo» muestra. */
  consumoDeLaVentana: number;
  coberturaDias: number | null;
  tono: Tono;
  bajoMinimo: boolean;
  llenado: number;
  marca: number | null;
}

/** Arma la fila de la tabla de insumos: existencia, consumo y cobertura juntos. */
export function insumoConCobertura(
  insumo: InsumoComputable,
  movimientos: readonly MovimientoComputable[],
  desde: string,
  hasta: string,
): InsumoConCobertura {
  const porDia = consumoDiario(movimientos, desde, hasta);
  const cobertura = coberturaEnDias(insumo.stockActual, porDia);
  const { llenado, marca } = nivelDeBarra(insumo.stockActual, insumo.stockMinimo);

  return {
    ...insumo,
    consumoDiario: porDia,
    consumoDeLaVentana: porDia * diasDeVentana(desde, hasta),
    coberturaDias: cobertura,
    tono: tonoDeCobertura(cobertura),
    bajoMinimo: insumo.stockActual < insumo.stockMinimo,
    llenado,
    marca,
  };
}

/**
 * Cuánto conviene reponer de un insumo.
 *
 * Se pide lo que falte para llegar a lo que sea más exigente de dos cosas: el
 * mínimo declarado, o lo que se va a consumir en los días de cobertura
 * configurados. Las dos hacen falta. Sólo el mínimo compraría de menos en un
 * insumo que se gasta rápido; sólo el consumo dejaría sin reponer al que casi no
 * se usa pero tiene que estar —el antiparasitario, que se gasta una vez por
 * estación y no puede faltar el día del ciclo—.
 *
 * Redondea para arriba porque no se compran 3,4 bolsas.
 */
export function sugerirReposicion(
  insumo: Pick<InsumoConCobertura, 'stockActual' | 'stockMinimo' | 'consumoDiario'>,
  diasDeCobertura: number,
): number {
  const objetivo = Math.max(insumo.stockMinimo, insumo.consumoDiario * diasDeCobertura);
  return Math.max(0, Math.ceil(objetivo - insumo.stockActual));
}

/**
 * Qué insumos entran en la orden que la pantalla propone.
 *
 * Entra el que está bajo mínimo o el que no llega al corte de atención, que no
 * son el mismo conjunto: hay insumos con existencia por encima del mínimo y
 * cuatro días de consumo por delante, y son justamente los que hoy se descubren
 * tarde. Queda afuera el que ya no necesita nada, para que la orden sugerida no
 * traiga renglones en cero.
 */
export function insumosAReponer(
  insumos: readonly InsumoConCobertura[],
  diasDeCobertura: number,
): { insumo: InsumoConCobertura; cantidad: number }[] {
  return insumos
    .filter((i) => i.bajoMinimo || i.tono === 'bad' || i.tono === 'warn')
    .map((i) => ({ insumo: i, cantidad: sugerirReposicion(i, diasDeCobertura) }))
    .filter((r) => r.cantidad > 0);
}

/** Lo que queda por recibir de un renglón. Nunca negativo: de más no falta. */
export function pendienteDeRecibir(renglon: {
  cantidad: number;
  cantidadRecibida: number | null;
}): number {
  return Math.max(0, renglon.cantidad - (renglon.cantidadRecibida ?? 0));
}

/**
 * El estado que le corresponde a una orden por lo que llegó de ella.
 *
 * Es la misma cuenta que hace el disparador `trg_estado_orden`, escrita acá para
 * que la pantalla pueda anticiparlo sin ir a la base. Si alguna vez discrepan,
 * manda la base: esto es lo que se muestra, aquello es lo que vale.
 */
export function estadoPorRecepcion(
  renglones: readonly { cantidad: number; cantidadRecibida: number | null }[],
): Extract<EstadoOrden, 'enviada' | 'parcialmente_recibida' | 'recibida'> {
  if (renglones.length === 0) return 'enviada';
  const completos = renglones.filter((r) => (r.cantidadRecibida ?? 0) >= r.cantidad).length;
  if (completos === renglones.length) return 'recibida';
  return renglones.some((r) => (r.cantidadRecibida ?? 0) > 0) ? 'parcialmente_recibida' : 'enviada';
}

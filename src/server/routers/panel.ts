import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { crearRouter, procedimientoDeArea } from '../trpc';
import { mensajeDeError } from '../errores';
import { antelacionDeAvisoSanitario, diasDeCoberturaDeCompra } from '../parametros-servidor';
import { comienzoDelDia, primerDiaDelMes, resumenDeCartera } from '@/lib/cobranza';
import { tarifaVigenteEn } from '@/lib/tarifas';
import { alertasSanitarias } from '@/lib/bienestar';
import { consumoDiario, ventanaDeConsumo, type MovimientoComputable } from '@/lib/inventario';
import {
  costoSanitarioMensualPromedio,
  egresoPendienteDeOrdenes,
  egresoProyectadoDeInsumos,
  ocupacionDe,
  proyectarIngresos,
  resultadoProyectado,
  variacionPorcentual,
  type ContratoResuelto,
  type InsumoParaProyeccion,
} from '@/lib/gerencia';
import { nombreDeCliente } from './cuentaCorriente';

/**
 * M11 · Tablero de gerencia.
 *
 * Sin entidades propias (`03-modelo-de-datos.md`): todo lo que sigue es
 * consulta sobre lo que ya escriben M2, M3, M6, M9 y M10. `resumen` alimenta el
 * Inicio del administrador; `reporteIngresosEgresos`, la pantalla de Reportes;
 * `presupuesto`, el CUS07.
 */

const procedimiento = procedimientoDeArea('gerencia');

const MESES_DE_HISTORIA = 6;
const MESES_DE_COSTO_SANITARIO = 6;

function inicioDeMesHaceN(n: number, referencia: Date = new Date()): Date {
  const base = primerDiaDelMes(referencia);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - n, 1));
}

function iso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export const routerPanel = crearRouter({
  /** KPIs y alertas del Inicio del administrador. */
  resumen: procedimiento.query(async ({ ctx }) => {
    const hoy = comienzoDelDia(new Date());
    const inicioDeMes = primerDiaDelMes(new Date());
    const inicioMesAnterior = inicioDeMesHaceN(1);

    const [
      { data: cargosDelMes },
      { data: cargosMesAnterior },
      { data: cuentas },
      { data: movimientos },
      { data: boxes },
      { data: caballosAlojados },
      { count: alumnosActivos },
      { data: insumos },
      { data: eventosSanitarios },
      diasAvisoSanitario,
    ] = await Promise.all([
      ctx.supabase.from('movimiento_cuenta').select('importe').eq('tipo', 'cargo').eq('periodo', iso(inicioDeMes)),
      ctx.supabase.from('movimiento_cuenta').select('importe').eq('tipo', 'cargo').eq('periodo', iso(inicioMesAnterior)),
      ctx.supabase.from('cuenta_corriente').select('id, saldo'),
      ctx.supabase.from('movimiento_cuenta').select('cuenta_corriente_id, tipo, importe, vence_en, creado_en'),
      ctx.supabase.from('instalacion').select('id').eq('tipo', 'box').eq('activo', true),
      ctx.supabase.from('caballo').select('instalacion_id').eq('estado', 'activo').not('instalacion_id', 'is', null),
      ctx.supabase.from('alumno').select('id', { count: 'exact', head: true }).eq('activo', true),
      ctx.supabase.from('insumo').select('id, stock_actual, stock_minimo').eq('activo', true),
      ctx.supabase
        .from('evento_sanitario')
        .select('caballo_id, tipo, estado, proxima_fecha, caballo:caballo_id (id, nombre, estado)')
        .not('proxima_fecha', 'is', null),
      antelacionDeAvisoSanitario(ctx.supabase),
    ]);

    const facturacionDelMes = (cargosDelMes ?? []).reduce((s, m) => s + Number(m.importe), 0);
    const facturacionMesAnterior = (cargosMesAnterior ?? []).reduce((s, m) => s + Number(m.importe), 0);

    const cartera = resumenDeCartera(
      (cuentas ?? []).map((c) => ({ cuentaId: c.id, saldo: Number(c.saldo) })),
      (movimientos ?? []).map((m) => ({
        cuentaCorrienteId: m.cuenta_corriente_id,
        tipo: m.tipo,
        importe: Number(m.importe),
        venceEn: m.vence_en,
        ocurridoEn: m.creado_en,
      })),
      hoy,
    );

    const boxesOcupados = new Set(
      (caballosAlojados ?? [])
        .map((c) => c.instalacion_id)
        .filter((id): id is string => id != null && (boxes ?? []).some((b) => b.id === id)),
    );

    const filasSanitarias = (eventosSanitarios ?? []).filter((f) => f.caballo?.estado !== 'retirado');
    const alertasSanidad = alertasSanitarias(
      filasSanitarias.map((f) => ({
        caballoId: f.caballo_id,
        tipo: f.tipo,
        estado: f.estado,
        proximaFecha: f.proxima_fecha,
      })),
      iso(new Date()),
      diasAvisoSanitario,
    );

    return {
      facturacionDelMes,
      variacionFacturacion: variacionPorcentual(facturacionDelMes, facturacionMesAnterior),
      cobranzaPendiente: cartera.saldoTotal,
      cuentasConSaldo: cartera.cuentasConSaldo,
      ocupacionBoxes: ocupacionDe(boxesOcupados, (boxes ?? []).length),
      alumnosActivos: alumnosActivos ?? 0,
      alertas: {
        stockBajo: (insumos ?? []).filter((i) => i.stock_actual < i.stock_minimo).length,
        morosidad: cartera.cuentasVencidas,
        deudaVencida: cartera.vencido,
        sanidad: alertasSanidad.length,
      },
    };
  }),

  /** Facturación de los últimos meses, para el gráfico de evolución. */
  evolucionFacturacion: procedimiento.query(async ({ ctx }) => {
    const desde = inicioDeMesHaceN(MESES_DE_HISTORIA - 1);
    const { data, error } = await ctx.supabase
      .from('movimiento_cuenta')
      .select('importe, periodo')
      .eq('tipo', 'cargo')
      .gte('periodo', iso(desde));

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

    const porPeriodo = new Map<string, number>();
    for (let n = MESES_DE_HISTORIA - 1; n >= 0; n--) porPeriodo.set(iso(inicioDeMesHaceN(n)), 0);
    for (const m of data ?? []) {
      if (m.periodo == null || !porPeriodo.has(m.periodo)) continue;
      porPeriodo.set(m.periodo, (porPeriodo.get(m.periodo) ?? 0) + Number(m.importe));
    }

    return [...porPeriodo.entries()].map(([periodo, total]) => ({ periodo, total }));
  }),

  /** Las cuentas con mayor saldo, para la tabla del Inicio. */
  cuentasConMayorSaldo: procedimiento
    .input(z.object({ limite: z.int().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('cuenta_corriente')
        .select('id, saldo, cliente:cliente_id (id, tipo, razon_social, activo, persona:persona_id (nombre, apellido))')
        .gt('saldo', 0)
        .order('saldo', { ascending: false })
        .limit(input?.limite ?? 5);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      return (data ?? [])
        .filter((c) => c.cliente)
        .map((c) => ({
          cuentaId: c.id,
          clienteId: c.cliente!.id,
          nombre: nombreDeCliente(c.cliente!),
          saldo: Number(c.saldo),
        }));
    }),

  /** Ingresos, egresos y resultado mensual, para la pantalla de Reportes. */
  reporteIngresosEgresos: procedimiento.query(async ({ ctx }) => {
    const desde = inicioDeMesHaceN(MESES_DE_HISTORIA - 1);

    const [{ data: cargos }, { data: ordenesRecibidas }, { data: eventos }] = await Promise.all([
      ctx.supabase.from('movimiento_cuenta').select('importe, periodo').eq('tipo', 'cargo').gte('periodo', iso(desde)),
      ctx.supabase
        .from('orden_compra')
        .select('total, fecha_emision')
        .in('estado', ['recibida', 'parcialmente_recibida'])
        .gte('fecha_emision', iso(desde)),
      ctx.supabase
        .from('evento_sanitario')
        .select('costo, fecha')
        .eq('estado', 'aplicado')
        .not('costo', 'is', null)
        .gte('fecha', iso(desde)),
    ]);

    const meses: string[] = [];
    for (let n = MESES_DE_HISTORIA - 1; n >= 0; n--) meses.push(iso(inicioDeMesHaceN(n)));

    const mesDe = (fechaIso: string) => iso(primerDiaDelMes(new Date(`${fechaIso}T12:00:00Z`)));

    const ingresosPorMes = new Map(meses.map((m) => [m, 0]));
    for (const c of cargos ?? []) {
      if (c.periodo != null && ingresosPorMes.has(c.periodo)) {
        ingresosPorMes.set(c.periodo, (ingresosPorMes.get(c.periodo) ?? 0) + Number(c.importe));
      }
    }

    const egresosPorMes = new Map(meses.map((m) => [m, 0]));
    for (const o of ordenesRecibidas ?? []) {
      const m = mesDe(o.fecha_emision);
      if (egresosPorMes.has(m)) egresosPorMes.set(m, (egresosPorMes.get(m) ?? 0) + Number(o.total));
    }
    for (const e of eventos ?? []) {
      const m = mesDe(e.fecha);
      if (egresosPorMes.has(m)) egresosPorMes.set(m, (egresosPorMes.get(m) ?? 0) + Number(e.costo));
    }

    return meses.map((periodo) => {
      const ingresos = ingresosPorMes.get(periodo) ?? 0;
      const egresos = egresosPorMes.get(periodo) ?? 0;
      return { periodo, ingresos, egresos, resultado: ingresos - egresos };
    });
  }),

  /**
   * CUS07 · Elaborar el presupuesto mensual.
   *
   * Se proyecta el período siguiente al actual. No persiste nada (postcondición
   * de sistema del caso de uso): la pantalla vuelve a llamar esto cada vez que
   * el Administrador quiere ver el presupuesto, y la simulación de precios
   * (pasos 6-7) corre del lado del cliente con `simularVariacion`, sobre los
   * mismos `contratos` que esta consulta devuelve.
   */
  presupuesto: procedimiento.query(async ({ ctx }) => {
    const inicioDeMes = primerDiaDelMes(new Date());
    const periodoSiguiente = new Date(Date.UTC(inicioDeMes.getUTCFullYear(), inicioDeMes.getUTCMonth() + 1, 1));
    const isoPeriodoSiguiente = iso(periodoSiguiente);
    const finDePeriodoSiguiente = new Date(Date.UTC(periodoSiguiente.getUTCFullYear(), periodoSiguiente.getUTCMonth() + 1, 0));

    const [
      { data: ultimoEstadoCuenta },
      { data: contratos, error: errorContratos },
      { data: cuentas },
      { data: movimientos },
      { data: ordenesAbiertas },
      { data: insumos },
      { data: comprasPorInsumo },
      { data: costosSanitarios },
      diasDeCobertura,
    ] = await Promise.all([
      ctx.supabase.from('estado_cuenta').select('periodo').order('periodo', { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase
        .from('contrato')
        .select(
          'id, importe_pactado, servicio:servicio_id (id, nombre, unidad, tarifa(importe, vigente_desde))',
        )
        .eq('estado', 'vigente')
        .lte('fecha_inicio', iso(finDePeriodoSiguiente))
        .or(`fecha_fin.is.null,fecha_fin.gte.${isoPeriodoSiguiente}`),
      ctx.supabase.from('cuenta_corriente').select('id, saldo'),
      ctx.supabase.from('movimiento_cuenta').select('cuenta_corriente_id, tipo, importe, vence_en, creado_en'),
      ctx.supabase
        .from('orden_compra')
        .select('detalle_orden_compra(cantidad, cantidad_recibida, precio_unitario)')
        .in('estado', ['enviada', 'parcialmente_recibida']),
      ctx.supabase.from('insumo').select('id, activo').eq('activo', true),
      ctx.supabase
        .from('detalle_orden_compra')
        .select('insumo_id, precio_unitario, orden_compra:orden_compra_id (fecha_emision)')
        .order('orden_compra_id', { ascending: false }),
      ctx.supabase
        .from('evento_sanitario')
        .select('costo, fecha')
        .eq('estado', 'aplicado')
        .not('costo', 'is', null)
        .gte('fecha', iso(inicioDeMesHaceN(MESES_DE_COSTO_SANITARIO - 1))),
      diasDeCoberturaDeCompra(ctx.supabase),
    ]);

    if (errorContratos) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorContratos) });

    // --- Paso 2: ingresos recurrentes previstos (sólo servicios de unidad mensual) ---
    const mensuales = (contratos ?? []).filter((c) => c.servicio?.unidad === 'mensual');
    const contratosResueltos: ContratoResuelto[] = mensuales.map((c) => {
      const tarifa = tarifaVigenteEn(
        (c.servicio!.tarifa ?? []).map((t) => ({ importe: Number(t.importe), vigenteDesde: t.vigente_desde })),
        periodoSiguiente,
      );
      const importe = c.importe_pactado != null ? Number(c.importe_pactado) : (tarifa?.importe ?? null);
      return {
        contratoId: c.id,
        servicioId: c.servicio!.id,
        servicioNombre: c.servicio!.nombre,
        importe,
        esPactado: c.importe_pactado != null,
      };
    });
    const ingresos = proyectarIngresos(contratosResueltos);

    // --- Paso 3: deuda exigible, vencida y por vencer ---
    const hoy = comienzoDelDia(new Date());
    const cartera = resumenDeCartera(
      (cuentas ?? []).map((c) => ({ cuentaId: c.id, saldo: Number(c.saldo) })),
      (movimientos ?? []).map((m) => ({
        cuentaCorrienteId: m.cuenta_corriente_id,
        tipo: m.tipo,
        importe: Number(m.importe),
        venceEn: m.vence_en,
        ocurridoEn: m.creado_en,
      })),
      hoy,
    );

    // --- Paso 4: egresos previstos ---
    const detallesAbiertos = (ordenesAbiertas ?? []).flatMap((o) => o.detalle_orden_compra ?? []);
    const egresoOrdenes = egresoPendienteDeOrdenes(
      detallesAbiertos.map((d) => ({
        cantidad: Number(d.cantidad),
        cantidadRecibida: d.cantidad_recibida == null ? null : Number(d.cantidad_recibida),
        precioUnitario: Number(d.precio_unitario),
      })),
    );

    const ventana = ventanaDeConsumo(iso(new Date()));
    const { data: movimientosStock } = await ctx.supabase
      .from('movimiento_stock')
      .select('insumo_id, tipo, cantidad, ocurrido_en')
      .gte('ocurrido_en', `${ventana.desde}T00:00:00-03:00`);

    const movimientosPorInsumo = new Map<string, MovimientoComputable[]>();
    for (const m of movimientosStock ?? []) {
      const lista = movimientosPorInsumo.get(m.insumo_id) ?? [];
      lista.push({ tipo: m.tipo, cantidad: m.cantidad, ocurridoEn: m.ocurrido_en });
      movimientosPorInsumo.set(m.insumo_id, lista);
    }

    const precioPorInsumo = new Map<string, number>();
    for (const d of comprasPorInsumo ?? []) {
      if (!precioPorInsumo.has(d.insumo_id)) precioPorInsumo.set(d.insumo_id, Number(d.precio_unitario));
    }

    const insumosParaProyeccion: InsumoParaProyeccion[] = (insumos ?? []).map((i) => ({
      insumoId: i.id,
      consumoDiario: consumoDiario(movimientosPorInsumo.get(i.id) ?? [], ventana.desde, ventana.hasta),
      precioUnitario: precioPorInsumo.get(i.id) ?? null,
    }));

    const diasDelPeriodoSiguiente = finDePeriodoSiguiente.getUTCDate();
    const egresoInsumos = egresoProyectadoDeInsumos(insumosParaProyeccion, diasDelPeriodoSiguiente);

    const egresoSanidad = costoSanitarioMensualPromedio(
      (costosSanitarios ?? []).map((e) => Number(e.costo)),
      MESES_DE_COSTO_SANITARIO,
    );

    const resultado = resultadoProyectado(ingresos.proyectado, {
      ordenesCompra: egresoOrdenes,
      insumos: egresoInsumos,
      sanidad: egresoSanidad,
    });

    // Alt. 4.a: sin historia sanitaria en la ventana, el promedio es cero y no
    // "no hay costo sanitario" — hay que decirlo, no dejar que se lea como un
    // cero real.
    const advertencias: string[] = [];
    if ((costosSanitarios ?? []).length === 0) {
      advertencias.push(
        `No hay costos sanitarios aplicados en los últimos ${MESES_DE_COSTO_SANITARIO} meses: el egreso de sanidad se proyecta en $0 por falta de historia, no porque se prevea que no va a haber.`,
      );
    }

    return {
      periodo: isoPeriodoSiguiente,
      diasDeCobertura,
      contratos: contratosResueltos,
      ingresos,
      deuda: { vencido: cartera.vencido, porVencer: cartera.porVencer, cuentasVencidas: cartera.cuentasVencidas },
      resultado,
      advertencias,
      ultimoPeriodoLiquidado: ultimoEstadoCuenta?.periodo ?? null,
    };
  }),
});

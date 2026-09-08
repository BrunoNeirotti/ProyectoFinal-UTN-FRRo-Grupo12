import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/tipos-generados';
import { convertir } from '@/lib/parametros';

/**
 * Los parámetros de cobranza que M3 necesita en casi todos sus procedimientos,
 * ya convertidos a su tipo. Evita repetir `.find(p => p.clave === '…')` con
 * el casteo en cada uno.
 */
export interface ParametrosDeCobranza {
  diaVencimientoDefault: number;
  diaCierrePeriodo: number;
  diasAvisoPrevioVencimiento: number;
  moraTasaMensual: number | null;
  moraAplicacion: 'asistida' | 'automatica';
}

export async function obtenerParametrosDeCobranza(
  supabase: SupabaseClient<Database>,
): Promise<ParametrosDeCobranza> {
  const { data } = await supabase
    .from('parametro')
    .select('clave, valor, tipo')
    .in('clave', [
      'dia_vencimiento_default',
      'dia_cierre_periodo',
      'dias_aviso_previo_vencimiento',
      'mora_tasa_mensual',
      'mora_aplicacion',
    ]);

  const mapa = new Map((data ?? []).map((p) => [p.clave, convertir(p.valor, p.tipo)]));

  return {
    diaVencimientoDefault: (mapa.get('dia_vencimiento_default') as number) ?? 10,
    diaCierrePeriodo: (mapa.get('dia_cierre_periodo') as number) ?? 1,
    diasAvisoPrevioVencimiento: (mapa.get('dias_aviso_previo_vencimiento') as number) ?? 3,
    moraTasaMensual: (mapa.get('mora_tasa_mensual') as number | null) ?? null,
    moraAplicacion: (mapa.get('mora_aplicacion') as 'asistida' | 'automatica') ?? 'asistida',
  };
}

/**
 * Antelación mínima para cancelar una clase, en días (`cancelacion_clase_dias`).
 *
 * La leen el detalle de la clase —para decir de cada cancelación si entró en
 * término— y la cancelación misma. Vive acá y no en cada router por lo mismo
 * que los de cobranza: un parámetro del establecimiento leído en dos lugares
 * termina con dos valores de respaldo distintos. El que se usa si falta es el
 * que sembró la configuración inicial.
 */
export async function antelacionMinimaDeCancelacion(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data } = await supabase
    .from('parametro')
    .select('valor, tipo')
    .eq('clave', 'cancelacion_clase_dias')
    .maybeSingle();

  return data ? (convertir(data.valor, data.tipo) as number) : 3;
}

/**
 * Cuántos puntos tiene que caer la asistencia para marcar a un alumno en riesgo
 * (`riesgo_asistencia_puntos`).
 *
 * Vale el mismo criterio que para la antelación de cancelación: el valor de
 * respaldo es el que sembró la migración de M8, y no uno inventado acá. Dos
 * valores por omisión distintos para el mismo parámetro es cómo se llega a que
 * la pantalla y el reporte marquen alumnos distintos.
 */
export async function umbralDeRiesgoDeAsistencia(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data } = await supabase
    .from('parametro')
    .select('valor, tipo')
    .eq('clave', 'riesgo_asistencia_puntos')
    .maybeSingle();

  return data ? ((convertir(data.valor, data.tipo) as number) ?? 25) : 25;
}

/**
 * Con cuánta antelación se avisa un vencimiento sanitario, en días
 * (`dias_aviso_vencimiento_sanitario`).
 *
 * Mismo criterio que los anteriores: el respaldo es el que sembró la migración
 * de M9. Lo leen el tablero de sanidad y la ficha del caballo, que tienen que
 * pintar de rojo exactamente los mismos animales.
 */
export async function antelacionDeAvisoSanitario(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data } = await supabase
    .from('parametro')
    .select('valor, tipo')
    .eq('clave', 'dias_aviso_vencimiento_sanitario')
    .maybeSingle();

  return data ? ((convertir(data.valor, data.tipo) as number) ?? 30) : 30;
}

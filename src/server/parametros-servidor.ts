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

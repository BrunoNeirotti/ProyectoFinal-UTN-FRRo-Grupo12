-- M11 · Corrección de QA: «período liquidado» son los cargos generados
-- (`movimiento_cuenta.tipo = 'cargo'`, lo que escribe `generarCargosDelPeriodo`
-- en M3), no los estados de cuenta emitidos. `estado_cuenta` es un documento
-- posterior -el PDF que se le manda al cliente- y en este establecimiento
-- puede no existir todavía ninguno aunque ya haya varios meses facturados: la
-- prueba en el navegador dio de alta una tarifa retroactiva a 2025 sin que el
-- disparador la rechazara, con cargos ya generados para agosto y septiembre de
-- 2026. La restricción tiene que mirar el cargo, que es lo que de verdad fija
-- qué precio ya se cobró.
create or replace function validar_tarifa_no_retroactiva()
returns trigger language plpgsql as $$
declare
  ultimo_periodo date;
begin
  select max(periodo) into ultimo_periodo
  from movimiento_cuenta
  where tipo = 'cargo';

  if ultimo_periodo is not null and date_trunc('month', new.vigente_desde)::date <= ultimo_periodo then
    raise exception
      'La tarifa sólo puede regir desde una fecha posterior al último período con cargos generados (%), para no alterar lo ya facturado.',
      to_char(ultimo_periodo, 'mm/yyyy');
  end if;

  return new;
end $$;

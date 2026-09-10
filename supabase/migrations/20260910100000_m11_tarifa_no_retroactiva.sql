-- M11 · CUS07, alternativa 8.a: una tarifa no puede regir desde una fecha que
-- ya esté dentro de un período liquidado, porque el estado de cuenta emitido
-- ya congeló el importe con el que se facturó ese mes. Sin esta restricción, el
-- presupuesto simulado en el panel de gerencia podría aplicarse retroactivo y
-- dejar de coincidir con lo que el cliente ya recibió.
create or replace function validar_tarifa_no_retroactiva()
returns trigger language plpgsql as $$
declare
  ultimo_periodo date;
begin
  select max(periodo) into ultimo_periodo from estado_cuenta;

  if ultimo_periodo is not null and date_trunc('month', new.vigente_desde)::date <= ultimo_periodo then
    raise exception
      'La tarifa sólo puede regir desde una fecha posterior al último período liquidado (%), para no alterar liquidaciones ya emitidas.',
      to_char(ultimo_periodo, 'mm/yyyy');
  end if;

  return new;
end $$;

create trigger trg_tarifa_no_retroactiva
  before insert on tarifa
  for each row execute function validar_tarifa_no_retroactiva();

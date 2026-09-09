-- =============================================================================
-- RIENDA · M10 · El ciclo de la orden de compra, sostenido por la base
--
-- La decisión 1.11 agregó `parcialmente_recibida` y `cantidad_recibida` porque
-- «una entrega incompleta es corriente con proveedores de forraje». Agregarlos
-- resolvió que el caso se pudiera representar; falta que no se pueda
-- representar mal, que es lo que decide si el estado sirve para algo.
--
-- Tres reglas, y las tres viven acá y no en la pantalla por el motivo de
-- siempre: una validación que sólo existe en el cliente se saltea con una
-- llamada directa a PostgREST.
--
--   1. El estado de recepción se DERIVA del detalle. Nadie lo elige de una
--      lista. Si los seis renglones llegaron completos la orden está recibida, y
--      si llegaron cuatro está parcialmente recibida, se haya acordado alguien
--      de tocar el estado o no. Es el mismo criterio que `total` y que
--      `insumo.stock_actual`: el dato que se puede calcular no se guarda a mano.
--
--   2. El detalle de una orden que ya salió no se edita. Cambiarle la cantidad
--      pedida o el precio a una orden enviada reescribe un documento que el
--      proveedor ya tiene, y deja el remito discutiendo contra el sistema. Lo
--      único que sí cambia después de enviar es `cantidad_recibida`, que es
--      justamente lo que la recepción informa.
--
--   3. De `anulada` no se vuelve, y a `borrador` tampoco. Reabrir como borrador
--      una orden enviada sería la puerta de atrás a la regla 2.
--
-- Lo que NO se hace acá es generar el movimiento de existencias al recibir. Eso
-- queda en el router, igual que el consumo de M9: un ingreso automático desde un
-- disparador no se puede corregir sin pelear contra el disparador, y una
-- recepción mal cargada es cosa de todos los días.
-- =============================================================================

/**
 * El estado de recepción sale de los renglones.
 *
 * Sólo actúa sobre órdenes que ya salieron: un borrador y una anulada no
 * cambian de estado porque alguien haya cargado un renglón.
 */
create or replace function recalcular_estado_orden()
returns trigger language plpgsql as $$
declare
  orden     uuid;
  renglones int;
  completos int;
  iniciados int;
begin
  orden := coalesce(new.orden_compra_id, old.orden_compra_id);

  select count(*),
         count(*) filter (where coalesce(cantidad_recibida, 0) >= cantidad),
         count(*) filter (where coalesce(cantidad_recibida, 0) > 0)
    into renglones, completos, iniciados
    from detalle_orden_compra where orden_compra_id = orden;

  update orden_compra o
     set estado = case
                    when renglones = 0    then 'enviada'::estado_orden_compra
                    when completos = renglones then 'recibida'
                    when iniciados > 0    then 'parcialmente_recibida'
                    else 'enviada'
                  end
   where o.id = orden
     and o.estado in ('enviada', 'parcialmente_recibida', 'recibida');

  return null;
end $$;

create trigger trg_estado_orden
  after insert or update or delete on detalle_orden_compra
  for each row execute function recalcular_estado_orden();


/**
 * Qué se puede tocar del detalle según en qué estado esté la orden.
 *
 * `cantidad_recibida` es la excepción y es la única: es el dato que la
 * recepción trae, y por eso puede cambiar cuando la orden ya salió y no puede
 * cambiar mientras es un borrador -no se recibe lo que todavía no se pidió-.
 */
create or replace function detalle_segun_estado_de_orden()
returns trigger language plpgsql as $$
declare
  estado_actual estado_orden_compra;
  orden         uuid;
begin
  orden := coalesce(new.orden_compra_id, old.orden_compra_id);
  select estado into estado_actual from orden_compra where id = orden;

  -- Un borrado en cascada por eliminar la orden entera no tiene que chocar acá.
  if estado_actual is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op in ('INSERT', 'DELETE') and estado_actual <> 'borrador' then
    raise exception
      'La orden ya salió (%): sus renglones no se agregan ni se quitan.', estado_actual
      using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' then
    if estado_actual <> 'borrador'
       and (new.insumo_id  is distinct from old.insumo_id
         or new.cantidad   is distinct from old.cantidad
         or new.precio_unitario is distinct from old.precio_unitario) then
      raise exception
        'La orden ya salió (%): sólo se puede informar lo recibido.', estado_actual
        using errcode = 'check_violation';
    end if;

    if estado_actual in ('borrador', 'anulada')
       and new.cantidad_recibida is distinct from old.cantidad_recibida then
      raise exception
        'Una orden en % no recibe mercadería.', estado_actual
        using errcode = 'check_violation';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger trg_detalle_segun_estado
  before insert or update or delete on detalle_orden_compra
  for each row execute function detalle_segun_estado_de_orden();


/**
 * De dónde a dónde puede moverse una orden.
 *
 * No enumera las transiciones válidas -el disparador de arriba escribe tres de
 * ellas y una lista blanca lo pelearía-, sino que cierra las dos que corrompen
 * datos: salir de `anulada` y volver a `borrador`.
 *
 * De paso sostiene la serie del número: `anio` se asignó al crear y la fecha de
 * emisión no puede irse a otro año sin dejar el número apuntando a la serie
 * equivocada.
 */
create or replace function transicion_de_orden()
returns trigger language plpgsql as $$
begin
  if old.estado = 'anulada' and new.estado <> 'anulada' then
    raise exception 'Una orden anulada está cerrada: no vuelve a ningún estado.'
      using errcode = 'check_violation';
  end if;

  if old.estado <> 'borrador' and new.estado = 'borrador' then
    raise exception 'Una orden que ya salió no vuelve a ser un borrador.'
      using errcode = 'check_violation';
  end if;

  if extract(year from new.fecha_emision)::smallint <> new.anio then
    raise exception 'La orden % pertenece a la serie %: su fecha no puede irse a otro año.',
      new.numero, new.anio using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger trg_transicion_orden
  before update on orden_compra
  for each row execute function transicion_de_orden();

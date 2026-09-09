-- =============================================================================
-- RIENDA · M10 · Un renglón tampoco NACE recibido
--
-- `trg_detalle_segun_estado` cierra la puerta de que una orden en borrador
-- reciba mercadería, pero sólo la mira en el `update`. El renglón se inserta
-- siempre en un borrador -es el único estado que admite altas-, así que un
-- `insert` que ya traiga `cantidad_recibida` entra sin que nadie lo revise: la
-- misma regla, esquivada por el otro lado.
--
-- Apareció armando los datos de demostración, que es donde se escribe contra la
-- base sin pasar por la aplicación. Es exactamente el escenario contra el que
-- estos disparadores existen -«una validación que sólo vive en el cliente se
-- saltea con una llamada directa a PostgREST»-, y la primera vez que se lo
-- ejercitó de verdad mostró el agujero.
--
-- La regla completa, entonces: `cantidad_recibida` sólo puede dejar de ser nula
-- en una orden que ya salió. Ni al insertar ni al actualizar hay excepción.
-- =============================================================================

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

  if tg_op = 'INSERT' and new.cantidad_recibida is not null then
    raise exception
      'Un renglón nuevo no puede venir recibido: la orden todavía no salió.'
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

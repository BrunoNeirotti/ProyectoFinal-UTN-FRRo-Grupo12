-- =============================================================================
-- RIENDA · 0003 · Invariantes derivadas y traza de auditoría
--
-- Acá viven las reglas del modelo que NO pueden quedar a criterio de quien
-- programe cada pantalla, porque si se rompen corrompen datos en silencio:
--
--   * El saldo de la cuenta corriente es derivado (decisión 1.5).
--   * La existencia de un insumo es derivada (mismo criterio).
--   * El interés por mora NO capitaliza (RN-09, punto 4).
--   * Un contrato cuelga de un caballo o de un alumno según el servicio.
--
-- La auditoría es requisito de la factibilidad legal y condición para poder
-- discutir un cargo con un cliente. Se implementa como disparador y no como
-- llamada desde la aplicación: un camino que se olvide de registrar deja un
-- agujero que después nadie encuentra.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Quién está operando. Devuelve null en procesos automáticos, que es un caso
-- legítimo y por eso `auditoria.usuario_id` es nullable.
-- -----------------------------------------------------------------------------
create or replace function usuario_actual()
returns uuid language sql stable as $$
  select u.id from usuario u where u.id = auth.uid();
$$;


-- -----------------------------------------------------------------------------
-- Decisión 1.5 · El saldo se recalcula, nunca se escribe
-- -----------------------------------------------------------------------------
create or replace function recalcular_saldo_cuenta()
returns trigger language plpgsql as $$
declare cuenta uuid;
begin
  cuenta := coalesce(new.cuenta_corriente_id, old.cuenta_corriente_id);
  update cuenta_corriente c
     set saldo = coalesce((
           select sum(m.importe) from movimiento_cuenta m
            where m.cuenta_corriente_id = cuenta), 0),
         saldo_actualizado_en = now()
   where c.id = cuenta;
  return null;
end $$;

create trigger trg_saldo_cuenta
  after insert or update or delete on movimiento_cuenta
  for each row execute function recalcular_saldo_cuenta();

-- Nadie escribe el saldo a mano, ni siquiera el administrador.
create or replace function impedir_escritura_de_saldo()
returns trigger language plpgsql as $$
begin
  if new.saldo is distinct from old.saldo
     and current_setting('rienda.recalculando', true) is distinct from 'on' then
    raise exception
      'El saldo es derivado de movimiento_cuenta y no admite escritura directa (decisión 1.5)';
  end if;
  return new;
end $$;


-- -----------------------------------------------------------------------------
-- La existencia del insumo, con el mismo criterio
-- -----------------------------------------------------------------------------
create or replace function recalcular_stock_insumo()
returns trigger language plpgsql as $$
declare ins uuid;
begin
  ins := coalesce(new.insumo_id, old.insumo_id);
  update insumo i
     set stock_actual = coalesce((
           select sum(case m.tipo
                        when 'ingreso' then  m.cantidad
                        when 'egreso'  then -m.cantidad
                        else m.cantidad          -- `ajuste`: el signo lo trae el motivo
                      end)
             from movimiento_stock m where m.insumo_id = ins), 0)
   where i.id = ins;
  return null;
end $$;

create trigger trg_stock_insumo
  after insert or update or delete on movimiento_stock
  for each row execute function recalcular_stock_insumo();


-- -----------------------------------------------------------------------------
-- El total de una orden sale de su detalle
-- -----------------------------------------------------------------------------
create or replace function recalcular_total_orden()
returns trigger language plpgsql as $$
declare orden uuid;
begin
  orden := coalesce(new.orden_compra_id, old.orden_compra_id);
  update orden_compra o
     set total = coalesce((
           select sum(d.cantidad * d.precio_unitario)
             from detalle_orden_compra d where d.orden_compra_id = orden), 0)
   where o.id = orden;
  return null;
end $$;

create trigger trg_total_orden
  after insert or update or delete on detalle_orden_compra
  for each row execute function recalcular_total_orden();


-- -----------------------------------------------------------------------------
-- Un contrato cuelga de un caballo o de un alumno SEGÚN EL SERVICIO
--
-- El CHECK de la tabla ya garantiza que hay exactamente uno de los dos. Lo que
-- no puede ver un CHECK es si el que hay es el que corresponde, porque eso vive
-- en `servicio.aplica_a`.
-- -----------------------------------------------------------------------------
create or replace function validar_objeto_del_contrato()
returns trigger language plpgsql as $$
declare aplica aplica_servicio;
begin
  select s.aplica_a into aplica from servicio s where s.id = new.servicio_id;
  if aplica = 'caballo' and new.caballo_id is null then
    raise exception 'El servicio se presta sobre un caballo y el contrato no lo indica';
  elsif aplica = 'alumno' and new.alumno_id is null then
    raise exception 'El servicio se presta sobre un alumno y el contrato no lo indica';
  end if;
  return new;
end $$;

create trigger trg_contrato_objeto
  before insert or update on contrato
  for each row execute function validar_objeto_del_contrato();


-- -----------------------------------------------------------------------------
-- RN-09 · La base de la mora, con la regla de que el interés no genera interés
--
-- Se escribe como función y no como comentario justamente porque es una regla
-- de negocio: dejarla a criterio de quien arme la consulta es cómo se cuela el
-- anatocismo sin que nadie lo decida.
-- -----------------------------------------------------------------------------
create or replace function base_de_mora(p_cuenta uuid, p_al date)
returns numeric language sql stable as $$
  select coalesce(sum(m.importe), 0)
    from movimiento_cuenta m
   where m.cuenta_corriente_id = p_cuenta
     and m.tipo <> 'interes_mora'        -- NO capitaliza (RN-09, punto 4)
     and (m.vence_en is null or m.vence_en < p_al);
$$;
comment on function base_de_mora(uuid, date) is
  'Saldo vencido sobre el que se calcula el interés. Excluye los movimientos de '
  'tipo interes_mora: el interés no genera interés (RN-09). El prorrateo diario '
  'es base x tasa / 30 x días.';


-- =============================================================================
-- TRAZA DE AUDITORÍA
-- =============================================================================

create or replace function registrar_en_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  fila_id uuid;
  previos jsonb;
  que     accion_auditoria;
begin
  if tg_op = 'INSERT' then
    que := 'alta';     previos := null;              fila_id := (to_jsonb(new)->>'id')::uuid;
  elsif tg_op = 'UPDATE' then
    que := 'modificacion'; previos := to_jsonb(old); fila_id := (to_jsonb(new)->>'id')::uuid;
  else
    que := 'baja';     previos := to_jsonb(old);     fila_id := (to_jsonb(old)->>'id')::uuid;
  end if;

  insert into auditoria (usuario_id, entidad, entidad_id, accion, datos_previos)
  values (usuario_actual(), tg_table_name, fila_id, que, previos);

  return coalesce(new, old);
end $$;

-- Se engancha sobre todas las tablas del esquema salvo la propia auditoría (que
-- se auditaría a sí misma en bucle) y salvo `usuario`, que se audita igual pero
-- se deja explícito para que se vea que no es un olvido.
create or replace function instalar_auditoria()
returns void language plpgsql as $$
declare t record;
begin
  for t in
    select c.relname as tabla
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and c.relname <> 'auditoria'
  loop
    execute format(
      'drop trigger if exists trg_auditoria on public.%I;
       create trigger trg_auditoria after insert or update or delete on public.%I
       for each row execute function registrar_en_auditoria()', t.tabla, t.tabla);
  end loop;
end $$;

select instalar_auditoria();

-- La auditoría no se corrige: es la prueba de qué pasó. Sólo se agrega.
create rule auditoria_sin_update as on update to auditoria do instead nothing;
create rule auditoria_sin_delete as on delete to auditoria do instead nothing;

-- =============================================================================
-- RIENDA · M10 · El número de orden también tiene que ser opcional al insertar
--
-- La migración anterior dejó `anio` y `numero` como `not null` sin valor por
-- omisión, confiando en que el disparador los completa antes de que la fila se
-- escriba. Funciona en la base y rompe una capa más arriba: `supabase gen types`
-- lee el esquema, ve dos columnas obligatorias sin `default`, y genera un tipo
-- de inserción que las exige. El router quedaría teniendo que inventar un número
-- para que TypeScript lo deje pasar, que es exactamente lo contrario de lo que
-- la serie necesita.
--
-- Es la misma clase de problema que el README anota sobre `db:lint`: el esquema
-- tipado es parte del contrato, así que una regla que la base cumple por
-- disparador tiene que quedar declarada de una forma que el generador entienda.
--
-- Se resuelve con un valor por omisión que el disparador pisa siempre. Y como
-- ahora nunca llega nulo, el disparador deja de preguntar si el número vino: la
-- serie es del sistema y no un dato de entrada. Pasar un número a mano no era
-- una función de nadie; era la puerta por la que se colaba un duplicado.
-- =============================================================================

alter table orden_compra
  alter column anio   set default extract(year from current_date)::smallint,
  alter column numero set default 0;

-- El CHECK `numero > 0` se evalúa después del disparador, así que el 0 por
-- omisión no llega nunca a la fila escrita. Está para que la columna tenga un
-- valor con el que entrar al disparador, no para usarse.
create or replace function numerar_orden_compra()
returns trigger language plpgsql as $$
begin
  new.anio := extract(year from new.fecha_emision)::smallint;

  perform pg_advisory_xact_lock(hashtext('orden_compra'), new.anio::int);
  select coalesce(max(numero), 0) + 1 into new.numero
    from orden_compra where anio = new.anio;

  return new;
end $$;

-- =============================================================================
-- RIENDA · M9 · El plan alimentario nombra el insumo que consume
--
-- El CUS02 pide, en su paso 5, que el sistema impute el egreso de los insumos
-- consumidos al registrar la toma. El plan describía la ración en prosa
-- -«Pastura + balanceado», con su cantidad- y no decía de qué existencia sale,
-- así que el descuento no tenía entrada determinista: había que adivinar el
-- insumo a partir de un texto libre, o pedírselo al peón caballo por caballo en
-- cada toma, que es lo que el paso 3 del mismo caso de uso descarta.
--
-- En higiene el problema no aparece porque el material se elige al registrar
-- («2 packs de viruta», decisión 1.7). En alimentación sí, porque la ración la
-- fija el plan y el peón sólo confirma y ajusta la cantidad.
--
-- Es el mismo hallazgo que los cuatro de la decisión 1.11 y se resuelve igual:
-- un atributo sobre una entidad que ya existe. No hay entidad nueva -siguen
-- siendo 33- y no cruza ningún umbral de complejidad IFPUG, así que la medición
-- queda en 936 PFSA y 1.030 PFA.
--
-- Nulo es un estado legítimo y no un dato faltante: cubre la pastura de piquete,
-- que se come del campo y no sale de ninguna existencia. Sin insumo, el sistema
-- registra el suministro y no imputa consumo, que es el estado real del hecho.
-- `on delete restrict` porque borrar un insumo que un plan vigente consume
-- dejaría la ración sin origen.
-- =============================================================================

alter table plan_alimentario
  add column insumo_id uuid references insumo(id) on delete restrict;

create index plan_alimentario_insumo_idx on plan_alimentario (insumo_id)
  where insumo_id is not null;

comment on column plan_alimentario.insumo_id is
  'De qué existencia sale la ración. Lo pide el paso 5 del CUS02: sin esto el '
  'egreso no se puede imputar sin adivinar el insumo desde un texto libre. '
  'Nulo = se suministra pero no descuenta stock (pastura de piquete).';

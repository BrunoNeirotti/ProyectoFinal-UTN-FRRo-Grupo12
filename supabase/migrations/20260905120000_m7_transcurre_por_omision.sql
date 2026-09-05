-- =============================================================================
-- RIENDA · M7 · `clase.transcurre` deja de ser obligatorio al insertar
--
-- `transcurre` es una columna derivada: la calcula el disparador
-- `trg_transcurre_clase` a partir de `inicia_en` y `duracion_min`, y ninguna
-- pantalla la escribe. Le faltaba lo que todas las demás derivadas del esquema
-- ya tienen —`cuenta_corriente.saldo`, `insumo.stock_actual`,
-- `orden_compra.total` llevan `default 0`—: un valor por omisión.
--
-- Sin él, la columna viaja como obligatoria en el esquema tipado que genera
-- Supabase, y el alta de una clase no compila salvo que la aplicación mande un
-- rango que no le corresponde calcular. El hueco no se veía antes porque hasta
-- M7 nadie insertaba clases desde código tipado.
--
-- El valor elegido es el rango vacío y no `now()`: si algún día el disparador
-- no corriera, un rango vacío no se superpone con nada y la clase queda visible
-- con su horario en `inicia_en`, en lugar de bloquear una franja real por un
-- valor de relleno.
-- =============================================================================

alter table clase alter column transcurre set default 'empty'::tstzrange;

comment on column clase.transcurre is
  'Derivada de inicia_en y duracion_min por trg_transcurre_clase. Es lo que '
  'comparan las dos restricciones de exclusión. La aplicación no la escribe: el '
  'valor por omisión existe para que no tenga que hacerlo.';

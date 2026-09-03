-- =============================================================================
-- RIENDA · 0006 · M3 · Un cargo por contrato y período
--
-- El CUS01 genera los cargos del período recorriendo los contratos vigentes.
-- Sin esta restricción, reintentar "Generar los cargos del período" -por un
-- doble clic o por reintentar tras un error de red- duplicaría el cargo de
-- cada contrato. Es un índice único parcial y no una restricción de tabla
-- porque sólo tiene sentido sobre las filas de tipo `cargo`: un contrato
-- puede tener además un ajuste o un interés en el mismo período.
-- =============================================================================

create unique index movimiento_cargo_unico_por_periodo
  on movimiento_cuenta (contrato_id, periodo)
  where (tipo = 'cargo');

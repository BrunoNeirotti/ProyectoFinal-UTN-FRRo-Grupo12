-- =============================================================================
-- RIENDA · M7 · A quién sugerir al inscribir
--
-- Complemento de `tiene_contrato_vigente`, del paso anterior. Las dos contestan
-- sobre contratos sin exponer la tabla, pero no contestan lo mismo:
--
--   * `tiene_contrato_vigente(alumno, servicio)` responde por UNO, y es lo que
--     se pregunta al inscribir para decidir si la inscripción queda señalada
--     como sin respaldo contractual (CUS05, camino 4.b).
--   * `alumnos_con_contrato_vigente(servicio)` responde QUIÉNES, y es lo que
--     arma la lista sugerida antes de elegir (CUS05, paso 4).
--
-- Pedir la primera una vez por alumno para armar la lista sería un viaje a la
-- base por fila para responder algo que se puede responder de una.
-- =============================================================================

create or replace function alumnos_con_contrato_vigente(p_servicio uuid, p_al date default current_date)
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.alumno_id from contrato c
   where es_personal()
     and c.servicio_id = p_servicio
     and c.alumno_id is not null
     and c.estado = 'vigente'
     and c.fecha_inicio <= p_al
     and (c.fecha_fin is null or c.fecha_fin >= p_al);
$$;

comment on function alumnos_con_contrato_vigente(uuid, date) is
  'CUS05 paso 4: la lista sugerida al inscribir. Devuelve identificadores de '
  'alumno, nunca importes; el instructor sigue sin poder leer contrato.';

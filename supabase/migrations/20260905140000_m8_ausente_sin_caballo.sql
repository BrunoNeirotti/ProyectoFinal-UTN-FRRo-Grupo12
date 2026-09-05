-- =============================================================================
-- RIENDA · M8 · El que no vino no montó
--
-- `asistencia.caballo_id` responde «con cuál montó», así que sobre un alumno
-- ausente no tiene respuesta posible. El QA de la pantalla lo destapó: se marca
-- a alguien presente con su caballo, se corrige a ausente y el caballo queda
-- pegado a la fila. No se ve —la pantalla oculta el caballo del ausente— y por
-- eso mismo conviene que no exista, en lugar de confiar en que ninguna consulta
-- futura lo cuente.
--
-- Importa porque `caballo_id` es la fuente del control de carga de trabajo por
-- animal, que es bienestar animal: un caballo al que se le imputan clases que
-- no trabajó aparece sobrecargado, y la sobrecarga es justo lo que el reporte
-- existe para detectar.
--
-- La regla es de nulidad, no de negocio con excepciones, así que va como CHECK
-- y no como disparador: es más barato y no puede saltearse.
-- =============================================================================

update asistencia set caballo_id = null where not presente and caballo_id is not null;

alter table asistencia
  add constraint asistencia_ausente_sin_caballo check (presente or caballo_id is null);

comment on column asistencia.caballo_id is
  'Con cuál montó. Nulo obligatoriamente si no asistió: es el dato del que sale '
  'la carga de trabajo por animal, y un caballo con clases que no trabajó '
  'aparecería sobrecargado en el reporte que sirve para detectar sobrecargas.';

-- =============================================================================
-- RIENDA · M9 · La higiene de un box desocupado también es un cuidado
--
-- El camino 2.a del CUS03 dice, textual: «Un box se encuentra desocupado: el
-- sistema lo presenta sin caballo asociado y admite el registro de la higiene
-- contra la instalación solamente». Con `caballo_id not null` ese camino no se
-- puede recorrer: el peón limpia el box, el sistema se niega a anotarlo, y el
-- consumo de material de cama de ese box queda sin imputar. Justamente el dato
-- que la postcondición del caso declara como el que hoy no se registra y que
-- impide imputar el costo por instalación.
--
-- Es el mismo error de fondo que la decisión 1.11 describe -haber modelado el
-- caso corriente y no el ciclo completo-, sólo que acá la pieza que falta no es
-- un estado intermedio sino un vínculo que resultaba obligatorio siendo opcional.
--
-- No alcanza con permitir el nulo: un registro sin caballo Y sin instalación no
-- es un cuidado de nada, así que la restricción pasa de «tiene caballo» a «tiene
-- al menos uno de los dos». Va como CHECK y no como disparador porque es una
-- regla de nulidad, no de negocio con excepciones: es más barata y no se saltea.
--
-- La alimentación no se ve afectada: se sirve a un animal, así que sus registros
-- siguen trayendo caballo. Lo que cambia es que ahora la base lo permite para
-- higiene, que es donde el caso de uso lo pide.
-- =============================================================================

alter table registro_cuidado
  alter column caballo_id drop not null;

alter table registro_cuidado
  add constraint registro_cuidado_sobre_algo
  check (caballo_id is not null or instalacion_id is not null);

comment on column registro_cuidado.caballo_id is
  'Sobre qué animal se hizo la tarea. Nulo sólo cuando el cuidado es de la '
  'instalación y no de un caballo: la higiene de un box desocupado (CUS03, '
  'camino 2.a). La restricción `registro_cuidado_sobre_algo` impide que queden '
  'nulos los dos a la vez.';

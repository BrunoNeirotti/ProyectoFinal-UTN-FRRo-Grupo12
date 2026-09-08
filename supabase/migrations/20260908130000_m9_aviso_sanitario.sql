-- =============================================================================
-- RIENDA · M9 · Con cuánta antelación avisar un vencimiento sanitario
--
-- `evento_sanitario.proxima_fecha` es la fecha en que toca repetir: la próxima
-- desparasitación, el refuerzo de una vacuna, el herrado. La alerta no puede
-- encenderse el día del vencimiento, porque para entonces ya no hay margen para
-- conseguir la droga ni para coordinar al profesional.
--
-- Va como parámetro y no como constante por el mismo motivo que
-- `dias_aviso_previo_vencimiento` en cobranza: el margen útil depende de cómo se
-- consigue cada cosa, y eso lo sabe el establecimiento, no el código. El haras
-- no dio un número, así que se adopta 30 días -un mes de anticipación sobre un
-- ciclo que es estacional- y queda a la vista para discutirlo.
--
-- El mínimo es 1 y no 0: con 0 la alerta aparecería el día del vencimiento, que
-- es exactamente el aviso que no sirve.
-- =============================================================================

insert into parametro (clave, valor, tipo, etiqueta, ayuda) values
  ('dias_aviso_vencimiento_sanitario', '30', 'entero',
   'Antelación del aviso de vencimiento sanitario (días)',
   'Con cuántos días de anticipación se marca que a un caballo le toca la '
   'próxima desparasitación, vacuna o herrado. Hoy el vencimiento se descubre '
   'mirando la ficha de a uno, así que el que no se mira no se aplica.')
on conflict (clave) do nothing;

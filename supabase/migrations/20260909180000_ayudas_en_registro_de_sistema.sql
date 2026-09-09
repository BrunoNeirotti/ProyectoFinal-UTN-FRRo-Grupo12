-- =============================================================================
-- RIENDA · Los textos de ayuda de Configuración, en registro de sistema
--
-- Cuatro ayudas de `parametro` explicaban además cómo se hacen hoy las cosas sin
-- el sistema -«el que no se mira no se aplica», «casi siempre está por darse de
-- baja», «no despierta a nadie»- o comentaban la decisión en lugar de describir
-- el parámetro. Eso es fundamentación de diseño: pertenece al informe y a los
-- comentarios del código, no a la pantalla que el dueño del haras usa todos los
-- días.
--
-- La ayuda de un parámetro dice **qué hace ese valor**, y nada más. Lo demás,
-- por bien escrito que esté, es ruido para el que sólo quiere saber en cuánto
-- ponerlo.
-- =============================================================================

update parametro set ayuda =
  'En modo asistido el sistema calcula el interés y lo propone; un usuario '
  'confirma antes de que se impute.'
 where clave = 'mora_aplicacion';

update parametro set ayuda =
  'Los mensajes generados fuera de la franja se encolan y se envían al abrir la '
  'siguiente (RN-17).'
 where clave = 'mensajes_ventana_desde';

update parametro set ayuda =
  'Caída de asistencia respecto del promedio de los tres períodos anteriores a '
  'partir de la cual el alumno se marca en riesgo. Con 100 la marca no se '
  'enciende nunca.'
 where clave = 'riesgo_asistencia_puntos';

update parametro set ayuda =
  'Días de anticipación con que se informa el próximo vencimiento sanitario de '
  'cada caballo: desparasitación, vacunación o herrado.'
 where clave = 'dias_aviso_vencimiento_sanitario';

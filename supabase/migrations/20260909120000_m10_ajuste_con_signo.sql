-- =============================================================================
-- RIENDA · M10 · Un ajuste de existencias también puede restar
--
-- El diccionario dice de `movimiento_stock.cantidad`: «siempre positiva; el
-- signo lo da `tipo`». Vale para `ingreso` y para `egreso`, que traen el signo
-- en el nombre, y no vale para `ajuste`, que no lo trae: un ajuste corrige la
-- existencia contra un conteo físico y el conteo puede dar de menos igual que
-- de más. Con `cantidad > 0` esa mitad del caso no se puede representar.
--
-- No es una hipótesis. La pantalla de Inventario del prototipo cierra con el
-- ajuste que efectivamente ocurrió: «-12 bolsas de viruta, 30/04, por rotura en
-- depósito». Y el router de M9 ya había anotado el otro extremo del mismo hueco:
-- cuando el peón sirve más de lo que el sistema creía que quedaba, la existencia
-- queda en rojo y «se regulariza con un ajuste, que es justamente el dato que
-- hoy no se tiene». Ese ajuste es el que resta, y hasta hoy no entraba.
--
-- Es el sexto hueco de la clase que describe la decisión 1.11 y el tercero que
-- destapa la construcción: los cuatro de los casos de uso eran estados
-- intermedios que faltaban, y los tres de M9 y M10 son la misma omisión mirada
-- desde el otro lado -haber modelado el caso corriente y no el completo-.
--
-- El disparador de 0003 no se toca, y no por casualidad: ya suma el `ajuste` tal
-- cual viene (`else m.cantidad`), a diferencia del `egreso`, al que le invierte
-- el signo. Estaba escrito esperando esto. Lo único que sobraba era el CHECK.
--
-- Cero sigue prohibido, y para los tres tipos: un movimiento que no mueve nada
-- no es un movimiento. Si lo que se quiere es dejar constancia de un conteo que
-- coincidió, eso es una observación y no un asiento en el libro de existencias.
-- =============================================================================

alter table movimiento_stock
  drop constraint movimiento_stock_cantidad_check;

alter table movimiento_stock
  add constraint movimiento_stock_cantidad_con_signo
  check (case when tipo = 'ajuste' then cantidad <> 0 else cantidad > 0 end);

comment on column movimiento_stock.cantidad is
  'Positiva en `ingreso` y en `egreso`, donde el signo lo da el tipo. En '
  '`ajuste` lleva el signo propio: negativa cuando el conteo físico da menos '
  'que lo registrado. Nunca cero.';

comment on column movimiento_stock.motivo is
  'Por qué se movió la existencia. En un `ajuste` deja de ser opcional en los '
  'hechos: un ajuste sin explicación es indistinguible de un error de carga, y '
  'la pantalla lo exige.';

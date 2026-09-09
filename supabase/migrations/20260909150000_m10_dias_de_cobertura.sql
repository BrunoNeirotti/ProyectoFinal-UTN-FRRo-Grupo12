-- =============================================================================
-- RIENDA · M10 · Cuántos días de existencia tiene que comprar una orden
--
-- La pantalla de Inventario propone la orden con los insumos bajo mínimo, y para
-- proponer una cantidad hace falta responder «¿comprar para cuánto tiempo?». La
-- respuesta no es del programa: depende de cada cuánto pasa el proveedor, de
-- cuánto depósito hay y de cuánta plata se quiere inmovilizar en forraje. Es
-- una decisión del establecimiento, así que va a `parametro` como el umbral de
-- M8 y los días de aviso sanitario de M9.
--
-- Treinta días es lo relevado: el haras compra por mes. El mínimo de 7 y el tope
-- de 180 acotan a lo que un forraje tolera almacenado.
--
-- Que la sugerencia sea configurable es además lo que la mantiene siendo una
-- sugerencia: la orden que se genera nace en `borrador` y el dueño la edita
-- antes de enviarla. El sistema propone la cuenta que hoy nadie hace; no compra.
-- =============================================================================

insert into parametro (clave, valor, tipo, etiqueta, ayuda) values
  ('inventario_dias_cobertura', '30', 'entero',
   'Días de existencia que compra una orden sugerida',
   'Cuando el sistema propone reponer un insumo, calcula la cantidad para cubrir '
   'este tiempo según el consumo de los últimos noventa días. Conviene que sea al '
   'menos lo que tarda el proveedor en entregar, más el intervalo entre compras.')
on conflict (clave) do nothing;

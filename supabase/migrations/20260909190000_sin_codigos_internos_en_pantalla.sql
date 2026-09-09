-- =============================================================================
-- RIENDA · Los códigos internos salen de los textos de pantalla
--
-- Las ayudas de `parametro` citaban la regla de negocio que las origina: «Rige
-- para todo cliente que no tenga un día propio pactado (RN-08)», «se emite el
-- lunes a las 9 (RN-10)». RN-08 y RN-10 son numeración del informe: le sirven al
-- grupo y a la cátedra para rastrear de dónde salió cada decisión, y no le dicen
-- absolutamente nada a quien administra el haras.
--
-- La trazabilidad no se pierde: sigue en el informe, en los comentarios del
-- esquema y en los de cada router, que son los tres lugares donde alguien la va
-- a buscar. Lo que no corresponde es que aparezca en la pantalla de todos los
-- días.
--
-- Se hace por expresión regular y no texto por texto para que alcance también a
-- lo que se haya sembrado después, y se limpia el espacio que queda antes del
-- punto final.
-- =============================================================================

update parametro
   set ayuda = regexp_replace(
                 regexp_replace(ayuda, '\s*\((?:RN|CUS|RF|RNF|R|D)-?[0-9]+[^)]*\)', '', 'g'),
                 '\s+([.,;])', '\1', 'g')
 where ayuda ~ '\((?:RN|CUS|RF|RNF|R|D)-?[0-9]';

update parametro
   set etiqueta = regexp_replace(etiqueta, '\s*\((?:RN|CUS|RF|RNF|R|D)-?[0-9]+[^)]*\)', '', 'g')
 where etiqueta ~ '\((?:RN|CUS|RF|RNF|R|D)-?[0-9]';

-- La ayuda de la hora de cierre remitía a la de apertura nombrando la regla; sin
-- el código, la frase queda coja. Se la escribe entera.
update parametro
   set ayuda = 'Hora hasta la que se envían mensajes. Lo generado después se encola y sale a la '
               'hora de apertura del día siguiente.'
 where clave = 'mensajes_ventana_hasta';

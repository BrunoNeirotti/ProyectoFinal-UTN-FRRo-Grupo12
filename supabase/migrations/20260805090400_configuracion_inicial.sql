-- =============================================================================
-- RIENDA · 0005 · Configuración inicial
--
-- Va como migración y no como semilla de desarrollo porque no son datos de
-- prueba: son las reglas que el haras confirmó el 30/07/2026 y sin las cuales el
-- sistema no puede operar. Seis de las nueve claves de `parametro` no existían
-- antes de esas respuestas.
-- =============================================================================

insert into parametro (clave, valor, tipo, etiqueta, ayuda) values
  ('cancelacion_clase_dias', '3', 'entero',
   'Antelación mínima para cancelar una clase (días)',
   'Una cancelación con menos días queda registrada como fuera de término y la '
   'imputación se decide a mano.'),

  ('dia_cierre_periodo', '1', 'entero',
   'Día en que se liquida el mes',
   'Es el día en que se generan los cargos del período y salen los estados de cuenta.'),

  ('dia_vencimiento_default', '10', 'entero',
   'Día de vencimiento por omisión',
   'Rige para todo cliente que no tenga un día propio pactado (RN-08).'),

  -- RN-09: se guarda SIN valor a propósito. El haras confirmó que cobra mora y
  -- cómo la calcula, pero no dio el porcentaje. Un valor inventado por omisión
  -- se olvida y queda facturando. Sin valor, la pantalla de cobranza no puede
  -- proponer intereses y lo dice, que es el estado real del negocio.
  ('mora_tasa_mensual', null, 'decimal',
   'Tasa de interés por mora (mensual, en porcentaje)',
   'Sin valor cargado el sistema NO propone intereses. Cargarlo habilita el '
   'cálculo, que igual requiere confirmación de un usuario antes de imputarse.'),

  ('mora_aplicacion', 'asistida', 'texto',
   'Modo de aplicación del interés por mora',
   'En modo asistido el sistema calcula y propone, y una persona confirma. Es la '
   'clase de decisión que un negocio revisa cuando le crece la cartera.'),

  ('dias_aviso_previo_vencimiento', '3', 'entero',
   'Días de anticipación del aviso previo',
   'Con vencimiento el día 10, el aviso previo sale el día 7 (RN-11).'),

  ('cobranza_sabado_habil', 'true', 'booleano',
   'El sábado cuenta como día hábil para la cobranza',
   'Se registran pagos y salen avisos. El domingo no: un aviso que caiga domingo '
   'se emite el lunes a las 9 (RN-10).'),

  ('mensajes_ventana_desde', '9', 'entero',
   'Hora de apertura de la franja de mensajes',
   'Lo que se genere fuera de la franja se encola y sale al abrir la siguiente. '
   'No se pierde ni despierta a nadie (RN-17).'),

  ('mensajes_ventana_hasta', '21', 'entero',
   'Hora de cierre de la franja de mensajes',
   'Ver la ayuda de la hora de apertura (RN-17).');


-- -----------------------------------------------------------------------------
-- Catálogo de servicios, confirmado con el dueño el 30/07/2026 (RN-12 a RN-15).
--
-- El precio se divide POR SERVICIO y no por nivel, así que no hay matriz
-- servicio x nivel. `volteo` figura acá como servicio y no como nivel: estaba
-- duplicado en los dos dominios por un error de relevamiento (RN-13).
-- -----------------------------------------------------------------------------
insert into servicio (nombre, unidad, aplica_a, modalidad) values
  ('Pensión box',         'mensual',   'caballo', null),
  ('Pensión piquete',     'mensual',   'caballo', null),
  ('Clases escuela',      'por_clase', 'alumno',  'grupal'),
  ('Clase personalizada', 'por_clase', 'alumno',  'individual'),
  ('Volteo',              'por_clase', 'alumno',  'grupal'),
  ('Colonia',             'por_evento','alumno',  null);


-- -----------------------------------------------------------------------------
-- Plantillas de mensaje: sólo los códigos, sin cuerpo aprobado.
--
-- El cuerpo definitivo vive en `RIENDA-Diseño/05-plantillas-de-mensajes.md` y
-- tiene que pasar por la aprobación de Meta antes de poder enviarse, así que
-- entran en estado `borrador`: una plantilla existe, tiene texto y aun así no se
-- puede enviar hasta que Meta la apruebe.
-- -----------------------------------------------------------------------------
insert into plantilla_mensaje (codigo, canal, cuerpo, estado_aprobacion, categoria, firmante_origen)
values
  ('estado_cuenta',             'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'responsable_cobranza'),
  ('aviso_previo_vencimiento',  'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'responsable_cobranza'),
  ('recordatorio_pago',         'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'responsable_cobranza'),
  ('pago_recibido',             'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'responsable_cobranza'),
  ('confirmacion_clase',        'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'instructor_clase'),
  ('clase_suspendida',          'whatsapp', '(pendiente de redacción)', 'borrador', 'utility', 'instructor_clase'),
  ('aviso_evento',              'whatsapp', '(pendiente de redacción)', 'borrador', 'marketing', 'quien_envia'),
  ('aviso_institucional',       'whatsapp', '(pendiente de redacción)', 'borrador', 'marketing', 'quien_envia');

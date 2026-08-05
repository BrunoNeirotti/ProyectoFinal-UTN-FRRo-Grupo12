-- =============================================================================
-- RIENDA · 0001 · Extensiones y tipos enumerados
--
-- Los dominios enumerados salen del diccionario de entidades
-- (`RIENDA-Diseño/03-modelo-de-datos.md`). Se declaran como tipos y no como
-- CHECK de texto porque son cerrados y compartidos por varias tablas: un
-- CHECK duplicado en cada tabla es una fuente garantizada de divergencia.
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- restricción de exclusión de la agenda

-- --- Área 0 · Acceso y sistema -----------------------------------------------
create type tipo_documento as enum ('dni', 'cuit', 'cuil', 'pasaporte');
create type rol_usuario    as enum ('administrador', 'instructor', 'peon', 'cliente');
create type tipo_parametro as enum ('entero', 'decimal', 'booleano', 'texto');
create type accion_auditoria as enum ('alta', 'modificacion', 'baja');

-- --- Área 1 · Clientes y contratos -------------------------------------------
create type tipo_cliente    as enum ('persona_fisica', 'persona_juridica');
create type condicion_iva   as enum ('responsable_inscripto', 'monotributo',
                                     'consumidor_final', 'exento');
create type canal_mensaje   as enum ('whatsapp', 'email');
-- RN-13: `volteo` NO está: es un servicio, no un nivel.
create type nivel_alumno    as enum ('inicial', 'nivel_1', 'nivel_2', 'nivel_3');
create type unidad_servicio as enum ('mensual', 'por_clase', 'por_evento');
create type aplica_servicio as enum ('caballo', 'alumno');
-- RN-14: única subdivisión que el negocio aceptó dentro de las clases.
create type modalidad_servicio as enum ('individual', 'grupal');
create type estado_contrato as enum ('vigente', 'suspendido', 'finalizado');

-- --- Área 2 · Bienestar animal -----------------------------------------------
create type tipo_instalacion   as enum ('box', 'piquete', 'pista', 'picadero');
create type sexo_caballo       as enum ('macho', 'macho_castrado', 'hembra');
create type estado_caballo     as enum ('activo', 'en_tratamiento', 'retirado');
create type momento_alimentacion as enum ('manana', 'mediodia', 'tarde');
create type tipo_cuidado       as enum ('alimentacion', 'higiene', 'desparasitacion');
create type tipo_evento_sanitario as enum ('desparasitacion', 'vacunacion', 'herrador',
                                           'veterinario', 'otro');
-- Decisión 1.11: el ciclo sanitario se planifica antes de aplicarse.
create type estado_evento_sanitario as enum ('previsto', 'aplicado', 'omitido');

-- --- Área 3 · Enseñanza -------------------------------------------------------
create type estado_clase       as enum ('programada', 'dictada', 'cancelada');
create type estado_inscripcion as enum ('inscripto', 'cancelado');

-- --- Área 4 · Inventario y compras -------------------------------------------
create type categoria_insumo   as enum ('alimento', 'cama', 'sanidad', 'mantenimiento');
create type tipo_movimiento_stock as enum ('ingreso', 'egreso', 'ajuste');
-- Decisión 1.11: una entrega incompleta es corriente y tiene que poder representarse.
create type estado_orden_compra as enum ('borrador', 'enviada', 'parcialmente_recibida',
                                         'recibida', 'anulada');

-- --- Área 5 · Gerencia y finanzas --------------------------------------------
create type tipo_movimiento_cuenta as enum ('cargo', 'pago', 'ajuste', 'interes_mora');
create type estado_envio    as enum ('pendiente', 'enviado', 'entregado', 'leido', 'fallido');
create type medio_pago      as enum ('mercadopago', 'transferencia', 'efectivo', 'cheque');
create type estado_pago     as enum ('pendiente', 'acreditado', 'rechazado', 'devuelto');
-- RN-02: el tipo de comprobante se deriva del cruce emisor/receptor, no se elige.
create type tipo_comprobante as enum ('factura_a', 'factura_b', 'factura_c',
                                      'nota_credito', 'nota_debito');
-- RN-03: el sistema sólo emite por web service; `en_linea` existe para poder
-- registrar el punto de venta que el haras sigue usando a mano.
create type modo_punto_venta   as enum ('web_service', 'en_linea');
create type estado_comprobante as enum ('pendiente', 'autorizado', 'rechazado');
create type condicion_iva_emisor as enum ('monotributo', 'exento', 'responsable_inscripto');

-- --- Área 6 · Comunicación ----------------------------------------------------
create type categoria_plantilla as enum ('utility', 'marketing');
create type estado_aprobacion   as enum ('borrador', 'en_revision', 'aprobada',
                                         'rechazada', 'pausada');
-- RN-18: los mensajes los firma quien los escribe, incluso los de un trabajo programado.
create type origen_firmante as enum ('responsable_cobranza', 'instructor_clase', 'quien_envia');

-- --- Área 7 · Eventos ---------------------------------------------------------
create type tipo_evento    as enum ('torneo', 'exposicion', 'colonia', 'otro');
create type estado_evento  as enum ('borrador', 'abierto', 'cerrado', 'realizado');
create type estado_inscripcion_evento as enum ('inscripto', 'cancelado', 'participo');

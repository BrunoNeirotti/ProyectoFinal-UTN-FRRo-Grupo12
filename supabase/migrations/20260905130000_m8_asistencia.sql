-- =============================================================================
-- RIENDA · M8 · Asistencia y progreso
--
-- La tabla `asistencia` está desde 0002 y sus políticas desde 0004: acá no hay
-- entidad nueva. Lo que falta son las tres cosas que el módulo necesita que la
-- base garantice, porque son las que no se pueden dejar libradas a la pantalla.
--
-- El principio del módulo es uno solo y conviene tenerlo a la vista: **lo que se
-- factura es lo que se dictó**. La asistencia no es una planilla pedagógica que
-- se pueda cargar de memoria la semana siguiente; es el documento que después
-- justifica un cargo en la cuenta corriente de un cliente. De ahí que la base
-- exija que cada fila tenga a quién imputarse y que la clase que la contiene
-- exista de verdad.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · Quién registró no lo elige quien registra
--
-- `registrado_por` es la firma de la planilla. Hasta ahora salía del router, y
-- un router puede equivocarse o puede llamarse desde otro lado; el valor por
-- omisión lo ata a la sesión, igual que hace la auditoría. Sigue siendo `not
-- null`, así que una inserción sin sesión —que no existe, porque RLS la
-- rechazaría antes— tampoco pasaría.
-- -----------------------------------------------------------------------------
alter table asistencia alter column registrado_por set default usuario_actual();

comment on column asistencia.registrado_por is
  'Quién tomó la asistencia. Por omisión, la sesión que inserta: es la firma de '
  'la planilla y no un dato que el formulario deba poder elegir.';


-- -----------------------------------------------------------------------------
-- 2 · No se registra asistencia de quien no estaba inscripto
--
-- El CUS05 (paso 7) toma asistencia «de cada alumno inscripto», y esa palabra
-- hace todo el trabajo. Una asistencia sin inscripción detrás es una clase que
-- se dictaría sin que nadie se hubiera anotado: nadie evaluó el cupo, nadie
-- miró si había contrato vigente que la respalde (camino 4.b) y, cuando se
-- liquide el período, va a haber un alumno cobrado que en la agenda no figura.
--
-- La inscripción CANCELADA tampoco alcanza. Quien canceló en término no se
-- factura, y dejarlo entrar por la planilla sería la forma silenciosa de
-- cobrarle igual.
--
-- Vale la pena decir qué NO impide esta regla: la inasistencia. Un alumno
-- inscripto que no se presenta se registra con `presente = false` (camino 7.b),
-- porque la falta es un antecedente pedagógico y hay que conservarla. Lo que no
-- puede existir es la fila de alguien que nunca estuvo anotado.
--
-- Y una clase suspendida no genera asistencia de ninguna clase (camino 7.a):
-- queda fuera de la imputación del período, así que una planilla suya sería un
-- respaldo de algo que no ocurrió.
-- -----------------------------------------------------------------------------
create or replace function validar_asistencia_de_inscripto()
returns trigger language plpgsql as $$
declare
  estado_clase estado_clase;
  anotado      boolean;
begin
  select c.estado into estado_clase from clase c where c.id = new.clase_id;

  if estado_clase = 'cancelada' then
    raise exception 'La clase está suspendida: no genera asistencia';
  end if;

  select exists (
    select 1 from inscripcion i
     where i.clase_id = new.clase_id
       and i.alumno_id = new.alumno_id
       and i.estado = 'inscripto'
  ) into anotado;

  if not anotado then
    raise exception 'El alumno no está inscripto en esa clase: primero hay que inscribirlo';
  end if;

  return new;
end $$;

create trigger trg_asistencia_inscripto
  before insert or update on asistencia
  for each row execute function validar_asistencia_de_inscripto();

comment on table asistencia is
  'Lo que efectivamente pasó en la clase, por alumno. Exige inscripción activa '
  'y clase no suspendida (CUS05, pasos 7 y 7.a): es el respaldo de lo que se '
  'factura, no una planilla pedagógica suelta.';


-- -----------------------------------------------------------------------------
-- 3 · Cuánto tiene que caer la asistencia para llamar al cliente
--
-- El «alumno en riesgo» de la pantalla no es un campo del modelo: es una
-- consulta sobre las últimas semanas, y por eso no hay columna que lo guarde.
-- Lo que sí hace falta guardar es el umbral, porque es una decisión del
-- establecimiento y no del programa. El prototipo lo fija en 25 puntos contra
-- el promedio de los tres meses anteriores; queda acá para que el dueño lo mueva
-- cuando vea cuántos avisos le genera, sin tocar código.
--
-- Es lo contrario del caso de `mora_tasa_mensual`, que quedó sin valor a
-- propósito: allá el haras no dio el número y ninguno era defendible; acá el
-- número está relevado y lo que se quiere es poder discutirlo.
-- -----------------------------------------------------------------------------
insert into parametro (clave, valor, tipo, etiqueta, ayuda) values
  ('riesgo_asistencia_puntos', '25', 'entero',
   'Caída de asistencia que marca a un alumno en riesgo (puntos)',
   'Se compara el período contra el promedio de los tres anteriores. Un alumno '
   'que bajó de forma sostenida casi siempre está por darse de baja, y hoy eso '
   'se descubre recién cuando el cliente deja de pagar.')
on conflict (clave) do nothing;

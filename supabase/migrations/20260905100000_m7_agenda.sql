-- =============================================================================
-- RIENDA · M7 · Lo que la agenda de clases destapó en el control de acceso
--
-- No hay tabla ni columna nueva: el esquema de enseñanza (clase, inscripcion,
-- asistencia) y sus dos restricciones de exclusión están desde 0002. Lo que
-- faltaba son dos permisos de LECTURA, y los dos aparecieron por el mismo
-- motivo: hasta M6 todas las pantallas eran del administrador, y el
-- administrador ve todo. M7 es el primer módulo que un instructor opera, así
-- que es el primero que ejerce las políticas contra un rol que no es el dueño.
--
-- El criterio de 0004 no cambia: negación por omisión, y se abre lo mínimo que
-- la pantalla necesita para funcionar, no la tabla entera por comodidad.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1 · El personal tiene que poder ver quién es quién
--
-- `usuario_propio` dejaba que cada uno leyera sólo su propia fila. La agenda
-- nombra al instructor de cada clase, así que con esa política un instructor
-- veía su nombre y el resto de la grilla sin dueño: la consulta no falla, el
-- dato viene vacío, que es justo la clase de comportamiento que 0004 quiere
-- evitar. Lo mismo le va a pasar a M8 y M9 con `registrado_por`.
--
-- Se abre la LECTURA a todo el personal y nada más. La escritura sigue siendo
-- del administrador, y la tabla no guarda nada sensible: identidad, rol,
-- actividad y último acceso. La contraseña vive en `auth.users`, que esta
-- política no toca.
-- -----------------------------------------------------------------------------
drop policy usuario_propio on usuario;

create policy usuario_lectura on usuario for select to authenticated
  using (es_personal() or id = auth.uid());

comment on table usuario is
  'La lectura alcanza a todo el personal porque la agenda, los registros de '
  'cuidado y la asistencia nombran a quien dicta o registra. La escritura es '
  'del administrador (política usuario_admin).';


-- -----------------------------------------------------------------------------
-- 2 · Si un alumno tiene contrato vigente, sin abrir los contratos
--
-- El CUS05 pide dos cosas al inscribir: sugerir a los alumnos con contrato
-- vigente del servicio (paso 4) y advertir cuando el elegido no lo tiene, sin
-- impedir la inscripción (camino 4.b). El instructor no puede leer `contrato`
-- —`contrato_lectura` exige `es_admin()`— y eso es correcto: ahí vive
-- `importe_pactado`, que es información comercial y el sitemap la deja fuera de
-- Enseñanza.
--
-- Abrir la tabla al instructor para responder una pregunta de sí o no sería
-- pagar con precios una respuesta booleana. La función contesta exactamente lo
-- que se pregunta y nada más, y por ser `security definer` lo hace sin que el
-- instructor gane acceso a ninguna fila.
--
-- Un contrato está vigente si su estado lo dice y la fecha cae dentro del
-- período: `fecha_fin` nula significa abierto (esquema 0002).
-- -----------------------------------------------------------------------------
create or replace function tiene_contrato_vigente(p_alumno uuid, p_servicio uuid, p_al date default current_date)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    -- Un cliente no tiene por qué poder averiguar esto de alumnos ajenos.
    when not es_personal() then null
    else exists (
      select 1 from contrato c
       where c.alumno_id = p_alumno
         and c.servicio_id = p_servicio
         and c.estado = 'vigente'
         and c.fecha_inicio <= p_al
         and (c.fecha_fin is null or c.fecha_fin >= p_al)
    )
  end;
$$;

comment on function tiene_contrato_vigente(uuid, uuid, date) is
  'CUS05 pasos 4 y 4.b. Responde la pregunta del instructor sin exponerle '
  'importe_pactado: la advertencia de inscripción sin respaldo contractual no '
  'justifica abrirle la tabla de contratos.';

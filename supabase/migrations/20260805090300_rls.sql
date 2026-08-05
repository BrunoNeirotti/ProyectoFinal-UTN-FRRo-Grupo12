-- =============================================================================
-- RIENDA · 0004 · Control de acceso por rol (Row Level Security)
--
-- El sitemap fija el principio: cada perfil ve sólo lo que le corresponde. El
-- peón NUNCA ve cobranza; el cliente ve sólo lo suyo. Eso se implementa acá y no
-- únicamente en la navegación, porque una pantalla que no se muestra no impide
-- una llamada directa a la API.
--
-- Criterio general: RLS activo en TODAS las tablas y negación por omisión. Una
-- tabla sin política es una tabla inaccesible, así que agregar una entidad nueva
-- falla ruidosamente en lugar de quedar abierta.
--
-- `service_role` de Supabase salta RLS por diseño: es la identidad con la que
-- corren los trabajos programados (M15) y los webhooks. Esa clave no sale nunca
-- del servidor.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Identidad de quien consulta
-- -----------------------------------------------------------------------------
create or replace function rol_actual()
returns rol_usuario language sql stable security definer set search_path = public as $$
  select u.rol from usuario u where u.id = auth.uid() and u.activo;
$$;

create or replace function es_admin()
returns boolean language sql stable as $$
  select rol_actual() = 'administrador';
$$;

create or replace function es_personal()
returns boolean language sql stable as $$
  select rol_actual() in ('administrador', 'instructor', 'peon');
$$;

create or replace function persona_actual()
returns uuid language sql stable security definer set search_path = public as $$
  select u.persona_id from usuario u where u.id = auth.uid() and u.activo;
$$;

-- Un cliente puede figurar como persona física o ser el contacto de una persona
-- jurídica. Las dos vías dan acceso a la misma cuenta.
create or replace function clientes_del_usuario()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from cliente c
   where rol_actual() = 'cliente' and c.persona_id = persona_actual() and c.activo;
$$;


-- -----------------------------------------------------------------------------
-- RLS en todas las tablas, sin excepción
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in
    select c.relname as tabla from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.tabla);
    execute format('alter table public.%I force row level security', t.tabla);
  end loop;
end $$;


-- =============================================================================
-- ÁREA 0 · Acceso y sistema
-- =============================================================================

-- Cada usuario se ve a sí mismo; el administrador ve y administra a todos.
create policy usuario_propio on usuario for select to authenticated
  using (id = auth.uid() or es_admin());
create policy usuario_admin on usuario for all to authenticated
  using (es_admin()) with check (es_admin());

create policy persona_lectura on persona for select to authenticated
  using (
    es_personal()
    or id = persona_actual()
    -- El cliente ve las personas de sus alumnos y sus responsables.
    or exists (select 1 from alumno a
                where a.cliente_id in (select clientes_del_usuario())
                  and (a.persona_id = persona.id or a.responsable_id = persona.id))
  );
create policy persona_escritura on persona for all to authenticated
  using (es_admin()) with check (es_admin());

-- Los parámetros los lee todo el personal (la ventana horaria, el día de
-- vencimiento) y los cambia sólo el dueño.
create policy parametro_lectura on parametro for select to authenticated
  using (es_personal());
create policy parametro_escritura on parametro for all to authenticated
  using (es_admin()) with check (es_admin());

-- La traza se consulta, no se corrige. Las reglas de 0003 ya impiden UPDATE y
-- DELETE; acá se restringe además quién puede leerla.
create policy auditoria_lectura on auditoria for select to authenticated
  using (es_admin());
create policy auditoria_alta on auditoria for insert to authenticated
  with check (true);   -- la escribe el disparador, en nombre de quien opera


-- =============================================================================
-- ÁREA 1 · Clientes y contratos
-- =============================================================================

create policy cliente_lectura on cliente for select to authenticated
  using (es_admin() or id in (select clientes_del_usuario()));
create policy cliente_escritura on cliente for all to authenticated
  using (es_admin()) with check (es_admin());

-- El instructor necesita saber a quién le da clase. El cliente ve a los suyos.
create policy alumno_lectura on alumno for select to authenticated
  using (
    rol_actual() in ('administrador', 'instructor')
    or cliente_id in (select clientes_del_usuario())
  );
create policy alumno_escritura on alumno for all to authenticated
  using (es_admin()) with check (es_admin());

-- El catálogo y los precios los ve todo el mundo autenticado: el cliente tiene
-- que poder entender de dónde sale su cargo.
create policy servicio_lectura on servicio for select to authenticated using (true);
create policy servicio_escritura on servicio for all to authenticated
  using (es_admin()) with check (es_admin());

create policy tarifa_lectura on tarifa for select to authenticated using (true);
create policy tarifa_escritura on tarifa for all to authenticated
  using (es_admin()) with check (es_admin());

create policy contrato_lectura on contrato for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy contrato_escritura on contrato for all to authenticated
  using (es_admin()) with check (es_admin());


-- =============================================================================
-- ÁREA 2 · Bienestar animal
-- =============================================================================

create policy instalacion_lectura on instalacion for select to authenticated
  using (es_personal());
create policy instalacion_escritura on instalacion for all to authenticated
  using (es_admin()) with check (es_admin());

-- El cliente ve sus propios caballos a pupilaje; el personal, todos.
create policy caballo_lectura on caballo for select to authenticated
  using (es_personal() or propietario_id in (select clientes_del_usuario()));
create policy caballo_escritura on caballo for all to authenticated
  using (es_admin()) with check (es_admin());

create policy plan_lectura on plan_alimentario for select to authenticated
  using (es_personal());
create policy plan_escritura on plan_alimentario for all to authenticated
  using (es_admin()) with check (es_admin());

-- El peón registra lo que hace y consulta lo suyo; corregir un registro ajeno
-- es potestad del administrador.
create policy cuidado_lectura on registro_cuidado for select to authenticated
  using (es_personal());
create policy cuidado_alta on registro_cuidado for insert to authenticated
  with check (es_personal() and usuario_id = auth.uid());
create policy cuidado_propio on registro_cuidado for update to authenticated
  using (usuario_id = auth.uid() or es_admin())
  with check (usuario_id = auth.uid() or es_admin());
create policy cuidado_baja on registro_cuidado for delete to authenticated
  using (es_admin());

-- El cliente ve las novedades sanitarias de sus caballos: es lo que el portal
-- promete y no expone nada interno.
create policy sanitario_lectura on evento_sanitario for select to authenticated
  using (
    es_personal()
    or exists (select 1 from caballo c
                where c.id = evento_sanitario.caballo_id
                  and c.propietario_id in (select clientes_del_usuario()))
  );
create policy sanitario_escritura on evento_sanitario for all to authenticated
  using (es_admin()) with check (es_admin());


-- =============================================================================
-- ÁREA 3 · Enseñanza
-- =============================================================================

create policy clase_lectura on clase for select to authenticated
  using (
    es_personal()
    or exists (select 1 from inscripcion i join alumno a on a.id = i.alumno_id
                where i.clase_id = clase.id
                  and a.cliente_id in (select clientes_del_usuario()))
  );
create policy clase_escritura on clase for all to authenticated
  using (rol_actual() in ('administrador', 'instructor'))
  with check (rol_actual() in ('administrador', 'instructor'));

create policy inscripcion_lectura on inscripcion for select to authenticated
  using (
    es_personal()
    or exists (select 1 from alumno a where a.id = inscripcion.alumno_id
                  and a.cliente_id in (select clientes_del_usuario()))
  );
create policy inscripcion_escritura on inscripcion for all to authenticated
  using (rol_actual() in ('administrador', 'instructor'))
  with check (rol_actual() in ('administrador', 'instructor'));
-- El portal permite inscribir y cancelar a los propios alumnos (M13).
create policy inscripcion_del_cliente on inscripcion for insert to authenticated
  with check (exists (select 1 from alumno a where a.id = inscripcion.alumno_id
                        and a.cliente_id in (select clientes_del_usuario())));

create policy asistencia_lectura on asistencia for select to authenticated
  using (
    es_personal()
    or exists (select 1 from alumno a where a.id = asistencia.alumno_id
                  and a.cliente_id in (select clientes_del_usuario()))
  );
create policy asistencia_escritura on asistencia for all to authenticated
  using (rol_actual() in ('administrador', 'instructor'))
  with check (rol_actual() in ('administrador', 'instructor'));


-- =============================================================================
-- ÁREA 4 · Inventario y compras
-- =============================================================================

create policy insumo_lectura on insumo for select to authenticated using (es_personal());
create policy insumo_escritura on insumo for all to authenticated
  using (es_admin()) with check (es_admin());

-- El consumo lo imputa quien hace la tarea; las compras las maneja el dueño.
create policy stock_lectura on movimiento_stock for select to authenticated
  using (es_personal());
create policy stock_alta on movimiento_stock for insert to authenticated
  with check (es_personal());
create policy stock_correccion on movimiento_stock for update to authenticated
  using (es_admin()) with check (es_admin());
create policy stock_baja on movimiento_stock for delete to authenticated
  using (es_admin());

create policy proveedor_admin on proveedor for all to authenticated
  using (es_admin()) with check (es_admin());
create policy orden_admin on orden_compra for all to authenticated
  using (es_admin()) with check (es_admin());
create policy detalle_admin on detalle_orden_compra for all to authenticated
  using (es_admin()) with check (es_admin());


-- =============================================================================
-- ÁREA 5 · Gerencia y finanzas
--
-- Es el área que define el principio del sitemap: el peón y el instructor NO
-- aparecen en ninguna de estas políticas. Sin política, sin acceso.
-- =============================================================================

create policy cuenta_lectura on cuenta_corriente for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy cuenta_escritura on cuenta_corriente for all to authenticated
  using (es_admin()) with check (es_admin());

create policy movimiento_lectura on movimiento_cuenta for select to authenticated
  using (
    es_admin()
    or exists (select 1 from cuenta_corriente c
                where c.id = movimiento_cuenta.cuenta_corriente_id
                  and c.cliente_id in (select clientes_del_usuario()))
  );
create policy movimiento_escritura on movimiento_cuenta for all to authenticated
  using (es_admin()) with check (es_admin());

create policy estado_cuenta_lectura on estado_cuenta for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy estado_cuenta_escritura on estado_cuenta for all to authenticated
  using (es_admin()) with check (es_admin());

create policy pago_lectura on pago for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy pago_escritura on pago for all to authenticated
  using (es_admin()) with check (es_admin());

create policy comprobante_lectura on comprobante for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy comprobante_escritura on comprobante for all to authenticated
  using (es_admin()) with check (es_admin());

create policy identidad_lectura on identidad_fiscal for select to authenticated
  using (es_admin());
create policy identidad_escritura on identidad_fiscal for all to authenticated
  using (es_admin()) with check (es_admin());

create policy punto_venta_lectura on punto_venta for select to authenticated
  using (es_admin());
create policy punto_venta_escritura on punto_venta for all to authenticated
  using (es_admin()) with check (es_admin());


-- =============================================================================
-- ÁREA 6 · Comunicación
-- =============================================================================

create policy plantilla_lectura on plantilla_mensaje for select to authenticated
  using (es_personal());
create policy plantilla_escritura on plantilla_mensaje for all to authenticated
  using (es_admin()) with check (es_admin());

-- El cliente puede ver qué se le mandó: es la trazabilidad de «se le avisó».
create policy mensaje_lectura on mensaje for select to authenticated
  using (es_admin() or cliente_id in (select clientes_del_usuario()));
create policy mensaje_escritura on mensaje for all to authenticated
  using (es_admin()) with check (es_admin());


-- =============================================================================
-- ÁREA 7 · Eventos
-- =============================================================================

create policy evento_lectura on evento for select to authenticated
  using (es_personal() or estado in ('abierto', 'cerrado', 'realizado'));
create policy evento_escritura on evento for all to authenticated
  using (es_admin()) with check (es_admin());

create policy inscripcion_evento_lectura on inscripcion_evento for select to authenticated
  using (es_personal() or cliente_id in (select clientes_del_usuario()));
create policy inscripcion_evento_escritura on inscripcion_evento for all to authenticated
  using (es_admin()) with check (es_admin());
create policy inscripcion_evento_del_cliente on inscripcion_evento for insert to authenticated
  with check (cliente_id in (select clientes_del_usuario()));


-- =============================================================================
-- Dato sensible por COLUMNA, que RLS no cubre
--
-- `alumno.observaciones_medicas` es dato de salud de un menor (Ley 25.326). RLS
-- filtra filas, no columnas, así que el instructor accede a los alumnos por esta
-- vista, que simplemente no tiene la columna. Es la única forma de que la
-- restricción viva en la base y no en la confianza de que cada consulta se
-- acuerde de no pedirla.
-- =============================================================================
create view alumno_sin_datos_medicos
  with (security_invoker = true) as
  select id, persona_id, cliente_id, responsable_id, consentimiento_tutor_en,
         nivel, activo, creado_en, actualizado_en
    from alumno;

comment on view alumno_sin_datos_medicos is
  'Vista que el perfil de enseñanza usa en lugar de `alumno`. security_invoker '
  'hace que las políticas RLS de la tabla sigan aplicando sobre quien consulta.';

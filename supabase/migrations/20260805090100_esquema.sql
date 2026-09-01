-- =============================================================================
-- RIENDA · 0002 · Esquema
--
-- Las 33 entidades del diccionario (`RIENDA-Diseño/03-modelo-de-datos.md`).
-- Convención del modelo: nombres en snake_case y singular, `id` uuid como clave
-- primaria y `creado_en` / `actualizado_en` en TODAS las tablas.
--
-- Lo que se hace acá y no en la aplicación, a propósito: las reglas que, si se
-- rompen, corrompen datos. Un contrato huérfano, dos clases en la misma pista a
-- la misma hora o dos estados de cuenta del mismo mes no son errores de
-- pantalla, y una validación que vive sólo en el cliente se saltea con una
-- llamada directa a la API.
-- =============================================================================

-- Marca de tiempo de modificación, común a todas las tablas.
create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- Se aplica al final, en bloque, sobre todas las tablas que tengan la columna.
create or replace function instalar_tocar_actualizado_en()
returns void language plpgsql as $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'actualizado_en'
  loop
    execute format(
      'drop trigger if exists trg_actualizado_en on public.%I;
       create trigger trg_actualizado_en before update on public.%I
       for each row execute function tocar_actualizado_en()', t.table_name, t.table_name);
  end loop;
end $$;


-- =============================================================================
-- ÁREA 0 · Acceso y sistema (M1)
-- =============================================================================

create table persona (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  apellido         text not null,
  tipo_documento   tipo_documento not null,
  numero_documento text not null,
  fecha_nacimiento date,
  telefono         text,          -- E.164; es la llave para WhatsApp (M5)
  email            text,
  domicilio        text,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint persona_documento_unico unique (tipo_documento, numero_documento),
  constraint persona_telefono_e164 check (telefono is null or telefono ~ '^\+[1-9][0-9]{7,14}$')
);
comment on column persona.activo is
  'Baja lógica: nunca se borra una persona con historial.';

-- El id coincide con el de Supabase Auth. No toda persona tiene usuario: un
-- alumno menor de edad, por ejemplo, no.
create table usuario (
  id               uuid primary key references auth.users(id) on delete restrict,
  persona_id       uuid not null references persona(id) on delete restrict,
  rol              rol_usuario not null,
  ultimo_acceso_en timestamptz,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint usuario_persona_unica unique (persona_id)
);

-- Reglas del establecimiento que el dueño cambia sin tocar código. NO es un
-- almacén genérico: cada clave está declarada con su etiqueta y su ayuda.
create table parametro (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null unique,
  valor           text,            -- nullable a propósito: ver `mora_tasa_mensual`
  tipo            tipo_parametro not null,
  etiqueta        text not null,
  ayuda           text not null,
  actualizado_por uuid references usuario(id),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
comment on column parametro.valor is
  'Nullable a propósito. `mora_tasa_mensual` queda SIN VALOR hasta que el dueño '
  'lo defina: sin tasa el sistema no propone interés, que es el estado real del '
  'negocio. Un valor inventado por omisión se olvida y queda facturando (RN-09).';

create table auditoria (
  id            bigserial primary key,
  usuario_id    uuid references usuario(id),  -- nullable: procesos automáticos
  entidad       text not null,
  entidad_id    uuid,
  accion        accion_auditoria not null,
  datos_previos jsonb,
  ocurrido_en   timestamptz not null default now()
);
create index auditoria_entidad_idx on auditoria (entidad, entidad_id, ocurrido_en desc);
create index auditoria_usuario_idx on auditoria (usuario_id, ocurrido_en desc);


-- =============================================================================
-- ÁREA 1 · Clientes y contratos (M2, M3)
-- =============================================================================

create table cliente (
  id                       uuid primary key default gen_random_uuid(),
  tipo                     tipo_cliente not null,
  persona_id               uuid references persona(id) on delete restrict,
  razon_social             text,
  requiere_factura         boolean not null default false,  -- RN-05: sólo ~30 %
  cuit                     text,
  condicion_iva            condicion_iva,
  canal_preferido          canal_mensaje not null default 'whatsapp',
  dia_vencimiento          smallint,   -- vacío = rige el parámetro global (RN-08)
  consentimiento_en        timestamptz,
  consentimiento_medio     text,
  consentimiento_revocado_en timestamptz,
  activo                   boolean not null default true,
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now(),

  constraint cliente_identidad check (
    (tipo = 'persona_fisica'  and persona_id is not null) or
    (tipo = 'persona_juridica' and razon_social is not null)
  ),
  -- RN-06: obligatoriedad CONDICIONADA. Se valida en la ficha del cliente, con
  -- calma, y no en el momento de emitir, cuando el operador espera el CAE.
  constraint cliente_datos_fiscales check (
    not requiere_factura or (cuit is not null and condicion_iva is not null)
  ),
  constraint cliente_dia_vencimiento check (
    dia_vencimiento is null or dia_vencimiento between 1 and 28
  )
);

create table alumno (
  id                      uuid primary key default gen_random_uuid(),
  persona_id              uuid not null references persona(id) on delete restrict,
  cliente_id              uuid not null references cliente(id) on delete restrict,
  responsable_id          uuid references persona(id) on delete restrict,
  consentimiento_tutor_en timestamptz,
  nivel                   nivel_alumno,   -- RN-15: descriptivo, NO tarifario
  observaciones_medicas   text,           -- dato sensible: restringido por rol
  activo                  boolean not null default true,
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),
  constraint alumno_persona_unica unique (persona_id)
);
comment on column alumno.observaciones_medicas is
  'Dato sensible (Ley 25.326). El acceso se restringe por rol en las políticas RLS.';

-- La obligatoriedad del responsable depende de la edad, que vive en `persona`.
-- Un CHECK no puede mirar otra tabla, así que va como disparador.
create or replace function validar_responsable_de_menor()
returns trigger language plpgsql as $$
declare nacimiento date;
begin
  select p.fecha_nacimiento into nacimiento from persona p where p.id = new.persona_id;
  if nacimiento is not null and age(nacimiento) < interval '18 years' then
    if new.responsable_id is null or new.consentimiento_tutor_en is null then
      raise exception
        'El alumno es menor de edad: exige responsable y consentimiento del tutor (Ley 25.326)';
    end if;
  end if;
  return new;
end $$;
create trigger trg_alumno_responsable
  before insert or update on alumno
  for each row execute function validar_responsable_de_menor();

create table servicio (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  unidad         unidad_servicio not null,
  aplica_a       aplica_servicio not null,
  modalidad      modalidad_servicio,   -- sólo servicios de clase (RN-14)
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Decisión 1.4: los precios se versionan, no se pisan. El precio aplicable a una
-- fecha es el de la tarifa vigente más reciente a esa fecha.
create table tarifa (
  id             uuid primary key default gen_random_uuid(),
  servicio_id    uuid not null references servicio(id) on delete restrict,
  importe        numeric(12,2) not null check (importe >= 0),
  vigente_desde  date not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint tarifa_unica_por_fecha unique (servicio_id, vigente_desde)
);

create table contrato (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references cliente(id) on delete restrict,
  servicio_id     uuid not null references servicio(id) on delete restrict,
  caballo_id      uuid,   -- FK declarada más abajo: `caballo` todavía no existe
  alumno_id       uuid references alumno(id) on delete restrict,
  fecha_inicio    date not null,
  fecha_fin       date,   -- nullable = vigente
  importe_pactado numeric(12,2) check (importe_pactado is null or importe_pactado >= 0),
  estado          estado_contrato not null default 'vigente',
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),

  -- La regla que evita contratos huérfanos: exactamente uno de los dos.
  constraint contrato_objeto_unico check (
    (caballo_id is not null) <> (alumno_id is not null)
  ),
  constraint contrato_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);


-- =============================================================================
-- ÁREA 2 · Bienestar animal (M9, M2, M14)
-- =============================================================================

-- Boxes y pistas comparten tabla a propósito: los dos son recursos escasos que
-- se asignan y sobre los que hay que detectar conflictos.
create table instalacion (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  tipo           tipo_instalacion not null,
  capacidad      smallint not null default 1 check (capacidad > 0),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table caballo (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  propietario_id   uuid references cliente(id) on delete restrict,  -- null = del haras
  instalacion_id   uuid references instalacion(id) on delete restrict,
  raza             text,
  sexo             sexo_caballo,
  pelaje           text,
  fecha_nacimiento date,          -- la edad se deriva, no se guarda
  peso_kg          numeric(5,1) check (peso_kg is null or peso_kg > 0),
  fecha_ingreso    date,
  estado           estado_caballo not null default 'activo',
  foto_url         text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);

alter table contrato
  add constraint contrato_caballo_fk
  foreign key (caballo_id) references caballo(id) on delete restrict;

create table plan_alimentario (
  id             uuid primary key default gen_random_uuid(),
  caballo_id     uuid not null references caballo(id) on delete cascade,
  momento        momento_alimentacion not null,
  descripcion    text not null,
  cantidad_kg    numeric(5,2) check (cantidad_kg is null or cantidad_kg > 0),
  vigente_desde  date not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint plan_unico_por_momento unique (caballo_id, momento, vigente_desde)
);

-- Decisión 1.6: nace con identidad propia para poder funcionar sin conexión. El
-- id lo genera EL CELULAR, no el servidor: si el envío se reintenta, la segunda
-- inserción choca con la clave primaria y no duplica.
create table registro_cuidado (
  id              uuid primary key,        -- SIN default: lo asigna el dispositivo
  caballo_id      uuid not null references caballo(id) on delete restrict,
  instalacion_id  uuid references instalacion(id) on delete restrict,
  tipo            tipo_cuidado not null,
  usuario_id      uuid not null references usuario(id),
  ocurrido_en     timestamptz not null,    -- cuándo pasó, según el peón
  registrado_en   timestamptz not null,    -- cuándo se cargó en el dispositivo
  sincronizado_en timestamptz,             -- null = todavía en cola
  observaciones   text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index registro_cuidado_caballo_idx on registro_cuidado (caballo_id, ocurrido_en desc);
create index registro_cuidado_pendientes_idx on registro_cuidado (usuario_id)
  where sincronizado_en is null;

create table evento_sanitario (
  id                  uuid primary key default gen_random_uuid(),
  caballo_id          uuid not null references caballo(id) on delete restrict,
  tipo                tipo_evento_sanitario not null,
  estado              estado_evento_sanitario not null default 'aplicado',
  fecha               date not null,
  producto            text,
  dosis               text,
  profesional         text,
  proxima_fecha       date,     -- dispara la alerta del tablero
  observaciones       text,
  registro_cuidado_id uuid references registro_cuidado(id) on delete set null,
  costo               numeric(12,2) check (costo is null or costo >= 0),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index evento_sanitario_caballo_idx on evento_sanitario (caballo_id, fecha desc);
create index evento_sanitario_proxima_idx on evento_sanitario (proxima_fecha)
  where proxima_fecha is not null;
comment on column evento_sanitario.estado is
  'Decisión 1.11: el ciclo se planifica antes de aplicarse. Sin estado, un ciclo '
  'programado y uno ya aplicado eran indistinguibles.';


-- =============================================================================
-- ÁREA 3 · Enseñanza (M7, M8)
-- =============================================================================

create table clase (
  id                uuid primary key default gen_random_uuid(),
  servicio_id       uuid not null references servicio(id) on delete restrict,
  instructor_id     uuid not null references usuario(id) on delete restrict,
  instalacion_id    uuid not null references instalacion(id) on delete restrict,
  inicia_en         timestamptz not null,
  duracion_min      smallint not null check (duracion_min > 0),
  cupo              smallint check (cupo is null or cupo > 0),
  nivel             nivel_alumno,   -- sugiere a quién inscribir, no restringe
  estado            estado_clase not null default 'programada',
  motivo_suspension text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),

  -- Rango que la restricción de exclusión compara. No puede ser una columna
  -- generada: `timestamptz + interval` depende de la zona horaria de la sesión
  -- y Postgres no lo admite como inmutable (lo rechazó al aplicar la migración
  -- contra la base real; el analizador sintáctico no lo detecta). Lo mantiene el
  -- disparador de abajo y nadie lo escribe a mano.
  transcurre        tstzrange not null,

  constraint clase_suspension_con_motivo check (
    estado <> 'cancelada' or motivo_suspension is not null
  )
);

create or replace function calcular_transcurre_clase()
returns trigger language plpgsql as $$
begin
  new.transcurre := tstzrange(
    new.inicia_en,
    new.inicia_en + make_interval(mins => new.duracion_min),
    '[)'
  );
  return new;
end $$;

create trigger trg_transcurre_clase
  before insert or update of inicia_en, duracion_min on clase
  for each row execute function calcular_transcurre_clase();

-- El conflicto que la agenda marca en rojo no se detecta sólo al dibujar: la
-- base impide crearlo. Las clases canceladas no ocupan la instalación.
alter table clase add constraint clase_sin_solapar_instalacion
  exclude using gist (
    instalacion_id with =,
    transcurre with &&
  ) where (estado <> 'cancelada');

-- Un instructor tampoco puede dictar dos clases a la vez.
alter table clase add constraint clase_sin_solapar_instructor
  exclude using gist (
    instructor_id with =,
    transcurre with &&
  ) where (estado <> 'cancelada');

create table inscripcion (
  id            uuid primary key default gen_random_uuid(),
  clase_id      uuid not null references clase(id) on delete cascade,
  alumno_id     uuid not null references alumno(id) on delete restrict,
  caballo_id    uuid references caballo(id) on delete set null,  -- el PREVISTO (1.11)
  estado        estado_inscripcion not null default 'inscripto',
  inscripto_en  timestamptz not null default now(),
  cancelado_en  timestamptz,   -- con qué antelación se canceló (1.11)
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint inscripcion_unica unique (clase_id, alumno_id),
  constraint inscripcion_cancelada_con_fecha check (
    (estado = 'cancelado') = (cancelado_en is not null)
  )
);

-- Se separa de `inscripcion` porque inscribirse no es asistir, y lo que se
-- factura es lo que se dictó.
create table asistencia (
  id             uuid primary key default gen_random_uuid(),
  clase_id       uuid not null references clase(id) on delete cascade,
  alumno_id      uuid not null references alumno(id) on delete restrict,
  presente       boolean not null,
  caballo_id     uuid references caballo(id) on delete set null,  -- con cuál montó
  observaciones  text,
  registrado_por uuid not null references usuario(id),
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint asistencia_unica unique (clase_id, alumno_id)
);


-- =============================================================================
-- ÁREA 4 · Inventario y compras (M10)
-- =============================================================================

create table insumo (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  categoria      categoria_insumo not null,
  unidad         text not null,
  stock_actual   numeric(10,2) not null default 0,   -- derivado; ver 0003
  stock_minimo   numeric(10,2) not null default 0 check (stock_minimo >= 0),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on column insumo.stock_actual is
  'Derivado de `movimiento_stock` (mismo criterio que 1.5). Ningún proceso lo '
  'escribe directamente: lo mantiene el disparador de 0003.';

create table proveedor (
  id             uuid primary key default gen_random_uuid(),
  razon_social   text not null,
  cuit           text,
  telefono       text,
  email          text,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table orden_compra (
  id             uuid primary key default gen_random_uuid(),
  proveedor_id   uuid not null references proveedor(id) on delete restrict,
  fecha_emision  date not null default current_date,
  estado         estado_orden_compra not null default 'borrador',
  total          numeric(12,2) not null default 0,   -- derivado del detalle
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table detalle_orden_compra (
  id               uuid primary key default gen_random_uuid(),
  orden_compra_id  uuid not null references orden_compra(id) on delete cascade,
  insumo_id        uuid not null references insumo(id) on delete restrict,
  cantidad         numeric(10,2) not null check (cantidad > 0),
  cantidad_recibida numeric(10,2) check (cantidad_recibida is null or cantidad_recibida >= 0),
  precio_unitario  numeric(12,2) not null check (precio_unitario >= 0),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  constraint detalle_insumo_unico unique (orden_compra_id, insumo_id)
);
comment on column detalle_orden_compra.precio_unitario is
  'Congelado al momento de la compra: no se lee de ningún catálogo vigente.';

create table movimiento_stock (
  id                  uuid primary key default gen_random_uuid(),
  insumo_id           uuid not null references insumo(id) on delete restrict,
  tipo                tipo_movimiento_stock not null,
  cantidad            numeric(10,2) not null check (cantidad > 0),  -- el signo lo da `tipo`
  motivo              text,
  registro_cuidado_id uuid references registro_cuidado(id) on delete set null,
  orden_compra_id     uuid references orden_compra(id) on delete set null,
  ocurrido_en         timestamptz not null default now(),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index movimiento_stock_insumo_idx on movimiento_stock (insumo_id, ocurrido_en desc);


-- =============================================================================
-- ÁREA 5 · Gerencia y finanzas (M3, M4, M6)
-- =============================================================================

create table cuenta_corriente (
  id                   uuid primary key default gen_random_uuid(),
  cliente_id           uuid not null unique references cliente(id) on delete restrict,
  saldo                numeric(12,2) not null default 0,   -- derivado; ver 0003
  saldo_actualizado_en timestamptz,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
comment on column cuenta_corriente.saldo is
  'Decisión 1.5: copia mantenida por la aplicación para no recalcular en cada '
  'consulta. NINGÚN proceso lo escribe directamente; sólo lo recalcula el '
  'disparador al insertar un movimiento. Así el saldo siempre se puede reconstruir.';

create table identidad_fiscal (
  id                 uuid primary key default gen_random_uuid(),
  razon_social       text not null,
  cuit               text not null,
  condicion_iva      condicion_iva_emisor not null,   -- determina el tipo (RN-02)
  vigente_desde      date not null unique,
  domicilio_fiscal   text not null,
  ingresos_brutos    text,
  inicio_actividades date not null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now()
);
comment on table identidad_fiscal is
  'Decisión 1.10: se versiona como las tarifas. El haras pasa de monotributo a '
  'asociación civil (RN-01), y la transición es UNA FILA NUEVA, no una migración.';

create table punto_venta (
  id             uuid primary key default gen_random_uuid(),
  numero         smallint not null unique check (numero > 0),
  descripcion    text not null,
  modo           modo_punto_venta not null,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
comment on table punto_venta is
  'RN-03: ARCA prohíbe compartir un punto de venta entre el facturador manual y '
  'un servicio web, y la numeración es correlativa POR punto de venta.';

create table estado_cuenta (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references cliente(id) on delete restrict,
  periodo         date not null,     -- primer día del mes liquidado
  emitido_en      timestamptz not null default now(),
  total           numeric(12,2) not null,       -- congelado a la emisión
  saldo_anterior  numeric(12,2) not null default 0,
  pdf_url         text,
  link_pago       text,
  estado_envio    estado_envio not null default 'pendiente',
  enviado_en      timestamptz,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  -- Reemitir el estado de cuenta de mayo no puede generar dos.
  constraint estado_cuenta_unico unique (cliente_id, periodo)
);

create table comprobante (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references cliente(id) on delete restrict,
  estado_cuenta_id       uuid references estado_cuenta(id) on delete set null,
  tipo                   tipo_comprobante not null,
  punto_venta_id         uuid not null references punto_venta(id) on delete restrict,
  numero                 integer not null check (numero > 0),
  fecha_emision          date not null default current_date,
  cae                    text,
  cae_vencimiento        date,
  estado                 estado_comprobante not null default 'pendiente',
  rechazo_motivo         text,
  -- RN-04: COPIADOS al emitir. Un documento legal emitido es inmutable, y para
  -- serlo tiene que ser autosuficiente.
  emisor_razon_social    text not null,
  emisor_cuit            text not null,
  emisor_condicion_iva   condicion_iva_emisor not null,
  receptor_condicion_iva condicion_iva not null,   -- lo exige la RG 5.616/2024
  neto                   numeric(12,2) not null,
  iva                    numeric(12,2) not null default 0,
  total                  numeric(12,2) not null,
  comprobante_asociado_id uuid references comprobante(id) on delete restrict,
  pdf_url                text,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  constraint comprobante_numero_unico unique (punto_venta_id, numero),
  constraint comprobante_cae_si_autorizado check (
    estado <> 'autorizado' or (cae is not null and cae_vencimiento is not null)
  ),
  constraint comprobante_motivo_si_rechazado check (
    estado <> 'rechazado' or rechazo_motivo is not null
  ),
  -- RN-07: en ARCA un comprobante no se anula, se contrarresta.
  constraint comprobante_asociado_si_nota check (
    tipo not in ('nota_credito', 'nota_debito') or comprobante_asociado_id is not null
  )
);

create table pago (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references cliente(id) on delete restrict,
  importe             numeric(12,2) not null check (importe > 0),
  medio               medio_pago not null,
  referencia_externa  text unique,   -- evita duplicar por webhook repetido
  estado              estado_pago not null default 'pendiente',
  acreditado_en       timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);

-- El libro mayor del cliente. Fuente de verdad de la cobranza (RN-05): el cargo
-- existe, se informa y se reclama exista o no comprobante.
create table movimiento_cuenta (
  id                  uuid primary key default gen_random_uuid(),
  cuenta_corriente_id uuid not null references cuenta_corriente(id) on delete restrict,
  tipo                tipo_movimiento_cuenta not null,
  concepto            text not null,
  contrato_id         uuid references contrato(id) on delete set null,
  importe             numeric(12,2) not null,   -- positivo en cargos, negativo en pagos
  periodo             date,
  vence_en            date,
  comprobante_id      uuid references comprobante(id) on delete set null,
  pago_id             uuid references pago(id) on delete set null,
  -- RN-09: el movimiento guarda su propia derivación. Si un estado de cuenta
  -- viejo recalculara el interés con la tasa de hoy, mostraría un número que el
  -- cliente nunca vio.
  mora_base           numeric(12,2),
  mora_tasa_aplicada  numeric(5,2),
  mora_dias           smallint,
  aplicado_por        uuid references usuario(id),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint movimiento_signo check (
    (tipo = 'cargo'        and importe > 0) or
    (tipo = 'interes_mora' and importe > 0) or
    (tipo = 'pago'         and importe < 0) or
    (tipo = 'ajuste')
  ),
  -- Un interés sin `aplicado_por` no existe como deuda: está vacío mientras es
  -- una propuesta en pantalla y se llena al confirmarlo (RN-09).
  constraint movimiento_mora_completa check (
    tipo <> 'interes_mora' or (
      mora_base is not null and mora_tasa_aplicada is not null
      and mora_dias is not null and aplicado_por is not null
    )
  ),
  constraint movimiento_mora_solo_en_mora check (
    tipo = 'interes_mora' or (
      mora_base is null and mora_tasa_aplicada is null and mora_dias is null
    )
  )
);
create index movimiento_cuenta_cuenta_idx
  on movimiento_cuenta (cuenta_corriente_id, periodo, creado_en);


-- =============================================================================
-- ÁREA 6 · Comunicación (M5, M15)
-- =============================================================================

create table plantilla_mensaje (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null,
  canal             canal_mensaje not null,
  asunto            text,               -- sólo email
  cuerpo            text not null,
  activa            boolean not null default true,
  nombre_meta       text,               -- con el que está registrada en Meta
  categoria         categoria_plantilla,
  idioma            text default 'es_AR',
  estado_aprobacion estado_aprobacion not null default 'borrador',
  revisada_en       date,
  motivo_rechazo    text,
  firmante_origen   origen_firmante not null default 'quien_envia',   -- RN-18
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint plantilla_unica unique (codigo, canal)
);

create table mensaje (
  id               uuid primary key default gen_random_uuid(),
  plantilla_id     uuid not null references plantilla_mensaje(id) on delete restrict,
  cliente_id       uuid not null references cliente(id) on delete restrict,
  canal            canal_mensaje not null,
  destino          text not null,
  estado_cuenta_id uuid references estado_cuenta(id) on delete set null,
  estado           estado_envio not null default 'pendiente',
  error            text,
  enviado_en       timestamptz,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now()
);
create index mensaje_cliente_idx on mensaje (cliente_id, creado_en desc);


-- =============================================================================
-- ÁREA 7 · Eventos (M15)
-- =============================================================================

create table evento (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  tipo                  tipo_evento not null,
  inicia_en             timestamptz not null,
  finaliza_en           timestamptz,
  cierra_inscripcion_en date,
  cupo                  smallint check (cupo is null or cupo > 0),
  servicio_id           uuid references servicio(id) on delete set null,
  estado                estado_evento not null default 'borrador',
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  constraint evento_fechas check (finaliza_en is null or finaliza_en >= inicia_en)
);

create table inscripcion_evento (
  id             uuid primary key default gen_random_uuid(),
  evento_id      uuid not null references evento(id) on delete cascade,
  alumno_id      uuid references alumno(id) on delete restrict,
  caballo_id     uuid references caballo(id) on delete restrict,
  cliente_id     uuid not null references cliente(id) on delete restrict,
  estado         estado_inscripcion_evento not null default 'inscripto',
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint inscripcion_evento_objeto check (
    alumno_id is not null or caballo_id is not null
  )
);


-- =============================================================================
-- Disparadores de `actualizado_en` sobre todo lo anterior
-- =============================================================================
select instalar_tocar_actualizado_en();

-- =============================================================================
-- RIENDA · M10 · La orden de compra necesita un número que se pueda decir
--
-- `orden_compra` se identifica por UUID y nada más. Alcanza para el sistema y no
-- alcanza para el negocio: una orden es un documento que sale del haras y que
-- después se conversa por teléfono con el proveedor -«te mando la 2026-018»,
-- «de la 17 falta la viruta»-. Un UUID no se dicta ni se busca en un remito.
--
-- El prototipo ya lo había resuelto y el modelo no lo había registrado: la
-- pantalla de Inventario lista «OC 2026-018 · 08/05» y «OC 2026-019 · borrador».
-- Ese segundo rótulo es el que decide dónde se asigna el número: el borrador ya
-- lo tiene, así que se numera al crear la orden y no al enviarla.
--
-- Numerar al crear tiene un costo conocido -un borrador descartado quema un
-- número- y se acepta a cambio de que la orden se llame igual toda su vida. La
-- alternativa, numerar al enviar, obliga a que la misma orden se llame de dos
-- maneras según el día, que es exactamente lo que un número de documento existe
-- para evitar.
--
-- La serie es anual y arranca en 1 cada enero, como la usa el haras. `anio` sale
-- de `fecha_emision` y no del reloj: una orden cargada el 2 de enero con fecha
-- del 30 de diciembre pertenece a la serie del año que se cerró.
-- =============================================================================

alter table orden_compra
  add column anio   smallint,
  add column numero integer;

-- Numeración de lo que ya exista, por si la base no está vacía: en orden de
-- emisión, que es el orden en que las órdenes habrían salido.
with numeradas as (
  select id,
         extract(year from fecha_emision)::smallint as a,
         row_number() over (
           partition by extract(year from fecha_emision) order by fecha_emision, creado_en, id
         ) as n
    from orden_compra
)
update orden_compra o
   set anio = numeradas.a, numero = numeradas.n
  from numeradas
 where o.id = numeradas.id;

alter table orden_compra
  alter column anio   set not null,
  alter column numero set not null,
  add constraint orden_compra_numero_positivo check (numero > 0),
  add constraint orden_compra_numero_unico unique (anio, numero);

/**
 * Asigna año y número antes de insertar.
 *
 * El `max()+1` se serializa con un lock de transacción por año en vez de
 * confiar en que dos altas simultáneas no se crucen. El haras emite unas pocas
 * órdenes por mes y la colisión sería rarísima, pero «rarísima» acá significa
 * que aparecería una sola vez, en producción, y como un error de clave
 * duplicada que nadie sabría reproducir. El lock se libera solo al terminar la
 * transacción y no bloquea nada más que a otra alta del mismo año.
 */
create or replace function numerar_orden_compra()
returns trigger language plpgsql as $$
begin
  new.anio := extract(year from new.fecha_emision)::smallint;

  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext('orden_compra'), new.anio::int);
    select coalesce(max(numero), 0) + 1 into new.numero
      from orden_compra where anio = new.anio;
  end if;

  return new;
end $$;

create trigger trg_numerar_orden
  before insert on orden_compra
  for each row execute function numerar_orden_compra();

comment on column orden_compra.numero is
  'Correlativo dentro del año, asignado al crear la orden. Lo que se le dice al '
  'proveedor: «OC 2026-018». La serie reinicia cada enero.';

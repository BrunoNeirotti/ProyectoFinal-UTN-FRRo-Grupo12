-- =============================================================================
-- RIENDA · M6 · Cache del Ticket de Acceso de WSAA (ARCA)
--
-- No es una entidad del modelo de datos: es infraestructura técnica (el
-- equivalente a una tabla de sesiones), así que no cuenta contra el DER de 33
-- entidades ni contra el diccionario de datos. El Ticket de Acceso dura 12
-- horas y ARCA rechaza pedir uno nuevo dentro de esa ventana
-- ("coe.alreadyAuthenticated"), así que hay que reutilizarlo entre invocaciones
-- de una función serverless que arrancan en frío cada vez.
-- =============================================================================

create table arca_ticket (
  servicio       text primary key,
  credenciales   jsonb not null,
  actualizado_en timestamptz not null default now()
);

alter table arca_ticket enable row level security;
-- Sin políticas: ninguna sesión autenticada la lee ni la escribe (negación por
-- omisión, mismo criterio que el resto del esquema). Sólo la clave de
-- servicio la toca, y sólo desde el servidor.

-- Deliberadamente fuera de la traza de auditoría: es un token técnico de
-- ARCA, no un dato de negocio, y auditar su alta/renovación no aporta nada
-- que discutir con un cliente. Se deja explícito para que se vea que no es
-- un olvido, mismo criterio que `usuario` en 0003.

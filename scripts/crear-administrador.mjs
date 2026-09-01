/**
 * RIENDA · Crea el primer administrador del sistema.
 *
 *   node scripts/crear-administrador.mjs --email quien@dominio --nombre Ana --apellido Pérez --documento 12345678 [--clave ...]
 *
 * Existe por el huevo y la gallina: dar de alta usuarios es una operación del
 * administrador (router `usuario.crear`), así que al primero hay que crearlo
 * desde afuera, con la clave de servicio. Después de éste, todos los demás se
 * crean desde la pantalla de Usuarios, que envía una invitación en lugar de
 * fijar contraseñas.
 *
 * Si no se pasa `--clave`, se genera una provisoria y se imprime una sola vez.
 * Es idempotente: si el correo ya existe en Auth, o la persona ya existe por
 * documento, reutiliza lo que hay y sólo completa lo que falta.
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// --- Entorno: se lee `.env.local` a mano porque esto no corre dentro de Next.
for (const linea of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !claveServicio) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

// --- Argumentos
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const faltan = ['email', 'nombre', 'apellido', 'documento'].filter((k) => !args[k]);
if (faltan.length) {
  console.error('Faltan argumentos: ' + faltan.map((k) => '--' + k).join(', '));
  process.exit(1);
}
const clave = args.clave ?? randomBytes(12).toString('base64url');
const claveGenerada = !args.clave;

const supabase = createClient(url, claveServicio, { auth: { persistSession: false } });

// 1. Credencial en Auth. Se confirma el correo de entrada porque quien corre
//    este script es quien administra el sistema: no hay a quién pedirle que
//    confirme.
let usuarioId;
const { data: lista, error: errorLista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (errorLista) throw errorLista;
const existente = lista.users.find((u) => u.email?.toLowerCase() === args.email.toLowerCase());

if (existente) {
  usuarioId = existente.id;
  console.log('Auth: el correo ya existía, se reutiliza ' + usuarioId);
  if (args.clave) {
    const { error } = await supabase.auth.admin.updateUserById(usuarioId, { password: clave });
    if (error) throw error;
    console.log('Auth: contraseña actualizada');
  }
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: args.email,
    password: clave,
    email_confirm: true,
  });
  if (error) throw error;
  usuarioId = data.user.id;
  console.log('Auth: credencial creada ' + usuarioId);
}

// 2. Persona. El índice único (tipo_documento, numero_documento) es la defensa
//    real contra el duplicado; acá se consulta antes para poder reutilizarla.
const tipoDocumento = args.tipo ?? 'dni';
let personaId;
{
  const { data } = await supabase
    .from('persona')
    .select('id')
    .eq('tipo_documento', tipoDocumento)
    .eq('numero_documento', args.documento)
    .maybeSingle();
  if (data) {
    personaId = data.id;
    console.log('Persona: ya existía, se reutiliza ' + personaId);
  } else {
    const { data: nueva, error } = await supabase
      .from('persona')
      .insert({
        nombre: args.nombre,
        apellido: args.apellido,
        tipo_documento: tipoDocumento,
        numero_documento: args.documento,
        email: args.email,
        telefono: args.telefono ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    personaId = nueva.id;
    console.log('Persona: creada ' + personaId);
  }
}

// 3. Usuario con rol de administrador.
{
  const { data } = await supabase.from('usuario').select('id, rol, activo').eq('id', usuarioId).maybeSingle();
  if (data) {
    const { error } = await supabase
      .from('usuario')
      .update({ rol: 'administrador', activo: true })
      .eq('id', usuarioId);
    if (error) throw error;
    console.log('Usuario: ya existía; rol administrador y activo asegurados');
  } else {
    const { error } = await supabase
      .from('usuario')
      .insert({ id: usuarioId, persona_id: personaId, rol: 'administrador' });
    if (error) throw error;
    console.log('Usuario: creado con rol administrador');
  }
}

console.log('');
console.log('Listo. Ingresá en /ingresar con ' + args.email);
if (claveGenerada) {
  console.log('Contraseña provisoria (se muestra una sola vez): ' + clave);
  console.log('Cambiala apenas entres.');
}

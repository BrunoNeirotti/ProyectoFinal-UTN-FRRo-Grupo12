/**
 * Valida las migraciones con el analizador real de PostgreSQL (libpg_query).
 *
 * Por qué existe: sin Docker no se puede levantar el stack local de Supabase, y
 * una migración con un error de sintaxis se descubriría recién al empujarla. Esto
 * no reemplaza correrlas contra una base (no verifica que una tabla exista ni
 * que un tipo esté declarado), pero descarta la clase de error más cara: la que
 * rompe el despliegue por una coma.
 *
 *   npm run db:lint
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'libpg-query';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MIGRACIONES = join(AQUI, '..', 'supabase', 'migrations');

const archivos = readdirSync(MIGRACIONES)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (archivos.length === 0) {
  console.error('No se encontró ninguna migración.');
  process.exit(1);
}

let fallas = 0;
let sentencias = 0;

for (const archivo of archivos) {
  const sql = readFileSync(join(MIGRACIONES, archivo), 'utf8');
  try {
    const arbol = await pg.parse(sql);
    const n = arbol.stmts?.length ?? 0;
    sentencias += n;
    console.log(`  ok     ${archivo.padEnd(48)} ${String(n).padStart(3)} sentencias`);
  } catch (e) {
    fallas++;
    console.error(`  FALLA  ${archivo}`);
    console.error(`         ${e.message}`);
  }
}

if (fallas > 0) {
  console.error(`\n${fallas} de ${archivos.length} migraciones con errores de sintaxis.`);
  process.exit(1);
}

console.log(`\n${archivos.length} migraciones válidas, ${sentencias} sentencias.`);

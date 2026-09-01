# RIENDA

Red Integral Ecuestre de Negocio, Datos y Administración. Sistema de gestión del **Haras Las
Lechuzas** (Funes, Santa Fe).

Proyecto Final de Ingeniería en Sistemas de Información, UTN Facultad Regional Rosario, Comisión
502, 2026. Grupo N°12: Marcos Berruhet, Gastón Boggino y Bruno Neirotti.

El diseño está cerrado y no se reabre acá: las 23 pantallas, las 33 entidades y las 19 reglas de
negocio viven en `../RIENDA-Diseño/`. Este repositorio construye ese diseño.

---

## Criterio de construcción

**Primero las bases de arquitectura, después cada módulo por prioridad.** Sin rebanadas verticales
ni atajos que crucen capas antes de tener la base. El orden de los módulos es el del cronograma
derivado del tamaño funcional, y arranca por M1 (acceso, usuarios y configuración).

**Seguridad desde el día uno.** Autenticación, control de acceso por rol, auditoría y validación en
los bordes son requisito explícito de la cátedra, no una mejora posterior.

## Cómo levantar el entorno

```bash
npm install
cp .env.example .env.local     # y completar
npm run dev
```

Para la base hace falta un proyecto de Supabase. El stack local (`supabase start`) necesita Docker;
sin él, las migraciones se empujan a un proyecto hospedado con `npm run db:push`.

El proyecto hospedado es `rienda` (ref `llxpsbotgwjlwirlpbzq`, São Paulo), vinculado con
`supabase link`. Sus claves van en `.env.local`, junto con `SUPABASE_DB_PASSWORD`.

**El analizador sintáctico no reemplaza a Postgres.** `db:lint` descarta errores de sintaxis, pero
no detecta, por ejemplo, una expresión no inmutable en una columna generada. Toda migración nueva se
aplica con `npm run db:push` antes de darla por buena.

### El primer administrador

El alta de usuarios es una operación del administrador, así que al primero hay que crearlo desde
afuera, con la clave de servicio:

```bash
node scripts/crear-administrador.mjs --email quien@dominio --nombre Ana --apellido Pérez --documento 12345678
```

Imprime una contraseña provisoria una sola vez. Es idempotente: si el correo o el documento ya
existen, los reutiliza. Los demás usuarios se crean desde la pantalla de Usuarios.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run verificar` | Tipos, estilo, migraciones y pruebas, en ese orden |
| `npm run typecheck` | TypeScript en modo estricto, sin emitir |
| `npm run lint` | ESLint |
| `npm run test` | Pruebas con Vitest |
| `npm run db:lint` | Sintaxis de las migraciones con el analizador de PostgreSQL |
| `npm run db:push` | Aplica las migraciones al proyecto de Supabase |
| `npm run build` | Compilación de producción |

## Cómo está organizado

```
supabase/migrations/   Esquema, invariantes, auditoría y políticas de acceso
src/app/               Rutas (App Router)
src/lib/               Lógica sin dependencias de framework, y por eso probada
src/server/            Contexto, capa de acceso y routers por módulo
src/proxy.ts           Renovación del token y redirección optimista
scripts/               Herramientas de verificación
```

## Cuatro decisiones que conviene conocer antes de tocar código

**Los colores no se declaran acá.** La fuente única es
`../RIENDA-Diseño/fase2/assets/rienda.css`. Su bloque `:root`/`.dark` está copiado literal en
`src/app/globals.css`, y el mapeo a utilidades vive en el `@theme inline` del mismo archivo. Ningún
otro archivo declara hexadecimales de marca.

**El control de acceso está en la base, no en la pantalla.** Las políticas RLS de
`supabase/migrations/…_rls.sql` son lo que efectivamente impide leer una fila; los guardas de rol de
`src/server/trpc.ts` existen para fallar temprano con un mensaje entendible. Si alguna vez
discrepan, manda la base. Una tabla sin política es una tabla inaccesible, así que agregar una
entidad nueva falla ruidosamente en lugar de quedar abierta.

**Hay reglas que la aplicación no puede romper aunque quiera.** El saldo de la cuenta corriente y la
existencia de un insumo son derivados y los mantiene un disparador; el interés por mora no
capitaliza; dos clases no pueden solaparse en la misma instalación ni con el mismo instructor; un
estado de cuenta no se emite dos veces para el mismo período; un alumno menor de edad exige
responsable y consentimiento del tutor. Están en la base porque una validación que vive sólo en el
cliente se saltea con una llamada directa a la API.

**`mora_tasa_mensual` está vacío a propósito.** El haras confirmó que cobra mora pero no dio el
porcentaje. Sin tasa, el sistema no propone intereses y lo dice, que es el estado real del negocio.
Un valor inventado por omisión se olvida y queda facturando.

## Stack

Next.js 16 (App Router) sobre React 19, Tailwind CSS 4, tRPC 11 con Zod 4, Supabase (PostgreSQL,
Auth y Storage) y Vitest. Despliegue previsto en Vercel.

> Nota sobre Tailwind: el prototipo trae un `tailwind.config.js` escrito para Tailwind 3. Acá se usa
> la 4, que se configura desde CSS. La regla que importa se mantiene: los valores de color siguen
> viviendo sólo en `rienda.css`. Lo que cambia es el mecanismo de mapeo.

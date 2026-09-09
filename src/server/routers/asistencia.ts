import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearRouter, procedimientoDeArea } from '../trpc';
import type { Database } from '@/lib/supabase/tipos-generados';
import {
  MESES_DE_REFERENCIA,
  type AsistenciaComputable,
  cargaPorCaballo,
  contar,
  contarPorPeriodo,
  estadoDePlanilla,
  evaluarRiesgo,
  periodoCorrido,
  periodoDe,
  periodosAnteriores,
  rangoDelPeriodo,
} from '@/lib/asistencia';
import { umbralDeRiesgoDeAsistencia } from '../parametros-servidor';
import { mensajeDeError } from '../errores';

/**
 * M8 · Asistencia y progreso.
 *
 * El módulo tiene dos caras y conviene no confundirlas, porque las opera gente
 * distinta en momentos distintos:
 *
 *   * **La planilla** es lo que el instructor completa en la pista, con la clase
 *     ocurriendo. Es una operación de escritura, corta, y termina en un cierre
 *     explícito que deja la clase `dictada`.
 *   * **El reporte** es lo que el administrador mira a fin de mes para decidir a
 *     quién llamar. Es sólo lectura y no guarda nada: todos sus números se
 *     cuentan al momento (ver la cabecera de `lib/asistencia.ts`).
 *
 * **Lo que este módulo NO decide.** Qué se le cobra a cada alumno por lo que
 * asistió es de M3, y llega ahí por la vía de la clase `dictada`. Acá se produce
 * el respaldo —quién estuvo, con qué caballo— y nada más. Mezclarlo con el cargo
 * haría que corregir una asistencia mal tomada moviera plata de la cuenta
 * corriente de un cliente sin que nadie lo mirara.
 */

const procedimiento = procedimientoDeArea('ensenanza');

const periodoValido = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El período va en formato yyyy-mm.');

/** Los seis meses que dibuja la evolución, contando el pedido. */
const MESES_DE_EVOLUCION = 6;

/**
 * Una fila de asistencia con lo que hace falta para todos los reportes.
 *
 * `clase:clase_id!inner` no es un capricho de sintaxis: el `!inner` es lo que
 * permite filtrar por `clase.inicia_en`, y esa fecha —y no `creado_en`— es la
 * que ubica la asistencia en un período. Una planilla que se carga al día
 * siguiente pertenece al mes de la clase, no al mes en que se cargó.
 */
const CAMPOS_DE_REPORTE =
  'presente, observaciones, clase:clase_id!inner (id, inicia_en, nivel, servicio:servicio_id (nombre)), alumno:alumno_id (id, nivel, persona:persona_id (nombre, apellido), cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))), caballo:caballo_id (id, nombre)';

type FilaDeReporte = {
  presente: boolean;
  clase: { id: string; inicia_en: string; nivel: string | null } | null;
  alumno: { id: string } | null;
  caballo: { id: string; nombre: string } | null;
};

/**
 * Las filas del rango, de la clase más vieja a la más nueva.
 *
 * **El orden se hace acá y no en la consulta**, y no es una preferencia: pedirle
 * a PostgREST `order=clase(inicia_en)` ordena las filas EMBEBIDAS dentro de cada
 * asistencia, que son una sola, así que no ordena nada y las filas vuelven en el
 * orden físico de la tabla. Se veía en el historial de un alumno, que salía con
 * las clases mezcladas, y habría torcido en silencio el «último caballo» del
 * reporte, que es el que se lee para vigilar la carga de un animal.
 */
async function asistenciasEntre(
  supabase: SupabaseClient<Database>,
  desde: Date,
  hasta: Date,
) {
  const { data, error } = await supabase
    .from('asistencia')
    .select(CAMPOS_DE_REPORTE)
    .gte('clase.inicia_en', desde.toISOString())
    .lt('clase.inicia_en', hasta.toISOString());

  if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

  return (data ?? [])
    .filter((f) => f.clase != null)
    .sort((a, b) => a.clase!.inicia_en.localeCompare(b.clase!.inicia_en));
}

/** Reduce una fila a lo que los cálculos de `lib/asistencia` necesitan. */
function computable(fila: FilaDeReporte): AsistenciaComputable | null {
  if (!fila.alumno || !fila.clase) return null;
  return {
    alumnoId: fila.alumno.id,
    periodo: periodoDe(fila.clase.inicia_en),
    presente: fila.presente,
  };
}

function nombreDePersona(p: { nombre: string; apellido: string } | null): string {
  return p ? `${p.nombre} ${p.apellido}`.trim() : '';
}

/** Un cliente puede ser persona física o jurídica: el nombre sale de donde haya. */
function nombreDeCliente(
  cliente: {
    tipo: string;
    razon_social: string | null;
    persona: { nombre: string; apellido: string } | null;
  } | null,
): string | null {
  if (!cliente) return null;
  return cliente.razon_social ?? nombreDePersona(cliente.persona) ?? null;
}

export const routerAsistencia = crearRouter({
  /**
   * Listado de asistencia de una clase (EQ).
   *
   * Devuelve a los inscriptos activos con lo que ya esté registrado de cada uno.
   * Los que todavía no tienen fila vuelven **presentes**: es la decisión del
   * prototipo y la que menos toques exige, porque una clase normal se registra
   * sin tocar nada y sólo se marcan las ausencias. Al revés, registrar una clase
   * de cinco alumnos que vinieron todos costaría cinco toques.
   *
   * El caballo que se propone es el previsto al inscribir (`inscripcion
   * .caballo_id`), que es lo que el instructor va a confirmar la mayoría de las
   * veces; si sustituyó, lo cambia y las dos cifras quedan comparables en el
   * reporte de carga.
   */
  planilla: procedimiento
    .input(z.object({ claseId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: clase, error: errorClase } = await ctx.supabase
        .from('clase')
        .select(
          'id, inicia_en, duracion_min, estado, nivel, motivo_suspension, servicio:servicio_id (nombre), instalacion:instalacion_id (nombre), instructor:instructor_id (persona:persona_id (nombre, apellido))',
        )
        .eq('id', input.claseId)
        .maybeSingle();

      if (errorClase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorClase) });
      if (!clase) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });

      const [inscripciones, asistencias, caballos] = await Promise.all([
        ctx.supabase
          .from('inscripcion')
          .select(
            'id, alumno:alumno_id (id, nivel, persona:persona_id (nombre, apellido)), caballo:caballo_id (id, nombre)',
          )
          .eq('clase_id', input.claseId)
          .eq('estado', 'inscripto')
          .order('inscripto_en'),
        ctx.supabase
          .from('asistencia')
          .select('id, alumno_id, presente, observaciones, caballo_id')
          .eq('clase_id', input.claseId),
        ctx.supabase.from('caballo').select('id, nombre').eq('estado', 'activo').order('nombre'),
      ]);

      for (const r of [inscripciones, asistencias, caballos]) {
        if (r.error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: r.error.message });
      }

      const registradas = asistencias.data ?? [];
      const porAlumno = new Map(registradas.map((a) => [a.alumno_id, a]));

      const alumnos = (inscripciones.data ?? [])
        .filter((i) => i.alumno != null)
        .map((i) => {
          const ya = porAlumno.get(i.alumno!.id);
          return {
            inscripcionId: i.id,
            alumnoId: i.alumno!.id,
            nombre: nombreDePersona(i.alumno!.persona),
            nivel: i.alumno!.nivel,
            asistenciaId: ya?.id ?? null,
            registrada: ya != null,
            presente: ya?.presente ?? true,
            observaciones: ya?.observaciones ?? '',
            /**
             * Tres campos sobre caballos y ninguno de más, porque son tres
             * hechos distintos y confundirlos hace decir que un alumno que
             * faltó montó igual:
             *
             *   * `caballoRegistrado` es con cuál montó. Nulo si todavía no se
             *     registró, y nulo también si faltó.
             *   * `caballoPropuesto` es lo que el formulario preselecciona:
             *     lo registrado si ya lo hay, y si no el previsto al inscribir.
             *   * `caballoPrevisto` es el nombre del previsto, para poder
             *     señalar la sustitución (CUS05, camino 7.c).
             */
            caballoRegistrado: ya?.caballo_id ?? null,
            caballoPropuesto: ya?.caballo_id ?? i.caballo?.id ?? null,
            caballoPrevisto: i.caballo?.nombre ?? null,
          };
        });

      return {
        clase,
        alumnos,
        caballos: caballos.data ?? [],
        estado: estadoDePlanilla(
          alumnos.map((a) => ({ alumnoId: a.alumnoId })),
          registradas.map((a) => ({ alumnoId: a.alumno_id, presente: a.presente })),
        ),
      };
    }),

  /**
   * Registrar la asistencia de una clase (EI).
   *
   * Se guarda la planilla entera de una vez y no alumno por alumno: es una sola
   * operación desde el punto de vista del instructor —«esto pasó en la clase»— y
   * partirla en seis llamadas dejaría la clase a medio registrar cada vez que el
   * celular pierde señal en el medio, que en la pista pasa.
   *
   * El cierre viene en la misma llamada y es explícito. Mientras la planilla no
   * esté completa no se cierra: la clase sigue `programada` y no entra en la
   * liquidación del período. Es lo que evita facturar una clase cargada a medias.
   *
   * `registrado_por` no se envía a propósito. Lo pone la base desde la sesión
   * (`default usuario_actual()`), así que no hay forma de firmar la planilla con
   * el nombre de otro. Al corregir tampoco se toca: quien tomó la asistencia la
   * tomó, y quién la corrigió después está en la traza de auditoría.
   */
  registrar: procedimiento
    .input(
      z.object({
        claseId: z.uuid(),
        cerrar: z.boolean().default(false),
        asistencias: z
          .array(
            z.object({
              alumnoId: z.uuid(),
              presente: z.boolean(),
              caballoId: z.uuid().nullable().default(null),
              observaciones: z.string().trim().max(1000).nullable().default(null),
            }),
          )
          .min(1, 'No hay a quién registrarle la asistencia.'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: clase, error: errorClase } = await ctx.supabase
        .from('clase')
        .select('id, estado')
        .eq('id', input.claseId)
        .maybeSingle();

      if (errorClase) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorClase) });
      if (!clase) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe esa clase.' });
      if (clase.estado === 'cancelada') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'La clase está suspendida: no genera asistencia.',
        });
      }

      const { data: inscriptos, error: errorInscriptos } = await ctx.supabase
        .from('inscripcion')
        .select('alumno_id')
        .eq('clase_id', input.claseId)
        .eq('estado', 'inscripto');

      if (errorInscriptos) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorInscriptos) });
      }

      // La base ya lo impide (`trg_asistencia_inscripto`), pero el mensaje de un
      // disparador no le sirve a quien está en la pista con el celular.
      const anotados = new Set((inscriptos ?? []).map((i) => i.alumno_id));
      const intrusos = input.asistencias.filter((a) => !anotados.has(a.alumnoId));
      if (intrusos.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            intrusos.length === 1
              ? 'Hay un alumno que no está inscripto en esta clase: primero hay que inscribirlo.'
              : `Hay ${intrusos.length} alumnos que no están inscriptos en esta clase: primero hay que inscribirlos.`,
        });
      }

      const { error } = await ctx.supabase.from('asistencia').upsert(
        input.asistencias.map((a) => ({
          clase_id: input.claseId,
          alumno_id: a.alumnoId,
          presente: a.presente,
          // El que no vino no montó. La base lo exige
          // (`asistencia_ausente_sin_caballo`); acá se normaliza para no
          // rechazar un formulario que trae el caballo preseleccionado de antes
          // de marcar la ausencia, que es lo que el instructor hace siempre.
          caballo_id: a.presente ? a.caballoId : null,
          observaciones: a.observaciones,
        })),
        { onConflict: 'clase_id,alumno_id' },
      );

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      const planilla = estadoDePlanilla(
        [...anotados].map((alumnoId) => ({ alumnoId })),
        input.asistencias.map((a) => ({ alumnoId: a.alumnoId, presente: a.presente })),
      );

      if (!input.cerrar) return { cerrada: false as const, planilla };

      if (!planilla.completa) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Falta registrar a ${planilla.inscriptos - planilla.registrados} de ${planilla.inscriptos}: la clase no se puede cerrar a medias.`,
        });
      }

      // Ya dictada: se guardó la corrección y no hay nada que cerrar de nuevo.
      if (clase.estado === 'dictada') return { cerrada: true as const, planilla };

      const { error: errorCierre } = await ctx.supabase
        .from('clase')
        .update({ estado: 'dictada' })
        .eq('id', input.claseId);

      if (errorCierre) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorCierre) });
      }

      return { cerrada: true as const, planilla };
    }),

  /**
   * Corregir una asistencia registrada (EI).
   *
   * Existe aparte del registro porque es otra cosa: acá la clase ya se dictó y
   * lo que se está haciendo es enmendar el respaldo de algo que va a facturarse.
   * Por eso toca una fila por vez y no la planilla entera —una corrección masiva
   * sobre una clase cerrada es indistinguible de haberla tomado de nuevo de
   * memoria— y por eso la fila tiene que existir: si no existe, lo que
   * corresponde es registrar la asistencia, no corregirla.
   */
  corregir: procedimiento
    .input(
      z.object({
        asistenciaId: z.uuid(),
        presente: z.boolean(),
        caballoId: z.uuid().nullable().default(null),
        observaciones: z.string().trim().max(1000).nullable().default(null),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: previa, error: errorPrevia } = await ctx.supabase
        .from('asistencia')
        .select('id, clase_id')
        .eq('id', input.asistenciaId)
        .maybeSingle();

      if (errorPrevia) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorPrevia) });
      if (!previa) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Esa asistencia no está registrada todavía: hay que registrarla, no corregirla.',
        });
      }

      const { error } = await ctx.supabase
        .from('asistencia')
        .update({
          presente: input.presente,
          caballo_id: input.presente ? input.caballoId : null,
          observaciones: input.observaciones,
        })
        .eq('id', input.asistenciaId);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });
      return { ok: true as const, claseId: previa.clase_id as string };
    }),

  /**
   * Historial de asistencia de un alumno (EQ).
   *
   * Clase por clase y en orden inverso, que es como se lee un antecedente: lo
   * último primero. Trae también el conteo del período por el que se filtró,
   * para no obligar a sumar a ojo lo que la pantalla ya tiene delante.
   */
  historialDeAlumno: procedimiento
    .input(
      z.object({
        alumnoId: z.uuid(),
        /** Cuántos meses hacia atrás. Por omisión, medio año. */
        meses: z.int().min(1).max(24).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasta = periodoDe(new Date());
      const desde = periodoCorrido(hasta, -(input.meses - 1));

      const { data: alumno, error: errorAlumno } = await ctx.supabase
        .from('alumno')
        .select(
          'id, nivel, activo, persona:persona_id (nombre, apellido), cliente:cliente_id (id, tipo, razon_social, persona:persona_id (nombre, apellido))',
        )
        .eq('id', input.alumnoId)
        .maybeSingle();

      if (errorAlumno) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorAlumno) });
      if (!alumno) throw new TRPCError({ code: 'NOT_FOUND', message: 'No existe ese alumno.' });

      const { data, error } = await ctx.supabase
        .from('asistencia')
        .select(CAMPOS_DE_REPORTE)
        .eq('alumno_id', input.alumnoId)
        .gte('clase.inicia_en', rangoDelPeriodo(desde).desde.toISOString())
        .lt('clase.inicia_en', rangoDelPeriodo(hasta).hasta.toISOString());

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(error) });

      // De la más nueva a la más vieja, que es como se lee un antecedente. El
      // orden va acá por lo mismo que en `asistenciasEntre`.
      const filas = (data ?? [])
        .filter((f) => f.clase != null)
        .sort((a, b) => b.clase!.inicia_en.localeCompare(a.clase!.inicia_en));

      return {
        alumno: {
          id: alumno.id,
          nombre: nombreDePersona(alumno.persona),
          nivel: alumno.nivel,
          activo: alumno.activo,
          cliente: ctx.sesion.rol === 'administrador' ? nombreDeCliente(alumno.cliente) : null,
        },
        desde,
        hasta,
        conteo: contar(filas),
        clases: filas.map((f) => ({
          claseId: f.clase!.id,
          iniciaEn: f.clase!.inicia_en,
          servicio: f.clase!.servicio?.nombre ?? null,
          nivel: f.clase!.nivel,
          presente: f.presente,
          caballo: f.caballo?.nombre ?? null,
          observaciones: f.observaciones,
        })),
      };
    }),

  /**
   * Reporte de progreso del alumno (EO).
   *
   * Es el reporte del administrador: cómo viene cada alumno en el período y
   * quién bajó lo suficiente como para que convenga llamarlo. Se trae de una vez
   * la ventana entera de seis meses porque los mismos datos alimentan las tres
   * cosas que la pantalla muestra —el mes, la comparación contra los tres
   * anteriores y la curva— y pedirlos tres veces sería el mismo viaje repetido.
   *
   * **El nombre del cliente sólo viaja si quien consulta puede verlo.** La
   * política `cliente_lectura` es del administrador, así que a un instructor la
   * consulta le devolvería el vínculo en nulo. Antes que mostrar una columna
   * vacía que parece un error de carga, se declara que no está: la pantalla
   * recibe `verClientes` y directamente no la dibuja.
   */
  progreso: procedimiento
    .input(z.object({ periodo: periodoValido.optional() }))
    .query(async ({ ctx, input }) => {
      const periodo = input.periodo ?? periodoDe(new Date());
      const primero = periodoCorrido(periodo, -(MESES_DE_EVOLUCION - 1));
      const ventana = Array.from({ length: MESES_DE_EVOLUCION }, (_, i) =>
        periodoCorrido(primero, i),
      );

      const [filas, umbral] = await Promise.all([
        asistenciasEntre(
          ctx.supabase,
          rangoDelPeriodo(primero).desde,
          rangoDelPeriodo(periodo).hasta,
        ),
        umbralDeRiesgoDeAsistencia(ctx.supabase),
      ]);

      const { desde, hasta } = rangoDelPeriodo(periodo);
      const { data: clases, error: errorClases } = await ctx.supabase
        .from('clase')
        .select('estado')
        .gte('inicia_en', desde.toISOString())
        .lt('inicia_en', hasta.toISOString());

      if (errorClases) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: mensajeDeError(errorClases) });

      const utiles = filas.filter((f) => f.alumno != null);
      const delPeriodo = utiles.filter((f) => periodoDe(f.clase!.inicia_en) === periodo);
      const anteriores = periodosAnteriores(periodo, MESES_DE_REFERENCIA);

      // Un alumno por cada uno que aparezca en la ventana, con sus filas.
      const porAlumno = new Map<string, typeof utiles>();
      for (const fila of utiles) {
        const suyas = porAlumno.get(fila.alumno!.id);
        if (suyas) suyas.push(fila);
        else porAlumno.set(fila.alumno!.id, [fila]);
      }

      const verClientes = ctx.sesion.rol === 'administrador';

      const alumnos = [...porAlumno.entries()]
        .map(([alumnoId, suyas]) => {
          const identidad = suyas.at(0)!.alumno!;
          const propias = suyas
            .map(computable)
            .filter((c): c is AsistenciaComputable => c !== null);
          const conteo = contar(propias.filter((c) => c.periodo === periodo));
          const historia = contarPorPeriodo(propias, anteriores);

          // El último caballo montado en el período. `asistenciasEntre` ya
          // devuelve las filas ordenadas por fecha de clase, así que el último
          // de la lista es el más reciente.
          const ultimo = suyas
            .filter((f) => periodoDe(f.clase!.inicia_en) === periodo && f.presente && f.caballo)
            .at(-1);

          return {
            alumnoId,
            nombre: nombreDePersona(identidad.persona),
            nivel: identidad.nivel,
            cliente: verClientes ? nombreDeCliente(identidad.cliente) : null,
            conteo,
            riesgo: evaluarRiesgo(
              conteo.porcentaje,
              anteriores.map((p) => historia.get(p)?.porcentaje ?? null),
              umbral,
            ),
            ultimoCaballo: ultimo?.caballo?.nombre ?? null,
          };
        })
        // Primero los que hay que mirar: en riesgo, y dentro de ellos el que más cayó.
        .sort(
          (a, b) =>
            Number(b.riesgo.enRiesgo) - Number(a.riesgo.enRiesgo) ||
            (b.riesgo.caida ?? -Infinity) - (a.riesgo.caida ?? -Infinity) ||
            a.nombre.localeCompare(b.nombre, 'es-AR'),
        );

      /**
       * La curva se abre por nivel de la CLASE y no por nivel del alumno: es el
       * nivel al que se dictó, y un alumno que sube de nivel en el medio del
       * semestre no puede reescribir hacia atrás las clases que ya tomó.
       */
      const niveles = [...new Set(utiles.map((f) => f.clase!.nivel).filter((n) => n != null))].sort();
      const evolucion = niveles.map((nivel) => {
        const suyas = utiles
          .filter((f) => f.clase!.nivel === nivel)
          .map(computable)
          .filter((c): c is AsistenciaComputable => c !== null);
        const serie = contarPorPeriodo(suyas, ventana);
        return {
          nivel,
          puntos: ventana.map((p) => ({
            periodo: p,
            porcentaje: serie.get(p)?.porcentaje ?? null,
            dictadas: serie.get(p)?.dictadas ?? 0,
          })),
        };
      });

      return {
        periodo,
        ventana,
        umbral,
        verClientes,
        general: contar(delPeriodo),
        clases: {
          dictadas: (clases ?? []).filter((c) => c.estado === 'dictada').length,
          programadas: (clases ?? []).filter((c) => c.estado === 'programada').length,
          suspendidas: (clases ?? []).filter((c) => c.estado === 'cancelada').length,
          total: (clases ?? []).length,
        },
        enRiesgo: alumnos.filter((a) => a.riesgo.enRiesgo).length,
        alumnos,
        evolucion,
      };
    }),

  /**
   * Carga de trabajo por caballo (EO).
   *
   * Vive en Enseñanza porque el dato sale de la asistencia, pero se lee desde
   * Bienestar Animal: es el control de cuánto trabaja cada animal. Que la
   * columna «con qué caballo montó» sirviera para las dos cosas es lo que
   * resolvió el problema de «asignación de caballos sin criterio registrado» del
   * árbol de problemas de la 1ª Entrega.
   */
  cargaDeCaballos: procedimiento
    .input(z.object({ periodo: periodoValido.optional() }))
    .query(async ({ ctx, input }) => {
      const periodo = input.periodo ?? periodoDe(new Date());
      const { desde, hasta } = rangoDelPeriodo(periodo);

      const [montadas, previstas] = await Promise.all([
        ctx.supabase
          .from('asistencia')
          .select('presente, caballo:caballo_id (id, nombre), clase:clase_id!inner (inicia_en)')
          .gte('clase.inicia_en', desde.toISOString())
          .lt('clase.inicia_en', hasta.toISOString()),
        ctx.supabase
          .from('inscripcion')
          .select('caballo:caballo_id (id, nombre), clase:clase_id!inner (inicia_en)')
          .eq('estado', 'inscripto')
          .gte('clase.inicia_en', desde.toISOString())
          .lt('clase.inicia_en', hasta.toISOString()),
      ]);

      for (const r of [montadas, previstas]) {
        if (r.error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: r.error.message });
      }

      return {
        periodo,
        carga: cargaPorCaballo(
          (montadas.data ?? []).map((m) => ({
            caballoId: m.caballo?.id ?? null,
            nombre: m.caballo?.nombre ?? null,
            presente: m.presente,
          })),
          (previstas.data ?? []).map((p) => ({
            caballoId: p.caballo?.id ?? null,
            nombre: p.caballo?.nombre ?? null,
          })),
        ),
      };
    }),
});

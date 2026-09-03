/**
 * Edad y minoría de edad, derivadas de `fecha_nacimiento` y nunca guardadas
 * (decisión de modelo: la edad se deriva).
 *
 * De acá depende la decisión 1.3: `alumno.responsable_id` y
 * `consentimiento_tutor_en` son obligatorios cuando el alumno es menor. Es
 * lógica de negocio y no un detalle de formulario, así que se prueba sola.
 */

const MAYORIA_DE_EDAD = 18;

export function edadEn(fechaNacimiento: string, alDia: Date = new Date()): number {
  const nacimiento = new Date(`${fechaNacimiento}T00:00:00Z`);
  let edad = alDia.getUTCFullYear() - nacimiento.getUTCFullYear();

  const cumplioEsteAno =
    alDia.getUTCMonth() > nacimiento.getUTCMonth() ||
    (alDia.getUTCMonth() === nacimiento.getUTCMonth() &&
      alDia.getUTCDate() >= nacimiento.getUTCDate());

  if (!cumplioEsteAno) edad -= 1;
  return edad;
}

export function esMenorDeEdad(fechaNacimiento: string, alDia: Date = new Date()): boolean {
  return edadEn(fechaNacimiento, alDia) < MAYORIA_DE_EDAD;
}

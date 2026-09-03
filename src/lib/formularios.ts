/**
 * Resultado común de una acción de servidor de formulario, para
 * `useActionState`. Un solo tipo para todas las pantallas evita que cada una
 * invente su propia forma de decir «ok» o «error».
 */
export type ResultadoDeGuardado =
  | { estado: 'inicial' }
  | { estado: 'ok'; guardados: number }
  | { estado: 'error'; mensaje: string };

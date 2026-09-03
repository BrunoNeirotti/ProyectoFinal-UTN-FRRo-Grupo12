import { llamador } from '@/lib/trpc/servidor';
import { BarraSuperior } from './barra-superior';

/** Quién está operando y desde dónde cierra sesión. No existía ninguna de las dos cosas. */
export async function Cabecera() {
  let sesion;
  try {
    sesion = await (await llamador()).quienSoy();
  } catch {
    return null;
  }

  return <BarraSuperior nombre={sesion.nombre} apellido={sesion.apellido} rol={sesion.rol} />;
}

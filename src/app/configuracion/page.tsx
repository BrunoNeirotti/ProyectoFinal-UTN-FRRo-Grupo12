import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { llamador } from '@/lib/trpc/servidor';
import { proponeIntereses } from '@/lib/parametros';
import { FormularioDeReglas } from './formulario';
import { SeccionServicios } from './seccion-servicios';
import { SeccionInstalaciones } from './seccion-instalaciones';
import { SeccionUsuarios } from './seccion-usuarios';

export const metadata: Metadata = { title: 'Configuración' };

/**
 * Pantalla 9 del prototipo: Configuración, usuarios y roles.
 *
 * Cierra el hito de M1: «el haras puede entrar al sistema con sus usuarios
 * reales y ver sus propias reglas configuradas». Reglas, usuarios, servicios
 * y tarifas, e instalaciones son las cuatro áreas medidas en el conteo de
 * puntos de función de M1 (`entrega3/puntos-funcion.js`); las plantillas de
 * mensajes (M5) quedan para cuando se construya ese módulo.
 */
export default async function Configuracion() {
  const api = await llamador();

  let parametros;
  try {
    parametros = await api.parametro.vigentes();
  } catch (e) {
    // Sin sesión, a ingresar. El proxy ya redirige, pero esto cubre el caso de
    // que la sesión venza entre la petición y el render.
    if (e instanceof TRPCError && e.code === 'UNAUTHORIZED') redirect('/ingresar?volver=/configuracion');
    throw e;
  }

  const tasa = parametros.find((p) => p.clave === 'mora_tasa_mensual');
  const [servicios, instalaciones, usuariosCrudos] = await Promise.all([
    api.servicio.listar(),
    api.instalacion.listar(),
    api.usuario.listar(),
  ]);
  const usuarios = usuariosCrudos.map((u) => ({
    id: u.id,
    rol: u.rol,
    activo: u.activo,
    ultimoAccesoEn: u.ultimo_acceso_en,
    persona: u.persona,
  }));

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="font-serif text-3xl text-fg">Configuración</h1>
      <p className="mt-1 text-fg-muted">
        Las reglas que gobiernan la cobranza, la agenda y los mensajes. Cambiarlas no requiere
        tocar el sistema.
      </p>

      {tasa && !proponeIntereses(tasa.valor) && (
        <div className="mt-6 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">
          <strong className="font-semibold">La tasa de mora no está definida.</strong> Mientras siga
          vacía, el sistema no propone intereses en la cobranza. No es un error de configuración:
          es el estado que se relevó.
        </div>
      )}

      <section className="mt-8">
        <h2 className="font-serif text-xl text-fg">Reglas del haras</h2>
        <FormularioDeReglas parametros={parametros} />
      </section>

      <div className="mt-8 space-y-8">
        <SeccionUsuarios usuarios={usuarios} />
        <SeccionServicios servicios={servicios} />
        <SeccionInstalaciones instalaciones={instalaciones} />
      </div>
    </main>
  );
}

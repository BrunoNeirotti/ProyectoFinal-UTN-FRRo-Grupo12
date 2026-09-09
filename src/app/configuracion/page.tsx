import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TRPCError } from '@trpc/server';
import { WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { llamador } from '@/lib/trpc/servidor';
import { proponeIntereses } from '@/lib/parametros';
import { FormularioDeReglas } from './formulario';
import { SeccionServicios } from './seccion-servicios';
import { SeccionInstalaciones } from './seccion-instalaciones';
import { SeccionUsuarios } from './seccion-usuarios';
import { SeccionPlantillas } from './seccion-plantillas';
import { SeccionIdentidadFiscal } from './seccion-identidad-fiscal';
import { SeccionPuntosDeVenta } from './seccion-puntos-venta';

export const metadata: Metadata = { title: 'Configuración' };

/**
 * Pantalla 9 del prototipo: Configuración, usuarios y roles.
 *
 * Cierra el hito de M1: «el haras puede entrar al sistema con sus usuarios
 * reales y ver sus propias reglas configuradas». Reglas, usuarios, servicios
 * y tarifas, e instalaciones son las cuatro áreas medidas en el conteo de
 * puntos de función de M1; plantillas de mensajes es de M5.
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
  const [servicios, instalaciones, usuariosCrudos, plantillasCrudas, identidades, puntosVenta] = await Promise.all([
    api.servicio.listar(),
    api.instalacion.listar(),
    api.usuario.listar(),
    api.plantillaMensaje.listar(),
    api.identidadFiscal.listar(),
    api.puntoVenta.listar(),
  ]);
  const usuarios = usuariosCrudos.map((u) => ({
    id: u.id,
    rol: u.rol,
    activo: u.activo,
    ultimoAccesoEn: u.ultimo_acceso_en,
    persona: u.persona,
  }));
  const plantillas = plantillasCrudas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    canal: p.canal,
    asunto: p.asunto,
    cuerpo: p.cuerpo,
    activa: p.activa,
    nombreMeta: p.nombre_meta,
    categoria: p.categoria,
    estadoAprobacion: p.estado_aprobacion,
    motivoRechazo: p.motivo_rechazo,
    firmanteOrigen: p.firmante_origen,
  }));

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <p className="text-xs uppercase tracking-[0.18em] text-accent-ink">Sistema</p>
      <h1 className="font-serif text-3xl text-fg">Configuración</h1>
      <p className="mt-1 text-fg-muted">
        Parámetros del establecimiento: reglas de negocio, servicios y precios, instalaciones,
        identidad fiscal, plantillas de mensajes y usuarios.
      </p>

      {tasa && !proponeIntereses(tasa.valor) && (
        <div className="card-accent mt-6 flex items-start gap-2 p-4 text-sm text-warn">
          <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">La tasa de mora no está definida.</strong> Sin este
            valor, el sistema no calcula ni propone intereses por mora en la cobranza.
          </p>
        </div>
      )}

      <section className="card mt-8 p-5">
        <h2 className="font-serif text-xl text-fg">Reglas del haras</h2>
        <FormularioDeReglas parametros={parametros} />
      </section>

      <div className="mt-8 space-y-8">
        <SeccionUsuarios usuarios={usuarios} />
        <SeccionServicios servicios={servicios} />
        <SeccionInstalaciones instalaciones={instalaciones} />
        <SeccionPlantillas plantillas={plantillas} />
        <SeccionIdentidadFiscal identidades={identidades} />
        <SeccionPuntosDeVenta puntos={puntosVenta} />
      </div>
    </div>
  );
}

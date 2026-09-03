'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { crearCliente } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };
const comun = 'mt-1 w-full rounded-lg border border-surface-border bg-bg px-3 py-2 text-sm text-fg';

export function FormularioNuevoCliente() {
  const [resultado, enviar] = useActionState(crearCliente, inicial);
  const [tipo, setTipo] = useState<'persona_fisica' | 'persona_juridica'>('persona_fisica');
  const [requiereFactura, setRequiereFactura] = useState(false);

  return (
    <form action={enviar} className="max-w-2xl space-y-4">
      <fieldset className="flex gap-4">
        <legend className="text-sm font-medium text-fg">Tipo de cliente</legend>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="tipo"
            value="persona_fisica"
            checked={tipo === 'persona_fisica'}
            onChange={() => setTipo('persona_fisica')}
          />
          Persona física
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="radio"
            name="tipo"
            value="persona_juridica"
            checked={tipo === 'persona_juridica'}
            onChange={() => setTipo('persona_juridica')}
          />
          Persona jurídica
        </label>
      </fieldset>

      {tipo === 'persona_fisica' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-fg-muted">
            Nombre
            <input name="nombre" required className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Apellido
            <input name="apellido" required className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Tipo de documento
            <select name="tipoDocumento" className={comun}>
              <option value="dni">DNI</option>
              <option value="cuit">CUIT</option>
              <option value="cuil">CUIL</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>
          <label className="block text-xs text-fg-muted">
            Número de documento
            <input name="numeroDocumento" required className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Teléfono (WhatsApp)
            <input name="telefono" placeholder="+5493415550188" className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Correo
            <input name="email" type="email" className={comun} />
          </label>
          <label className="block text-xs text-fg-muted sm:col-span-2">
            Domicilio
            <input name="domicilio" className={comun} />
          </label>
        </div>
      ) : (
        <label className="block text-xs text-fg-muted">
          Razón social
          <input name="razonSocial" required className={comun} />
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-fg-muted">
          Canal preferido
          <select name="canalPreferido" defaultValue="whatsapp" className={comun}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
          </select>
        </label>
        <label className="block text-xs text-fg-muted">
          Día de vencimiento pactado (opcional)
          <input name="diaVencimiento" type="number" min="1" max="28" className={comun} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          name="requiereFactura"
          value="true"
          checked={requiereFactura}
          onChange={(e) => setRequiereFactura(e.target.checked)}
        />
        Pide factura
      </label>

      {requiereFactura && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-fg-muted">
            CUIT
            <input name="cuit" required className={comun} />
          </label>
          <label className="block text-xs text-fg-muted">
            Condición frente al IVA
            <select name="condicionIva" required className={comun}>
              <option value="">Elegir…</option>
              <option value="responsable_inscripto">Responsable inscripto</option>
              <option value="monotributo">Monotributo</option>
              <option value="consumidor_final">Consumidor final</option>
              <option value="exento">Exento</option>
            </select>
          </label>
        </div>
      )}

      {resultado.estado === 'error' && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">
          {resultado.mensaje}
        </p>
      )}

      <BotonEnviar />
    </form>
  );
}

function BotonEnviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
    >
      {pending ? 'Creando…' : 'Crear cliente'}
    </button>
  );
}

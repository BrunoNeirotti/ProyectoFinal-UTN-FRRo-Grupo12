'use client';

import { useActionState, useState } from 'react';
import { crearCliente } from './acciones';
import type { ResultadoDeGuardado } from '@/lib/formularios';
import { BotonEnviar } from '../botones';

const inicial: ResultadoDeGuardado = { estado: 'inicial' };

export function FormularioNuevoCliente() {
  const [resultado, enviar] = useActionState(crearCliente, inicial);
  const [tipo, setTipo] = useState<'persona_fisica' | 'persona_juridica'>('persona_fisica');
  const [requiereFactura, setRequiereFactura] = useState(false);

  return (
    <form action={enviar} className="max-w-2xl space-y-5">
      <fieldset className="flex gap-4">
        <legend className="label">Tipo de cliente</legend>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nombre</span>
            <input name="nombre" required className="input" />
          </label>
          <label className="block">
            <span className="label">Apellido</span>
            <input name="apellido" required className="input" />
          </label>
          <label className="block">
            <span className="label">Tipo de documento</span>
            <select name="tipoDocumento" className="input">
              <option value="dni">DNI</option>
              <option value="cuit">CUIT</option>
              <option value="cuil">CUIL</option>
              <option value="pasaporte">Pasaporte</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Número de documento</span>
            <input name="numeroDocumento" required className="input" />
          </label>
          <label className="block">
            <span className="label">Teléfono (WhatsApp)</span>
            <input name="telefono" placeholder="+5493415550188" className="input" />
          </label>
          <label className="block">
            <span className="label">Correo</span>
            <input name="email" type="email" className="input" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Domicilio</span>
            <input name="domicilio" className="input" />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className="label">Razón social</span>
          <input name="razonSocial" required className="input" />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Canal preferido</span>
          <select name="canalPreferido" defaultValue="whatsapp" className="input">
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Correo</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Día de vencimiento pactado (opcional)</span>
          <input name="diaVencimiento" type="number" min="1" max="28" className="input" />
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
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">CUIT</span>
            <input name="cuit" required className="input" />
          </label>
          <label className="block">
            <span className="label">Condición frente al IVA</span>
            <select name="condicionIva" required className="input">
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
        <p role="alert" className="error">{resultado.mensaje}</p>
      )}

      <BotonEnviar texto="Crear cliente" cargando="Creando…" />
    </form>
  );
}

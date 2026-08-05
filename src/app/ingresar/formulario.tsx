'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { clienteDeNavegador } from '@/lib/supabase/navegador';

/**
 * El formulario es lo único que necesita ser componente de cliente: el resto de
 * la pantalla se renderiza en el servidor.
 *
 * El mensaje de error es deliberadamente genérico. Decir «ese correo no existe»
 * convierte la pantalla en un verificador de qué direcciones están registradas,
 * que es información que no hace falta dar.
 */
export function FormularioDeIngreso() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarTransicion] = useTransition();

  async function enviar(datos: FormData) {
    setError(null);

    const correo = String(datos.get('correo') ?? '').trim();
    const clave = String(datos.get('clave') ?? '');

    if (!correo || !clave) {
      setError('Completá el correo y la contraseña.');
      return;
    }

    const supabase = clienteDeNavegador();
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: correo,
      password: clave,
    });

    if (fallo) {
      setError('No pudimos validar esos datos. Revisá el correo y la contraseña.');
      return;
    }

    // `volver` lo pone el proxy cuando intercepta una ruta protegida, para
    // devolver a la persona a donde iba. Se acepta sólo si es una ruta interna:
    // una URL absoluta acá sería un redirección abierta.
    const volver = parametros.get('volver');
    const destino = volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';

    iniciarTransicion(() => {
      router.replace(destino);
      router.refresh();
    });
  }

  return (
    <form action={enviar} className="mt-6 space-y-4">
      <div>
        <label htmlFor="correo" className="block text-sm text-feature-muted">
          Correo electrónico
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          required
          placeholder="tu@correo.com"
          className="mt-1 w-full rounded-lg border border-cacao-700 bg-cacao-900 px-3 py-2 text-feature-fg placeholder:text-cacao-200/50"
        />
      </div>

      <div>
        <label htmlFor="clave" className="block text-sm text-feature-muted">
          Contraseña
        </label>
        <input
          id="clave"
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-cacao-700 bg-cacao-900 px-3 py-2 text-feature-fg"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-fg disabled:opacity-60"
      >
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>

      <a href="/recuperar-clave" className="block text-center text-sm text-accent-ink">
        Olvidé mi contraseña
      </a>
    </form>
  );
}

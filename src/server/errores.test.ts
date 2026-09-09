import { describe, expect, it } from 'vitest';
import { mensajeDeError } from './errores';

describe('mensajeDeError', () => {
  it('traduce el choque de clave única que se vio en Facturación', () => {
    // El mensaje exacto que PostgREST devolvía y llegaba entero a la pantalla.
    const e = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "comprobante_numero_unico"',
    };
    const salida = mensajeDeError(e);
    expect(salida).toContain('número de comprobante ya está usado');
    expect(salida).not.toContain('duplicate');
    expect(salida).not.toContain('constraint');
  });

  it('para una restricción que no está declarada dice algo general, no el nombre interno', () => {
    const e = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "tabla_rara_algo_unico"',
    };
    expect(mensajeDeError(e)).toBe('Ya existe un registro con esos datos.');
  });

  it('deja pasar los mensajes de nuestros propios disparadores, que ya están en castellano', () => {
    const propio = 'Una orden anulada está cerrada: no vuelve a ningún estado.';
    expect(mensajeDeError({ code: '23514', message: propio })).toBe(propio);
    expect(mensajeDeError({ code: 'P0001', message: propio })).toBe(propio);
  });

  it('traduce las violaciones corrientes', () => {
    expect(mensajeDeError({ code: '23503' })).toContain('dependen de este');
    expect(mensajeDeError({ code: '23502' })).toContain('dato obligatorio');
    expect(mensajeDeError({ code: '42501' })).toContain('permiso');
  });

  it('ante un código desconocido no muestra el mensaje crudo', () => {
    const e = { code: 'XX000', message: 'some internal english failure at line 42' };
    expect(mensajeDeError(e)).toBe('No se pudo completar la operación.');
    expect(mensajeDeError(e)).not.toContain('english');
  });

  it('respeta el mensaje por omisión que pasa quien llama', () => {
    expect(mensajeDeError({ code: 'XX000' }, 'No se pudo emitir el comprobante.')).toBe(
      'No se pudo emitir el comprobante.',
    );
  });

  it('sin error devuelve el genérico y no rompe', () => {
    expect(mensajeDeError(null)).toBe('No se pudo completar la operación.');
    expect(mensajeDeError(undefined)).toBe('No se pudo completar la operación.');
  });
});

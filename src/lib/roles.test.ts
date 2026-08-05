import { describe, expect, it } from 'vitest';
import { AREAS, ROLES, alcanceDe, esAdministrador, esPersonal, puedeVer } from './roles';

describe('alcance por rol', () => {
  it('el peón NUNCA ve gerencia', () => {
    // Es el principio rector del sitemap y el que justifica el control de
    // acceso por rol ante la cátedra. Si esta prueba se pone en rojo, no se
    // arregla la prueba.
    expect(puedeVer('peon', 'gerencia')).toBe(false);
    expect(puedeVer('instructor', 'gerencia')).toBe(false);
    expect(puedeVer('administrador', 'gerencia')).toBe(true);
  });

  it('el cliente sólo alcanza su portal', () => {
    expect(alcanceDe('cliente')).toEqual(['portal']);
    for (const area of AREAS) {
      if (area !== 'portal') expect(puedeVer('cliente', area)).toBe(false);
    }
  });

  it('ningún rol del personal alcanza el portal del cliente', () => {
    // El portal es la vista restringida de un cliente sobre lo suyo. El
    // personal usa las pantallas internas, que muestran otra cosa.
    for (const rol of ROLES) {
      if (rol !== 'cliente') expect(puedeVer(rol, 'portal')).toBe(false);
    }
  });

  it('sólo el administrador toca la configuración del establecimiento', () => {
    const conAcceso = ROLES.filter((r) => puedeVer(r, 'configuracion'));
    expect(conAcceso).toEqual(['administrador']);
  });

  it('distingue personal de cliente externo', () => {
    expect(esPersonal('peon')).toBe(true);
    expect(esPersonal('instructor')).toBe(true);
    expect(esPersonal('administrador')).toBe(true);
    expect(esPersonal('cliente')).toBe(false);
    expect(esAdministrador('instructor')).toBe(false);
  });

  it('todo rol tiene al menos un área, para que ninguno quede sin pantalla', () => {
    for (const rol of ROLES) expect(alcanceDe(rol).length).toBeGreaterThan(0);
  });
});

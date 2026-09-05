import { describe, expect, it } from 'vitest';
import {
  armarGrilla,
  cancelacionEnTermino,
  cupoDeClase,
  instanteDesdeLocal,
  ocupacionDeInstalaciones,
  partesLocales,
  semanaCorrida,
  semanaDe,
  seSolapan,
} from './agenda';

/**
 * Argentina está en UTC-3 todo el año. Las pruebas no lo dan por sentado —el
 * código no lo hace— pero sí verifican el caso que rompe si alguien resta horas
 * a mano: la clase de la mañana del haras vista desde un servidor en UTC.
 */
describe('partesLocales', () => {
  it('devuelve la hora de pared del haras, no la del servidor', () => {
    // 2026-09-10 12:00 UTC son las 09:00 en Funes.
    const p = partesLocales('2026-09-10T12:00:00.000Z');
    expect(p.fecha).toBe('2026-09-10');
    expect(p.hora).toBe('09:00');
    expect(p.franja).toBe('09:00');
  });

  it('mantiene el día correcto cuando el instante UTC ya cruzó la medianoche', () => {
    // 2026-09-11 01:00 UTC son todavía las 22:00 del jueves 10 en Funes.
    const p = partesLocales('2026-09-11T01:00:00.000Z');
    expect(p.fecha).toBe('2026-09-10');
    expect(p.hora).toBe('22:00');
    expect(p.diaSemana).toBe(4); // jueves
  });

  it('agrupa en la franja de la hora en punto aunque la clase arranque y media', () => {
    expect(partesLocales('2026-09-10T19:30:00.000Z').franja).toBe('16:00');
  });
});

describe('instanteDesdeLocal', () => {
  it('convierte la hora que el instructor escribe al instante que guarda la base', () => {
    expect(instanteDesdeLocal('2026-09-10', '09:00').toISOString()).toBe('2026-09-10T12:00:00.000Z');
  });

  it('es la inversa exacta de partesLocales', () => {
    const instante = instanteDesdeLocal('2026-11-03', '16:30');
    const p = partesLocales(instante);
    expect(p.fecha).toBe('2026-11-03');
    expect(p.hora).toBe('16:30');
  });

  it('la medianoche local no se corre de día', () => {
    const p = partesLocales(instanteDesdeLocal('2026-09-07', '00:00'));
    expect(p.fecha).toBe('2026-09-07');
    expect(p.hora).toBe('00:00');
  });
});

describe('semanaDe', () => {
  it('arranca el lunes y termina el domingo', () => {
    const s = semanaDe('2026-09-10T12:00:00.000Z'); // jueves
    expect(s.dias[0]).toBe('2026-09-07');
    expect(s.dias[5]).toBe('2026-09-12');
    expect(s.dias[6]).toBe('2026-09-13');
  });

  it('el domingo pertenece a la semana que termina, no a la que empieza', () => {
    const s = semanaDe(instanteDesdeLocal('2026-09-13', '10:00'));
    expect(s.dias[0]).toBe('2026-09-07');
  });

  it('el rango cubre la semana entera sin dejar huecos ni pisar la siguiente', () => {
    const s = semanaDe('2026-09-10T12:00:00.000Z');
    expect(s.desde.toISOString()).toBe('2026-09-07T03:00:00.000Z');
    expect(s.hasta.toISOString()).toBe('2026-09-14T03:00:00.000Z');
  });

  it('una clase del lunes a las 00:00 cae dentro del rango', () => {
    const s = semanaDe('2026-09-10T12:00:00.000Z');
    const inicio = instanteDesdeLocal('2026-09-07', '00:00');
    expect(inicio >= s.desde && inicio < s.hasta).toBe(true);
  });
});

describe('semanaCorrida', () => {
  it('avanza y retrocede de a semanas completas desde el lunes', () => {
    expect(semanaCorrida('2026-09-10T12:00:00.000Z', 1)).toBe('2026-09-14');
    expect(semanaCorrida('2026-09-10T12:00:00.000Z', -1)).toBe('2026-08-31');
  });

  it('cruza el cambio de mes y de año sin corregir a mano', () => {
    expect(semanaCorrida('2026-12-30T12:00:00.000Z', 1)).toBe('2027-01-04');
  });
});

describe('armarGrilla', () => {
  const dias = semanaDe('2026-09-10T12:00:00.000Z').dias;
  const clase = (id: string, fecha: string, hora: string) => ({
    id,
    iniciaEn: instanteDesdeLocal(fecha, hora).toISOString(),
  });

  it('ubica cada clase en su día y su franja', () => {
    const filas = armarGrilla(
      [clase('a', '2026-09-07', '09:00'), clase('b', '2026-09-09', '16:00')],
      dias,
      (c) => c.iniciaEn,
    );

    expect(filas.map((f) => f.franja)).toEqual(['09:00', '16:00']);
    expect(filas[0]?.celdas[0]?.map((c) => c.id)).toEqual(['a']);
    expect(filas[1]?.celdas[2]?.map((c) => c.id)).toEqual(['b']);
  });

  it('emite sólo las franjas con clases, ordenadas', () => {
    const filas = armarGrilla(
      [clase('tarde', '2026-09-07', '16:00'), clase('temprano', '2026-09-07', '09:00')],
      dias,
      (c) => c.iniciaEn,
    );
    expect(filas.map((f) => f.franja)).toEqual(['09:00', '16:00']);
  });

  it('acumula en la misma celda dos clases de la misma franja y día', () => {
    const filas = armarGrilla(
      [clase('a', '2026-09-07', '09:00'), clase('b', '2026-09-07', '09:30')],
      dias,
      (c) => c.iniciaEn,
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]?.celdas[0]).toHaveLength(2);
  });

  it('descarta lo que cae fuera de la semana en lugar de dibujarlo en la columna equivocada', () => {
    const filas = armarGrilla([clase('otra', '2026-09-21', '09:00')], dias, (c) => c.iniciaEn);
    expect(filas).toEqual([]);
  });

  it('sin clases no devuelve filas', () => {
    expect(armarGrilla([], dias, (c: { iniciaEn: string }) => c.iniciaEn)).toEqual([]);
  });
});

describe('cupoDeClase', () => {
  it('la clase individual admite un solo alumno aunque no tenga cupo cargado', () => {
    expect(cupoDeClase('individual', null, 0)).toMatchObject({ limite: 1, disponibles: 1, completo: false });
    expect(cupoDeClase('individual', null, 1)).toMatchObject({ disponibles: 0, completo: true });
  });

  it('la grupal con cupo declarado lo controla', () => {
    expect(cupoDeClase('grupal', 6, 4)).toMatchObject({ limite: 6, disponibles: 2, completo: false });
    expect(cupoDeClase('grupal', 6, 6)).toMatchObject({ disponibles: 0, completo: true });
  });

  it('la grupal sin cupo declarado no se controla', () => {
    expect(cupoDeClase('grupal', null, 12)).toMatchObject({ limite: null, disponibles: null, completo: false });
  });

  it('nunca informa disponibles negativos si una clase quedó sobrecargada', () => {
    expect(cupoDeClase('grupal', 4, 6)).toMatchObject({ disponibles: 0, completo: true });
  });
});

describe('cancelacionEnTermino', () => {
  const inicio = instanteDesdeLocal('2026-09-10', '09:00');

  it('con la antelación mínima cumplida, está en término', () => {
    expect(cancelacionEnTermino(inicio, instanteDesdeLocal('2026-09-06', '09:00'), 3)).toBe(true);
  });

  it('el límite exacto cuenta como en término, no como fuera', () => {
    expect(cancelacionEnTermino(inicio, instanteDesdeLocal('2026-09-07', '09:00'), 3)).toBe(true);
  });

  it('una hora más tarde ya está fuera de término', () => {
    expect(cancelacionEnTermino(inicio, instanteDesdeLocal('2026-09-07', '10:00'), 3)).toBe(false);
  });

  it('cancelar después de la clase está fuera de término', () => {
    expect(cancelacionEnTermino(inicio, instanteDesdeLocal('2026-09-11', '09:00'), 3)).toBe(false);
  });
});

describe('seSolapan', () => {
  const inicio = '2026-09-10T12:00:00.000Z';

  it('detecta la superposición parcial', () => {
    expect(seSolapan(inicio, 60, '2026-09-10T12:30:00.000Z', 60)).toBe(true);
  });

  it('dos clases consecutivas no se solapan: el rango es semiabierto', () => {
    expect(seSolapan(inicio, 60, '2026-09-10T13:00:00.000Z', 60)).toBe(false);
  });

  it('una clase contenida en otra se solapa', () => {
    expect(seSolapan(inicio, 120, '2026-09-10T12:30:00.000Z', 30)).toBe(true);
  });

  it('clases en días distintos no se solapan', () => {
    expect(seSolapan(inicio, 60, '2026-09-11T12:00:00.000Z', 60)).toBe(false);
  });
});

describe('ocupacionDeInstalaciones', () => {
  it('suma minutos y clases por instalación y reparte la participación', () => {
    const r = ocupacionDeInstalaciones([
      { instalacionId: 'a', nombre: 'Pista A', duracionMin: 60 },
      { instalacionId: 'a', nombre: 'Pista A', duracionMin: 60 },
      { instalacionId: 'b', nombre: 'Picadero', duracionMin: 60 },
    ]);

    expect(r[0]).toMatchObject({ nombre: 'Pista A', clases: 2, minutos: 120 });
    expect(r[0]?.participacion).toBeCloseTo(66.67, 1);
    expect(r[1]?.participacion).toBeCloseTo(33.33, 1);
  });

  it('ordena de mayor a menor ocupación', () => {
    const r = ocupacionDeInstalaciones([
      { instalacionId: 'a', nombre: 'Pista A', duracionMin: 30 },
      { instalacionId: 'b', nombre: 'Picadero', duracionMin: 90 },
    ]);
    expect(r.map((i) => i.nombre)).toEqual(['Picadero', 'Pista A']);
  });

  it('sin clases dictadas no divide por cero', () => {
    expect(ocupacionDeInstalaciones([])).toEqual([]);
  });
});

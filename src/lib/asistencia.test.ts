import { describe, expect, it } from 'vitest';
import {
  cargaPorCaballo,
  contar,
  contarPorAlumno,
  contarPorPeriodo,
  estadoDePlanilla,
  evaluarRiesgo,
  nombreDePeriodo,
  periodoCorrido,
  periodoDe,
  periodosAnteriores,
  rangoDelPeriodo,
} from './asistencia';

describe('períodos', () => {
  it('ubica la clase en el mes de la hora del haras, no en el del servidor', () => {
    // 2026-06-01 01:00 UTC son todavía las 22:00 del 31 de mayo en Funes: la
    // clase pertenece a mayo, y el estado de cuenta de mayo la tiene que contar.
    expect(periodoDe('2026-06-01T01:00:00.000Z')).toBe('2026-05');
    expect(periodoDe('2026-06-01T12:00:00.000Z')).toBe('2026-06');
  });

  it('cruza el año hacia atrás y hacia adelante', () => {
    expect(periodoCorrido('2026-01', -1)).toBe('2025-12');
    expect(periodoCorrido('2026-12', 1)).toBe('2027-01');
    expect(periodoCorrido('2026-05', -17)).toBe('2024-12');
  });

  it('los meses anteriores vienen del más viejo al más reciente', () => {
    expect(periodosAnteriores('2026-05', 3)).toEqual(['2026-02', '2026-03', '2026-04']);
  });

  it('el rango arranca a la medianoche de Funes y no a la de UTC', () => {
    const { desde, hasta } = rangoDelPeriodo('2026-05');
    expect(desde.toISOString()).toBe('2026-05-01T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-06-01T03:00:00.000Z');
  });

  it('rechaza un período mal formado en lugar de calcular cualquier cosa', () => {
    expect(() => rangoDelPeriodo('2026-13')).toThrow(RangeError);
    expect(() => rangoDelPeriodo('mayo')).toThrow(RangeError);
  });

  it('nombra el período para el título', () => {
    expect(nombreDePeriodo('2026-05')).toBe('Mayo de 2026');
  });
});

describe('contar', () => {
  it('sin clases no hay porcentaje, y eso no es cero', () => {
    expect(contar([]).porcentaje).toBeNull();
    expect(contar([]).dictadas).toBe(0);
  });

  it('separa asistidas de ausencias', () => {
    const c = contar([{ presente: true }, { presente: true }, { presente: false }, { presente: true }]);
    expect(c).toEqual({ dictadas: 4, asistidas: 3, ausencias: 1, porcentaje: 75 });
  });
});

const filas = [
  { alumnoId: 'tomas', periodo: '2026-05', presente: false },
  { alumnoId: 'tomas', periodo: '2026-05', presente: true },
  { alumnoId: 'tomas', periodo: '2026-04', presente: true },
  { alumnoId: 'joaquin', periodo: '2026-05', presente: true },
];

describe('contarPorAlumno', () => {
  it('cuenta cada alumno por separado', () => {
    const porAlumno = contarPorAlumno(filas);
    expect(porAlumno.get('tomas')?.dictadas).toBe(3);
    expect(porAlumno.get('joaquin')?.porcentaje).toBe(100);
  });

  it('no inventa alumnos que no aparecen en las filas', () => {
    expect(contarPorAlumno(filas).get('martina')).toBeUndefined();
  });
});

describe('contarPorPeriodo', () => {
  it('emite un punto por período pedido, aunque no tenga clases', () => {
    const serie = contarPorPeriodo(filas, ['2026-03', '2026-04', '2026-05']);
    expect(serie.get('2026-03')?.porcentaje).toBeNull();
    expect(serie.get('2026-04')?.porcentaje).toBe(100);
    expect(serie.get('2026-05')?.dictadas).toBe(3);
  });
});

describe('evaluarRiesgo', () => {
  it('marca la caída sostenida por encima del umbral', () => {
    const r = evaluarRiesgo(50, [90, 85, 80], 25);
    expect(r.enRiesgo).toBe(true);
    expect(r.referencia).toBe(85);
    expect(r.caida).toBe(35);
  });

  it('no marca una caída que no llega al umbral', () => {
    expect(evaluarRiesgo(70, [90, 85, 80], 25).enRiesgo).toBe(false);
  });

  it('el umbral es estricto: veinticinco justos no es «más de veinticinco»', () => {
    expect(evaluarRiesgo(60, [85, 85, 85], 25).caida).toBe(25);
    expect(evaluarRiesgo(60, [85, 85, 85], 25).enRiesgo).toBe(false);
  });

  it('no marca al que subió', () => {
    const r = evaluarRiesgo(95, [70, 75, 80], 25);
    expect(r.enRiesgo).toBe(false);
    expect(r.caida).toBe(-20);
  });

  it('el mes sin clases no arrastra el promedio hacia abajo', () => {
    // Enero sin actividad: si contara como cero, la referencia caería de 85 a
    // 56,7 y el alumno dejaría de estar en riesgo sin haber cambiado nada.
    const r = evaluarRiesgo(55, [85, null, 85], 25);
    expect(r.referencia).toBe(85);
    expect(r.enRiesgo).toBe(true);
  });

  it('sin historial no hay riesgo, y se dice que no se pudo comparar', () => {
    const r = evaluarRiesgo(40, [null, null, null], 25);
    expect(r.enRiesgo).toBe(false);
    expect(r.caida).toBeNull();
    expect(r.referencia).toBeNull();
  });

  it('sin clases este mes tampoco se evalúa', () => {
    expect(evaluarRiesgo(null, [90, 90, 90], 25).caida).toBeNull();
  });
});

describe('cargaPorCaballo', () => {
  const montadas = [
    { caballoId: 'gambeta', nombre: 'Gambeta', presente: true },
    { caballoId: 'gambeta', nombre: 'Gambeta', presente: true },
    { caballoId: 'gambeta', nombre: 'Gambeta', presente: false },
    { caballoId: 'malbec', nombre: 'Malbec', presente: true },
    { caballoId: null, nombre: null, presente: true },
  ];
  const previstas = [
    { caballoId: 'gambeta', nombre: 'Gambeta' },
    { caballoId: 'malbec', nombre: 'Malbec' },
    { caballoId: 'malbec', nombre: 'Malbec' },
    { caballoId: 'lucero', nombre: 'Lucero' },
  ];

  it('el caballo del alumno que faltó no trabajó', () => {
    const carga = cargaPorCaballo(montadas, previstas);
    expect(carga.find((c) => c.caballoId === 'gambeta')?.montadas).toBe(2);
  });

  it('conserva lo previsto para poder ver la sustitución', () => {
    const carga = cargaPorCaballo(montadas, previstas);
    // Gambeta se montó dos veces y sólo estaba previsto una: entró de reemplazo.
    expect(carga.find((c) => c.caballoId === 'gambeta')).toMatchObject({ montadas: 2, previstas: 1 });
    // Malbec al revés: estaba previsto dos veces y se montó una.
    expect(carga.find((c) => c.caballoId === 'malbec')).toMatchObject({ montadas: 1, previstas: 2 });
  });

  it('incluye al que estaba previsto y nunca se montó', () => {
    const lucero = cargaPorCaballo(montadas, previstas).find((c) => c.caballoId === 'lucero');
    expect(lucero).toMatchObject({ montadas: 0, previstas: 1 });
  });

  it('ordena por carga efectiva, que es lo que se vigila', () => {
    expect(cargaPorCaballo(montadas, previstas).map((c) => c.caballoId)).toEqual([
      'gambeta',
      'malbec',
      'lucero',
    ]);
  });

  it('la asistencia sin caballo no cuenta para nadie', () => {
    expect(cargaPorCaballo(montadas, previstas)).toHaveLength(3);
  });
});

describe('estadoDePlanilla', () => {
  const inscriptos = [{ alumnoId: 'a' }, { alumnoId: 'b' }, { alumnoId: 'c' }];

  it('no está completa mientras falte registrar a alguien', () => {
    const e = estadoDePlanilla(inscriptos, [
      { alumnoId: 'a', presente: true },
      { alumnoId: 'b', presente: false },
    ]);
    expect(e).toMatchObject({ inscriptos: 3, registrados: 2, presentes: 1, ausentes: 1, completa: false });
  });

  it('se completa cuando hay una fila por inscripto', () => {
    const e = estadoDePlanilla(inscriptos, [
      { alumnoId: 'a', presente: true },
      { alumnoId: 'b', presente: false },
      { alumnoId: 'c', presente: true },
    ]);
    expect(e.completa).toBe(true);
    expect(e.presentes).toBe(2);
  });

  it('una clase sin inscriptos no se cierra sola', () => {
    // Es el estado vacío del prototipo: no vino nadie porque no había nadie
    // anotado. Darla por dictada la metería en la liquidación sin respaldo.
    expect(estadoDePlanilla([], []).completa).toBe(false);
  });

  it('ignora filas de alumnos que ya no están inscriptos', () => {
    const e = estadoDePlanilla(inscriptos, [
      { alumnoId: 'a', presente: true },
      { alumnoId: 'z', presente: true },
    ]);
    expect(e.registrados).toBe(1);
  });
});

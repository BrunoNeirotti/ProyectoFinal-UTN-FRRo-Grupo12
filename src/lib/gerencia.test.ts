import { describe, expect, it } from 'vitest';
import {
  costoSanitarioMensualPromedio,
  egresoPendienteDeOrdenes,
  egresoProyectadoDeInsumos,
  ocupacionDe,
  proyectarIngresos,
  resultadoProyectado,
  simularVariacion,
  variacionPorcentual,
  type ContratoResuelto,
} from './gerencia';

describe('variacionPorcentual', () => {
  it('calcula el cambio porcentual', () => {
    expect(variacionPorcentual(110, 100)).toBeCloseTo(10);
    expect(variacionPorcentual(90, 100)).toBeCloseTo(-10);
  });

  it('no divide por cero: sin base de comparación devuelve null', () => {
    expect(variacionPorcentual(100, 0)).toBeNull();
  });
});

describe('ocupacionDe', () => {
  it('cuenta ocupados sobre el total de instalaciones', () => {
    const ocupados = new Set(['a', 'b', 'c']);
    expect(ocupacionDe(ocupados, 5)).toEqual({ ocupados: 3, total: 5, porcentaje: 60 });
  });

  it('sin instalaciones no divide por cero', () => {
    expect(ocupacionDe(new Set(), 0)).toEqual({ ocupados: 0, total: 0, porcentaje: 0 });
  });
});

describe('proyectarIngresos', () => {
  const contratos: ContratoResuelto[] = [
    { contratoId: '1', servicioId: 's1', servicioNombre: 'Pensión box', importe: 100_000, esPactado: false },
    { contratoId: '2', servicioId: 's1', servicioNombre: 'Pensión box', importe: 90_000, esPactado: true },
    { contratoId: '3', servicioId: 's2', servicioNombre: 'Clases', importe: 50_000, esPactado: false },
    { contratoId: '4', servicioId: 's2', servicioNombre: 'Clases', importe: null, esPactado: false },
  ];

  it('suma lo proyectable y agrupa por servicio', () => {
    const r = proyectarIngresos(contratos);
    expect(r.proyectado).toBe(240_000);
    expect(r.porServicio).toEqual([
      { servicioId: 's1', servicioNombre: 'Pensión box', importe: 190_000 },
      { servicioId: 's2', servicioNombre: 'Clases', importe: 50_000 },
    ]);
  });

  it('deja afuera los contratos sin tarifa ni pactado (2.a)', () => {
    const r = proyectarIngresos(contratos);
    expect(r.excluidos).toEqual([{ contratoId: '4', servicioNombre: 'Clases' }]);
  });
});

describe('simularVariacion', () => {
  const contratos: ContratoResuelto[] = [
    { contratoId: '1', servicioId: 's1', servicioNombre: 'Pensión box', importe: 100_000, esPactado: false },
    { contratoId: '2', servicioId: 's1', servicioNombre: 'Pensión box', importe: 90_000, esPactado: true },
  ];

  it('aplica la variación sólo a los contratos de tarifa, nunca a los pactados', () => {
    const r = simularVariacion(contratos, new Map([['s1', 0.1]]));
    expect(r.proyectado).toBeCloseTo(100_000 * 1.1 + 90_000);
  });

  it('sin variación declarada para el servicio, no cambia nada', () => {
    const r = simularVariacion(contratos, new Map());
    expect(r.proyectado).toBe(190_000);
  });
});

describe('egresoPendienteDeOrdenes', () => {
  it('suma lo que falta recibir de cada renglón, al precio pactado', () => {
    const total = egresoPendienteDeOrdenes([
      { cantidad: 10, cantidadRecibida: 4, precioUnitario: 1_000 },
      { cantidad: 5, cantidadRecibida: null, precioUnitario: 2_000 },
      { cantidad: 3, cantidadRecibida: 3, precioUnitario: 500 }, // ya completo, no aporta
    ]);
    expect(total).toBe(6 * 1_000 + 5 * 2_000);
  });
});

describe('egresoProyectadoDeInsumos', () => {
  it('proyecta el consumo del período al último precio de compra', () => {
    const total = egresoProyectadoDeInsumos(
      [
        { insumoId: 'i1', consumoDiario: 2, precioUnitario: 500 },
        { insumoId: 'i2', consumoDiario: 1, precioUnitario: null }, // nunca comprado: no costea
      ],
      30,
    );
    expect(total).toBe(2 * 500 * 30);
  });
});

describe('costoSanitarioMensualPromedio', () => {
  it('promedia lo aplicado sobre los meses de la ventana', () => {
    expect(costoSanitarioMensualPromedio([30_000, 45_000, 15_000], 3)).toBe(30_000);
  });

  it('sin ventana no divide por cero', () => {
    expect(costoSanitarioMensualPromedio([100], 0)).toBe(0);
  });
});

describe('resultadoProyectado', () => {
  it('abre los egresos por concepto y calcula el resultado', () => {
    const r = resultadoProyectado(500_000, { ordenesCompra: 80_000, insumos: 120_000, sanidad: 20_000 });
    expect(r.egresos.total).toBe(220_000);
    expect(r.resultado).toBe(280_000);
  });
});

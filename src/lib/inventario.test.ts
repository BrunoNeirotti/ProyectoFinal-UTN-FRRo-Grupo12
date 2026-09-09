import { describe, expect, it } from 'vitest';
import {
  type InsumoComputable,
  type InsumoConCobertura,
  type MovimientoComputable,
  coberturaEnDias,
  conUnidad,
  consumoDiario,
  diasDeVentana,
  enDias,
  estadoPorRecepcion,
  insumoConCobertura,
  insumosAReponer,
  nivelDeBarra,
  numeroDeOrden,
  pendienteDeRecibir,
  saldoDelMovimiento,
  sugerirReposicion,
  tonoDeCobertura,
  unidadPlural,
  ventanaDeConsumo,
} from './inventario';

const mov = (
  tipo: MovimientoComputable['tipo'],
  cantidad: number,
  dia: string,
): MovimientoComputable => ({ tipo, cantidad, ocurridoEn: `${dia}T12:00:00-03:00` });

const insumo = (p: Partial<InsumoComputable> = {}): InsumoComputable => ({
  id: 'viruta',
  nombre: 'Viruta de pino',
  categoria: 'cama',
  unidad: 'bolsa',
  stockActual: 40,
  stockMinimo: 60,
  ...p,
});

const conCobertura = (p: Partial<InsumoConCobertura> = {}): InsumoConCobertura => ({
  ...insumo(),
  consumoDiario: 10,
  consumoDeLaVentana: 900,
  coberturaDias: 4,
  tono: 'bad',
  bajoMinimo: true,
  llenado: 22,
  marca: 33,
  ...p,
});

describe('saldoDelMovimiento', () => {
  it('suma el ingreso, resta el egreso y respeta el signo del ajuste', () => {
    expect(saldoDelMovimiento({ tipo: 'ingreso', cantidad: 100 })).toBe(100);
    expect(saldoDelMovimiento({ tipo: 'egreso', cantidad: 100 })).toBe(-100);
    expect(saldoDelMovimiento({ tipo: 'ajuste', cantidad: -12 })).toBe(-12);
    expect(saldoDelMovimiento({ tipo: 'ajuste', cantidad: 12 })).toBe(12);
  });

  it('coincide con el disparador de la base: es la misma cuenta escrita dos veces', () => {
    // `recalcular_stock_insumo` hace ingreso → +, egreso → −, ajuste → tal cual.
    const libro: MovimientoComputable[] = [
      mov('ingreso', 120, '2026-08-05'),
      mov('egreso', 108, '2026-09-01'),
      { tipo: 'ajuste', cantidad: -12, ocurridoEn: '2026-09-02T12:00:00-03:00' },
    ];
    expect(libro.reduce((s, m) => s + saldoDelMovimiento(m), 0)).toBe(0);
  });
});

describe('diasDeVentana', () => {
  it('cuenta los dos extremos', () => {
    expect(diasDeVentana('2026-09-01', '2026-09-01')).toBe(1);
    expect(diasDeVentana('2026-09-01', '2026-09-30')).toBe(30);
  });

  it('cruza el cambio de horario sin perder ni ganar un día', () => {
    // Argentina no cambia la hora, pero la cuenta se hace en UTC justamente
    // para que un país que sí la cambiara no corriera el promedio.
    expect(diasDeVentana('2026-03-01', '2026-03-31')).toBe(31);
  });

  it('devuelve cero si la ventana está al revés o la fecha no se entiende', () => {
    expect(diasDeVentana('2026-09-30', '2026-09-01')).toBe(0);
    expect(diasDeVentana('ayer', '2026-09-01')).toBe(0);
  });
});

describe('ventanaDeConsumo', () => {
  it('son noventa días contando el de cierre', () => {
    const v = ventanaDeConsumo('2026-09-09');
    expect(diasDeVentana(v.desde, v.hasta)).toBe(90);
    expect(v.hasta).toBe('2026-09-09');
  });
});

describe('consumoDiario', () => {
  it('promedia los egresos sobre todos los días de la ventana, no sobre los que tuvieron movimiento', () => {
    const movs = [mov('egreso', 100, '2026-09-01'), mov('egreso', 200, '2026-09-05')];
    // 300 en diez días son 30 por día, aunque sólo dos días tengan asiento.
    expect(consumoDiario(movs, '2026-09-01', '2026-09-10')).toBe(30);
  });

  it('ignora los ingresos: comprar no es consumir', () => {
    const movs = [mov('ingreso', 1000, '2026-09-01'), mov('egreso', 100, '2026-09-02')];
    expect(consumoDiario(movs, '2026-09-01', '2026-09-10')).toBe(10);
  });

  it('ignora el ajuste aunque reste, porque no es uso sino corrección', () => {
    const movs = [
      mov('egreso', 100, '2026-09-02'),
      { tipo: 'ajuste' as const, cantidad: -50, ocurridoEn: '2026-09-03T12:00:00-03:00' },
    ];
    // Con el ajuste adentro el promedio daría 15 y diría que se gasta más de lo
    // que se gasta, que es justo lo que arruinaría la cobertura.
    expect(consumoDiario(movs, '2026-09-01', '2026-09-10')).toBe(10);
  });

  it('deja afuera lo que cayó antes o después de la ventana', () => {
    const movs = [
      mov('egreso', 999, '2026-08-31'),
      mov('egreso', 100, '2026-09-05'),
      mov('egreso', 999, '2026-09-11'),
    ];
    expect(consumoDiario(movs, '2026-09-01', '2026-09-10')).toBe(10);
  });

  it('sin movimientos da cero, no una división por cero', () => {
    expect(consumoDiario([], '2026-09-01', '2026-09-10')).toBe(0);
  });
});

describe('coberturaEnDias', () => {
  it('divide la existencia por el consumo y redondea para abajo', () => {
    expect(coberturaEnDias(40, 10)).toBe(4);
    expect(coberturaEnDias(45, 10)).toBe(4); // cuatro días y medio no son cinco
  });

  it('sin consumo no hay cobertura estimable, y eso no es lo mismo que infinita', () => {
    expect(coberturaEnDias(500, 0)).toBeNull();
  });

  it('con la existencia agotada o en negativo la cobertura es cero', () => {
    expect(coberturaEnDias(0, 10)).toBe(0);
    expect(coberturaEnDias(-20, 10)).toBe(0);
  });
});

describe('tonoDeCobertura', () => {
  it('reproduce el semáforo del prototipo', () => {
    expect(tonoDeCobertura(4)).toBe('bad'); // viruta
    expect(tonoDeCobertura(20)).toBe('warn'); // antiparasitario
    expect(tonoDeCobertura(24)).toBe('ok'); // pastura
    expect(tonoDeCobertura(36)).toBe('ok'); // avena
  });

  it('toma el día del corte como parte del tramo que empieza', () => {
    expect(tonoDeCobertura(6)).toBe('bad');
    expect(tonoDeCobertura(7)).toBe('warn');
    expect(tonoDeCobertura(20)).toBe('warn');
    expect(tonoDeCobertura(21)).toBe('ok');
  });

  it('sin cobertura estimable el distintivo queda neutro y no verde', () => {
    expect(tonoDeCobertura(null)).toBe('neutro');
  });
});

describe('nivelDeBarra', () => {
  it('pone la marca del mínimo en el tercio', () => {
    const { llenado, marca } = nivelDeBarra(60, 60);
    expect(marca).toBeCloseTo(33.33, 1);
    expect(llenado).toBeCloseTo(33.33, 1);
  });

  it('con existencia por debajo del mínimo, el llenado queda antes de la marca', () => {
    const { llenado, marca } = nivelDeBarra(40, 60);
    expect(llenado).toBeLessThan(marca!);
  });

  it('deja la barra a mitad de camino cuando el stock duplica el mínimo', () => {
    const { llenado, marca } = nivelDeBarra(340, 150);
    expect(llenado).toBeCloseTo(75.6, 1);
    expect(marca).toBeCloseTo(33.33, 1);
  });

  it('nunca desborda: si el stock supera la escala, la escala se estira', () => {
    const { llenado, marca } = nivelDeBarra(500, 150);
    expect(llenado).toBe(100);
    expect(marca).toBeCloseTo(30, 1); // la marca se corre a la izquierda
  });

  it('sin mínimo cargado no hay marca, que no es lo mismo que una marca en cero', () => {
    expect(nivelDeBarra(100, 0).marca).toBeNull();
  });

  it('con todo en cero no divide por cero', () => {
    expect(nivelDeBarra(0, 0)).toEqual({ llenado: 0, marca: null });
  });
});

describe('insumoConCobertura', () => {
  it('arma la fila completa de la tabla', () => {
    const movs = [mov('egreso', 900, '2026-08-15')];
    const fila = insumoConCobertura(insumo(), movs, '2026-06-12', '2026-09-09');

    expect(fila.consumoDiario).toBe(10);
    expect(fila.consumoDeLaVentana).toBe(900);
    expect(fila.coberturaDias).toBe(4);
    expect(fila.tono).toBe('bad');
    expect(fila.bajoMinimo).toBe(true);
  });

  it('marca bajo mínimo aunque la cobertura esté holgada, y no le cambia el tono', () => {
    // El antiparasitario del prototipo: 6 dosis contra un mínimo de 10, y aun
    // así veinte días por delante porque casi no se usa.
    const movs = [mov('egreso', 27, '2026-06-15')];
    const fila = insumoConCobertura(
      insumo({ id: 'ivermectina', stockActual: 6, stockMinimo: 10, unidad: 'dosis' }),
      movs,
      '2026-06-12',
      '2026-09-09',
    );

    expect(fila.bajoMinimo).toBe(true);
    expect(fila.tono).toBe('warn');
  });
});

describe('sugerirReposicion', () => {
  it('compra lo que falta para cubrir los días configurados', () => {
    expect(sugerirReposicion({ stockActual: 40, stockMinimo: 60, consumoDiario: 10 }, 30)).toBe(260);
  });

  it('nunca compra menos que lo que falta para el mínimo', () => {
    // Un insumo que casi no se usa: treinta días de consumo son dos dosis, pero
    // el mínimo declarado son diez y tiene que estar el día del ciclo.
    expect(sugerirReposicion({ stockActual: 6, stockMinimo: 10, consumoDiario: 0.05 }, 30)).toBe(4);
  });

  it('redondea para arriba, porque no se compran fracciones de bolsa', () => {
    expect(sugerirReposicion({ stockActual: 0, stockMinimo: 0, consumoDiario: 1.1 }, 3)).toBe(4);
  });

  it('no propone nada si sobra', () => {
    expect(sugerirReposicion({ stockActual: 500, stockMinimo: 60, consumoDiario: 10 }, 30)).toBe(0);
  });
});

describe('insumosAReponer', () => {
  it('junta al que está bajo mínimo y al que se queda sin días, que no son el mismo', () => {
    const bajoMinimo = conCobertura({ id: 'viruta' });
    const sinDias = conCobertura({
      id: 'balanceado',
      stockActual: 180,
      stockMinimo: 100,
      bajoMinimo: false,
      consumoDiario: 40,
      coberturaDias: 4,
      tono: 'bad',
    });

    expect(insumosAReponer([bajoMinimo, sinDias], 30).map((r) => r.insumo.id)).toEqual([
      'viruta',
      'balanceado',
    ]);
  });

  it('deja afuera al que está holgado', () => {
    const holgado = conCobertura({
      id: 'avena',
      stockActual: 340,
      stockMinimo: 150,
      bajoMinimo: false,
      consumoDiario: 9,
      coberturaDias: 37,
      tono: 'ok',
    });
    expect(insumosAReponer([holgado], 30)).toEqual([]);
  });

  it('no arma renglones en cero', () => {
    // Entra por el semáforo -veinte días es tramo de atención- pero no está
    // bajo mínimo, y lo que hay ya cubre exactamente el objetivo configurado.
    // Sin el filtro final la orden traería un renglón pidiendo cero.
    const alRas = conCobertura({
      stockActual: 100,
      stockMinimo: 10,
      consumoDiario: 5,
      coberturaDias: 20,
      tono: 'warn',
      bajoMinimo: false,
    });
    expect(insumosAReponer([alRas], 20)).toEqual([]);
  });

  it('un insumo bajo mínimo siempre pide algo, porque el mínimo es el piso del objetivo', () => {
    const raspando = conCobertura({ stockActual: 999, stockMinimo: 1000, consumoDiario: 1 });
    expect(insumosAReponer([raspando], 30)[0]?.cantidad).toBe(1);
  });
});

describe('pendienteDeRecibir', () => {
  it('descuenta lo ya recibido', () => {
    expect(pendienteDeRecibir({ cantidad: 100, cantidadRecibida: 40 })).toBe(60);
  });

  it('sin recepción todavía, falta todo', () => {
    expect(pendienteDeRecibir({ cantidad: 100, cantidadRecibida: null })).toBe(100);
  });

  it('una entrega de más no deja un pendiente negativo', () => {
    expect(pendienteDeRecibir({ cantidad: 100, cantidadRecibida: 120 })).toBe(0);
  });
});

describe('estadoPorRecepcion', () => {
  const renglon = (cantidad: number, cantidadRecibida: number | null) => ({
    cantidad,
    cantidadRecibida,
  });

  it('con todo entregado la orden está recibida', () => {
    expect(estadoPorRecepcion([renglon(100, 100), renglon(50, 50)])).toBe('recibida');
  });

  it('con parte entregada queda parcialmente recibida', () => {
    expect(estadoPorRecepcion([renglon(100, 100), renglon(50, 0)])).toBe('parcialmente_recibida');
  });

  it('un renglón a medias también deja la orden parcial', () => {
    expect(estadoPorRecepcion([renglon(100, 60)])).toBe('parcialmente_recibida');
  });

  it('sin nada recibido sigue enviada, y una recepción borrada la devuelve ahí', () => {
    expect(estadoPorRecepcion([renglon(100, null), renglon(50, null)])).toBe('enviada');
    expect(estadoPorRecepcion([renglon(100, 0)])).toBe('enviada');
  });

  it('una entrega de más cierra el renglón igual', () => {
    expect(estadoPorRecepcion([renglon(100, 120)])).toBe('recibida');
  });
});

describe('numeroDeOrden', () => {
  it('es el rótulo que se le dice al proveedor', () => {
    expect(numeroDeOrden(2026, 18)).toBe('OC 2026-018');
  });

  it('no recorta la serie cuando pasa de mil', () => {
    expect(numeroDeOrden(2026, 1042)).toBe('OC 2026-1042');
  });
});

describe('unidadPlural', () => {
  it('pluraliza lo que termina en vocal', () => {
    expect(unidadPlural(2, 'bolsa')).toBe('bolsas');
    expect(unidadPlural(128, 'fardo')).toBe('fardos');
    expect(unidadPlural(320, 'metro')).toBe('metros');
  });

  it('deja en singular la cantidad uno, en los dos signos', () => {
    expect(unidadPlural(1, 'bolsa')).toBe('bolsa');
    expect(unidadPlural(-1, 'bolsa')).toBe('bolsa');
  });

  it('no toca las abreviaturas, que no pluralizan', () => {
    expect(unidadPlural(40, 'kg')).toBe('kg');
    expect(unidadPlural(500, 'ml')).toBe('ml');
    expect(unidadPlural(3, 'l')).toBe('l');
  });

  it('deja igual lo que ya termina en s o en z', () => {
    expect(unidadPlural(13, 'dosis')).toBe('dosis');
    expect(unidadPlural(2, 'litros')).toBe('litros');
  });

  it('agrega «es» a lo que termina en consonante', () => {
    expect(unidadPlural(4, 'tambor')).toBe('tambores');
    expect(unidadPlural(0, 'unidad')).toBe('unidades');
  });
});

describe('conUnidad', () => {
  it('junta el número y la unidad como se lee', () => {
    expect(conUnidad(40, 'bolsa')).toBe('40 bolsas');
    expect(conUnidad(1, 'bolsa')).toBe('1 bolsa');
    expect(conUnidad(452.5, 'kg')).toBe('452,5 kg');
  });
});

describe('enDias', () => {
  it('no dice «1 días»', () => {
    expect(enDias(1)).toBe('1 día');
    expect(enDias(41)).toBe('41 días');
    expect(enDias(0)).toBe('0 días');
  });
});

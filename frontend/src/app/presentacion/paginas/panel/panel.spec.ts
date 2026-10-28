import { TestBed } from '@angular/core/testing';

import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { casosDeUso } from '../../../app.config';
import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../../dominio/puertos/simulador.repositorio';
import { Panel } from './panel';

// Promesa que la prueba resuelve cuando quiere, para decidir el orden de llegada de las respuestas.
function diferida<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<T>((ok, mal) => ((resolver = ok), (rechazar = mal)));
  return { promesa, resolver, rechazar };
}

interface PanelExpuesto {
  simular: (configuracion: object) => Promise<void>;
  resultado: () => ResultadoSimulacion | null;
  simulando: () => boolean;
  error: () => string | null;
}

interface Indicadores {
  resultado: { set: (r: ResultadoSimulacion) => void };
  diaVivo: { set: (dia: number) => void };
  indicadores: () => { etiqueta: string; valor: string }[];
}

describe('Panel: simulaciones que se cruzan', () => {
  let pendientes: ReturnType<typeof diferida<ResultadoSimulacion>>[];

  beforeEach(async () => {
    pendientes = [];
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => {
        const d = diferida<ResultadoSimulacion>();
        pendientes.push(d);
        return d.promesa;
      },
      difusion: () => Promise.reject(new Error('sin EDP en esta prueba')),
    };
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    }).compileComponents();
  });

  function panel(): PanelExpuesto {
    return TestBed.createComponent(Panel).componentInstance as unknown as PanelExpuesto;
  }

  const vieja = { ...resultadoDePrueba, repeticiones: 11 };
  const nueva = { ...resultadoDePrueba, repeticiones: 22 };

  it('una respuesta vieja que llega tarde no reemplaza a la más reciente', async () => {
    const p = panel();
    const primera = p.simular({ repeticiones: 11 });
    const segunda = p.simular({ repeticiones: 22 });
    pendientes[1].resolver(nueva);
    await segunda;
    pendientes[0].resolver(vieja);
    await primera;
    expect(p.resultado()?.repeticiones).toBe(22);
    expect(p.simulando()).toBe(false);
  });

  it('sigue simulando mientras la petición vigente no termina', async () => {
    const p = panel();
    const primera = p.simular({ repeticiones: 11 });
    const segunda = p.simular({ repeticiones: 22 });
    pendientes[0].resolver(vieja);
    await primera;
    expect(p.resultado()).toBeNull();
    expect(p.simulando()).toBe(true);
    pendientes[1].resolver(nueva);
    await segunda;
    expect(p.resultado()?.repeticiones).toBe(22);
    expect(p.simulando()).toBe(false);
  });

  it('el error de una petición vieja no se muestra', async () => {
    const p = panel();
    const primera = p.simular({ repeticiones: 11 });
    const segunda = p.simular({ repeticiones: 22 });
    pendientes[1].resolver(nueva);
    await segunda;
    pendientes[0].rechazar(new Error('se cayó la vieja'));
    await primera;
    expect(p.error()).toBeNull();
    expect(p.resultado()?.repeticiones).toBe(22);
  });
});

describe('Panel: indicadores en vivo', () => {
  beforeEach(async () => {
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => Promise.resolve(resultadoDePrueba),
      difusion: () => Promise.reject(new Error('sin EDP en esta prueba')),
    };
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    }).compileComponents();
  });

  // Mordidos acumulados por día (un barrio): sin intervenir y con el plan recomendado.
  const conSeries: ResultadoSimulacion = {
    ...resultadoDePrueba,
    planes: resultadoDePrueba.planes.map((p) => ({
      ...p,
      mapaAfectados: p.id === 'ninguna' ? [[5], [300], [2000], [4637]] : [[5], [50], [150], [212]],
    })),
  };

  function valores(dia: number): string[] {
    const p = TestBed.createComponent(Panel).componentInstance as unknown as Indicadores;
    p.resultado.set(conSeries);
    p.diaVivo.set(dia);
    return p
      .indicadores()
      .slice(1)
      .map((i) => i.valor);
  }

  it('cuentan lo ocurrido hasta el día que muestra el mapa', () => {
    expect(valores(1)).toEqual(['300', '50', '250']);
  });

  it('en el último día muestran los totales de la simulación', () => {
    expect(valores(3)).toEqual(['4.637', '212', '4.425']);
  });
});

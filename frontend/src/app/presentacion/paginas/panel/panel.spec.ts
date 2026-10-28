import { TestBed } from '@angular/core/testing';

import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { casosDeUso } from '../../../app.config';
import { ResultadoDifusion, ResultadoSimulacion } from '../../../dominio/modelos/resultado';
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

describe('Panel: menú lateral', () => {
  async function renderizar() {
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => Promise.reject(new Error('no se usa')),
      difusion: () => Promise.reject(new Error('no se usa')),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(Panel);
    await fixture.whenStable();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  const activos = (raiz: HTMLElement) =>
    [...raiz.querySelectorAll('.nav-item.active')].map((a) => a.getAttribute('href'));

  it('resalta el enlace elegido en lugar de dejar siempre «Dashboard»', async () => {
    const { fixture, raiz } = await renderizar();
    expect(activos(raiz)).toEqual(['#dashboard']);
    expect(raiz.querySelector('.nav-item[href="#dashboard"]')!.getAttribute('aria-current')).toBe('location');

    raiz.querySelector<HTMLAnchorElement>('.nav-item[href="#estrategias"]')!.click();
    await fixture.whenStable();
    expect(activos(raiz)).toEqual(['#estrategias']);
    expect(raiz.querySelector('.nav-item[href="#estrategias"]')!.getAttribute('aria-current')).toBe('location');
    expect(raiz.querySelector('.nav-item[href="#dashboard"]')!.hasAttribute('aria-current')).toBe(false);

    raiz.querySelector<HTMLAnchorElement>('.brand')!.click();
    await fixture.whenStable();
    expect(activos(raiz)).toEqual(['#dashboard']);
  });

  it('al plegar la barra conserva el punto y el estado real de la API', async () => {
    const { fixture, raiz } = await renderizar();
    raiz.querySelector<HTMLButtonElement>('.sidebar-toggle')!.click();
    await fixture.whenStable();
    expect(raiz.querySelector('.app-shell')!.classList).toContain('sidebar-plegada');
    const punto = raiz.querySelector('.status-card .status-dot')!;
    expect(punto.classList).not.toContain('apagado');
    expect(raiz.querySelector('.status-card')!.getAttribute('title')).toBe('API conectada');
    expect(raiz.querySelector('.status-texto strong')!.textContent).toBe('API conectada');
  });
});

describe('Panel: selector de modelo del mapa', () => {
  let difusiones: number;

  // Solo lo que usa la comparación: los infectados de cada escenario de la EDP.
  const difusion = {
    escenarios: [
      { id: 'ninguna', infectadosTotal: 8000 },
      { id: 'vacunacion_zonal', infectadosTotal: 7500 },
    ],
  } as unknown as ResultadoDifusion;

  interface Selector {
    simular: (configuracion: object) => Promise<void>;
    elegirModelo: (modelo: 'red' | 'edp') => void;
    calcularDifusion: () => Promise<void>;
    difusion: () => ResultadoDifusion | null;
    contraste: () => { filas: { salvados: string }[]; veces: number | null } | null;
  }

  beforeEach(async () => {
    difusiones = 0;
    const simulador: SimuladorRepositorio = {
      parametros: () => Promise.resolve(parametrosDePrueba),
      simular: () => Promise.resolve(resultadoDePrueba),
      difusion: () => {
        difusiones++;
        return Promise.resolve(difusion);
      },
    };
    await TestBed.configureTestingModule({
      imports: [Panel],
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    }).compileComponents();
  });

  const panelSelector = () =>
    TestBed.createComponent(Panel).componentInstance as unknown as Selector;

  it('al elegir la EDP la calcula una sola vez y compara los dos modelos', async () => {
    const p = panelSelector();
    await p.simular({});
    p.elegirModelo('edp');
    await p.calcularDifusion();
    p.elegirModelo('red');
    p.elegirModelo('edp');
    expect(difusiones).toBe(2); // la llamada al elegir y la de la prueba; volver a elegirla no recalcula
    const c = p.contraste()!;
    expect(c.filas[1].salvados).toBe('500');
    expect(c.veces).toBeGreaterThan(1);
  });

  it('una simulación nueva descarta la EDP del escenario anterior', async () => {
    const p = panelSelector();
    await p.simular({});
    await p.calcularDifusion();
    expect(p.difusion()).not.toBeNull();
    await p.simular({});
    expect(p.difusion()).toBeNull();
    expect(p.contraste()).toBeNull();
  });
});

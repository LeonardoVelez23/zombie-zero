import { TestBed } from '@angular/core/testing';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { MapaBarrios, nivelDe } from './mapa-barrios';

// Dos barrios de 100 personas, tres días: sin intervenir llegan a 40 y 60 mordidos; con el plan, a 2 y 4.
const resultado: ResultadoSimulacion = {
  ...resultadoDePrueba,
  barrios: ['Tarqui', 'Manta'],
  poblacionBarrio: [100, 100],
  planes: resultadoDePrueba.planes.map((p) => ({
    ...p,
    mapaAfectados:
      p.id === 'anillo'
        ? [
            [1, 0],
            [2, 2],
            [2, 4],
          ]
        : [
            [1, 0],
            [10, 20],
            [40, 60],
          ],
  })),
};

describe('Mapa del brote por barrio', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function renderizar() {
    const fixture = TestBed.createComponent(MapaBarrios);
    fixture.componentRef.setInput('resultado', resultado);
    fixture.detectChanges();
    const panel = fixture.nativeElement as HTMLElement;
    const texto = () => panel.textContent?.replace(/\s+/g, ' ') ?? '';
    // El brote se reproduce solo: se adelanta hasta el último día.
    const terminar = () => {
      vi.advanceTimersByTime(240);
      fixture.detectChanges();
    };
    return { fixture, panel, texto, terminar };
  }

  it('muestra el último día del plan recomendado frente a no intervenir', () => {
    const { texto, terminar } = renderizar();
    terminar();
    expect(texto()).toContain('Día 2 de 2');
    expect(texto()).toContain(
      'con anillo está mordido el 3 % de la ciudad frente al 50 % sin intervenir',
    );
    expect(texto()).toContain('Tarqui2 %');
  });

  it('al elegir otro plan cambian los barrios', () => {
    const { fixture, panel, texto, terminar } = renderizar();
    terminar();
    [...panel.querySelectorAll<HTMLButtonElement>('.plan')]
      .find((b) => b.textContent?.includes('Sin intervenir'))!
      .click();
    fixture.detectChanges();
    expect(texto()).toContain('con ningún plan está mordido el 50 %');
    expect(texto()).toContain('Manta60 %');
  });

  it('con una simulación nueva el brote se reproduce en vivo desde el día 0', () => {
    const { texto, terminar } = renderizar();
    expect(texto()).toContain('Día 0 de 2');
    expect(texto()).toContain('EN VIVO · DÍA 0');
    terminar();
    expect(texto()).toContain('Día 2 de 2');
    expect(texto()).toContain('PAUSA · DÍA 2');
  });

  it('se puede volver a reproducir desde el principio', () => {
    const { fixture, panel, texto, terminar } = renderizar();
    terminar();
    panel.querySelector<HTMLButtonElement>('.reproduccion .boton')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Día 0 de 2');
    terminar();
    expect(texto()).toContain('Día 2 de 2');
  });

  it('colorea según la fracción mordida', () => {
    expect(nivelDe(0.01).nombre).toBe('Contenido');
    expect(nivelDe(0.1).nombre).toBe('En alerta');
    expect(nivelDe(0.44).nombre).toBe('Fuera de control');
  });
});

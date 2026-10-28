import { TestBed } from '@angular/core/testing';

import { ResultadoDifusion } from '../../../dominio/modelos/resultado';
import { Mapa } from './mapa';

// Tres días de un escenario mínimo; en jsdom MapLibre no se crea (sin WebGL), pero la
// animación solo mueve el día elegido.
const difusion: ResultadoDifusion = {
  parametros: { dSanos: 0.1, dZombies: 0.05, alfa: 0.02, beta: 0.5, sigma: 0.3, gamma: 0.2 },
  malla: { lonMin: -80.8, lonMax: -80.6, latMin: -1.0, latMax: -0.9, dxKm: 0.5, filas: 1, columnas: 1 },
  aeropuerto: [-80.68, -0.95],
  escenarios: [
    {
      id: 'ninguna',
      nombre: 'Sin intervención',
      serie: { S: [10, 9, 8], E: [0, 1, 1], Z: [0, 0, 1], R: [0, 0, 0] },
      infectadosTotal: 2,
      pico: 1,
      diaPico: 2,
      vacunasUsadas: 0,
      fotogramas: [0, 1, 2].map((dia) => ({ dia, zombies: [[dia]] })),
    },
  ],
};

describe('Mapa animado', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function renderizar() {
    const fixture = TestBed.createComponent(Mapa);
    fixture.componentRef.setInput('resultado', difusion);
    fixture.detectChanges();
    const panel = fixture.nativeElement as HTMLElement;
    const boton = () => panel.querySelector<HTMLButtonElement>('.reproduccion button')!;
    return { fixture, panel, boton };
  }

  it('avanza día por día y se detiene en el último', () => {
    const { fixture, panel, boton } = renderizar();
    expect(panel.textContent).toContain('Día 0');

    boton().click();
    fixture.detectChanges();
    expect(boton().textContent).toContain('Pausa');

    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Día 1');

    vi.advanceTimersByTime(800);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Día 2');
    expect(boton().textContent).toContain('Reproducir');
  });

  it('desde el último día vuelve a empezar', () => {
    const { fixture, panel, boton } = renderizar();
    boton().click();
    vi.advanceTimersByTime(1200);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Día 2');

    boton().click();
    fixture.detectChanges();
    expect(panel.textContent).toContain('Día 0');
  });
});

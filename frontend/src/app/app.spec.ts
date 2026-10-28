import { TestBed } from '@angular/core/testing';

import { parametrosDePrueba, resultadoDePrueba } from '../testing/datos';
import { App } from './app';
import { casosDeUso } from './app.config';
import { SimuladorRepositorio } from './dominio/puertos/simulador.repositorio';

// Adaptador falso del puerto: la interfaz se prueba sin HTTP.
const simuladorFalso: SimuladorRepositorio = {
  parametros: () => Promise.resolve(parametrosDePrueba),
  simular: () => Promise.resolve(resultadoDePrueba),
  difusion: () => Promise.reject(new Error('sin EDP en esta prueba')),
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: SimuladorRepositorio, useValue: simuladorFalso }, ...casosDeUso],
    }).compileComponents();
  });

  async function renderizar() {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return { fixture, pagina: fixture.nativeElement as HTMLElement };
  }

  it('muestra el centro de control con los parámetros de la API', async () => {
    const { pagina } = await renderizar();
    expect(pagina.querySelector('h1')?.textContent).toContain('Centro de control');
    expect(pagina.textContent).toContain('API conectada');
    expect(pagina.querySelector<HTMLInputElement>('#nPersonas')?.value).toBe('10000');
  });

  it('al simular llena la tabla y la recomendación', async () => {
    const { fixture, pagina } = await renderizar();

    pagina.querySelector<HTMLButtonElement>('.run-button')?.click();
    await fixture.whenStable();

    expect(pagina.querySelectorAll('app-tabla tbody tr')).toHaveLength(3);
    expect(pagina.querySelector('app-tabla tr.recomendado')?.textContent).toContain('anillo');
    expect(pagina.querySelector('app-informe')?.textContent).toContain('Recomendación sólida');
  });
});

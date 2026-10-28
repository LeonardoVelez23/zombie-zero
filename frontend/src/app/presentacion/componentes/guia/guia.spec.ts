import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { parametrosDePrueba, resultadoDePrueba } from '../../../../testing/datos';
import { casosDeUso } from '../../../app.config';
import { SimuladorRepositorio } from '../../../dominio/puertos/simulador.repositorio';
import { Panel } from '../../paginas/panel/panel';
import { Guia } from './guia';
import { PASOS_GUIA } from './pasos-guia';
import { CLAVE_GUIA } from './preferencia-guia';

const TOTAL = PASOS_GUIA.length;

async function renderizarGuia() {
  const fixture = TestBed.createComponent(Guia);
  await fixture.whenStable();
  const raiz = fixture.nativeElement as HTMLElement;
  const estable = () => fixture.whenStable();
  const boton = (selector: string) => raiz.querySelector<HTMLButtonElement>(selector);
  const pulsar = async (selector: string) => {
    boton(selector)!.click();
    await estable();
  };
  return { fixture, raiz, boton, pulsar, estable };
}

describe('Guía interactiva', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('no se abre sola: solo aparece el botón «Ver recorrido»', async () => {
    const { raiz } = await renderizarGuia();
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(raiz.querySelector('.guia-boton')?.textContent).toContain('Ver recorrido');
    expect(raiz.querySelector('.guia-nuevo')).not.toBeNull();
  });

  it('avanza, retrocede e indica el paso actual y el total', async () => {
    const { raiz, boton, pulsar } = await renderizarGuia();
    await pulsar('.guia-boton');
    const progreso = () => raiz.querySelector('.guia-progreso')!.textContent!.trim();
    expect(progreso()).toBe(`Paso 1 de ${TOTAL}`);
    expect(raiz.querySelector('#guia-titulo')!.textContent).toBe(PASOS_GUIA[0].titulo);
    expect(boton('.guia-secundario')!.disabled).toBe(true);

    await pulsar('.guia-principal');
    expect(progreso()).toBe(`Paso 2 de ${TOTAL}`);
    expect(raiz.querySelector('#guia-titulo')!.textContent).toBe(PASOS_GUIA[1].titulo);

    await pulsar('.guia-secundario');
    expect(progreso()).toBe(`Paso 1 de ${TOTAL}`);
  });

  it('saltar cierra la guía y lo recuerda', async () => {
    const { raiz, pulsar } = await renderizarGuia();
    await pulsar('.guia-boton');
    await pulsar('.guia-saltar');
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem(CLAVE_GUIA)).toBe('saltada');
    expect(raiz.querySelector('.guia-nuevo')).toBeNull();
  });

  it('el último paso ofrece «Finalizar» y guarda la guía como completada', async () => {
    const { raiz, boton, pulsar } = await renderizarGuia();
    await pulsar('.guia-boton');
    for (let i = 1; i < TOTAL; i++) await pulsar('.guia-principal');
    expect(boton('.guia-principal')!.textContent).toContain('Finalizar');
    expect(boton('.guia-saltar')).toBeNull();
    await pulsar('.guia-principal');
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem(CLAVE_GUIA)).toBe('completada');
  });

  it('se puede volver a abrir aunque ya se haya completado, desde el primer paso', async () => {
    localStorage.setItem(CLAVE_GUIA, 'completada');
    const { raiz, pulsar } = await renderizarGuia();
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(raiz.querySelector('.guia-nuevo')).toBeNull();
    await pulsar('.guia-boton');
    await pulsar('.guia-principal');
    await pulsar('.guia-cerrar');
    await pulsar('.guia-boton');
    expect(raiz.querySelector('.guia-progreso')!.textContent!.trim()).toBe(`Paso 1 de ${TOTAL}`);
  });

  it('Escape cierra y las flechas navegan', async () => {
    const { raiz, pulsar, estable } = await renderizarGuia();
    await pulsar('.guia-boton');
    const tarjeta = raiz.querySelector('.guia-tarjeta')!;
    tarjeta.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await estable();
    expect(raiz.querySelector('.guia-progreso')!.textContent!.trim()).toBe(`Paso 2 de ${TOTAL}`);
    tarjeta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await estable();
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(raiz.querySelector('.guia-boton'));
  });

  it('funciona aunque el almacenamiento local no esté disponible', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { raiz, pulsar } = await renderizarGuia();
    await pulsar('.guia-boton');
    await pulsar('.guia-saltar');
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();
    await pulsar('.guia-boton');
    expect(raiz.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('resalta el elemento del paso cuando está a la vista', async () => {
    const objetivo = document.createElement('div');
    objetivo.className = 'metrics-grid';
    document.body.appendChild(objetivo);
    vi.spyOn(objetivo, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 100, y: 100, width: 300, height: 80 }),
    );
    try {
      const { raiz, pulsar } = await renderizarGuia();
      await pulsar('.guia-boton');
      expect(raiz.querySelector('.guia-foco')).toBeNull();
      const indice = PASOS_GUIA.findIndex((p) => p.objetivos.includes('.metrics-grid'));
      for (let i = 0; i < indice; i++) await pulsar('.guia-principal');
      const foco = raiz.querySelector<HTMLElement>('.guia-foco');
      expect(foco).not.toBeNull();
      expect(foco!.style.width).toBe('312px');
    } finally {
      objetivo.remove();
    }
  });
});

describe('Guía dentro del panel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('recorrerla, saltarla o finalizarla no simula ni cambia datos', async () => {
    const simulador = {
      parametros: vi.fn(async () => parametrosDePrueba),
      simular: vi.fn(async () => resultadoDePrueba),
      difusion: vi.fn(async () => {
        throw new Error('no se usa');
      }),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SimuladorRepositorio, useValue: simulador }, ...casosDeUso],
    });
    const fixture = TestBed.createComponent(Panel);
    await fixture.whenStable();
    const raiz = fixture.nativeElement as HTMLElement;
    const pulsar = async (selector: string) => {
      raiz.querySelector<HTMLButtonElement>(selector)!.click();
      await fixture.whenStable();
    };
    const valores = () =>
      [...raiz.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#simulacion input, #simulacion select')].map(
        (c) => c.value,
      );
    const antes = valores();
    expect(antes.length).toBeGreaterThan(0);

    // La guía está en la barra superior y no se abre sola.
    expect(raiz.querySelector('.topbar-right app-guia .guia-boton')).not.toBeNull();
    expect(raiz.querySelector('[role="dialog"]')).toBeNull();

    await pulsar('.guia-boton');
    for (let i = 1; i < TOTAL; i++) await pulsar('.guia-principal');
    await pulsar('.guia-principal');
    await pulsar('.guia-boton');
    await pulsar('.guia-principal');
    await pulsar('.guia-saltar');

    expect(simulador.simular).not.toHaveBeenCalled();
    expect(simulador.difusion).not.toHaveBeenCalled();
    expect(simulador.parametros).toHaveBeenCalledTimes(1);
    expect(valores()).toEqual(antes);
    expect(raiz.querySelector('.estado-badge')!.textContent).toContain('SIN SIMULAR');
    expect(raiz.querySelector('.production-badge')!.textContent!.trim()).toBe('PRODUCCIÓN');
  });
});

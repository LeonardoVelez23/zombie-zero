import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { RelojBrote } from '../../servicios/reloj-brote';
import { LineaTiempo } from './linea-tiempo';

describe('Línea de tiempo del brote', () => {
  function renderizar() {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(resultadoDePrueba.escenario.dias);
    reloj.irA(resultadoDePrueba.escenario.dias);
    const fixture = TestBed.createComponent(LineaTiempo);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const texto = () => raiz.textContent?.replace(/\s+/g, ' ') ?? '';
    const dia = () =>
      `${raiz.querySelector('.dia strong')?.textContent?.trim()} ${raiz.querySelector('.dia small')?.textContent?.trim()}`;
    return { fixture, raiz, texto, dia, reloj };
  }

  it('sin resultado no muestra nada', () => {
    const fixture = TestBed.createComponent(LineaTiempo);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.linea-tiempo')).toBeNull();
  });

  it('muestra el día actual y el total', () => {
    const { texto, dia } = renderizar();
    expect(texto()).toContain('PAUSA');
    expect(dia()).toBe('Día 3 de 3');
  });

  it('el deslizador mueve el reloj compartido', () => {
    const { fixture, raiz, dia, reloj } = renderizar();
    const deslizador = raiz.querySelector<HTMLInputElement>('input[type="range"]')!;
    deslizador.value = '1';
    deslizador.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(reloj.dia()).toBe(1);
    expect(dia()).toBe('Día 1 de 3');
  });

  it('los hitos saltan a su día', () => {
    const { fixture, raiz, reloj } = renderizar();
    [...raiz.querySelectorAll<HTMLButtonElement>('.hito')]
      .find((b) => b.textContent?.includes('Inicio'))!
      .click();
    fixture.detectChanges();
    expect(reloj.dia()).toBe(0);
  });

  it('el botón reproduce y pausa', () => {
    vi.useFakeTimers();
    try {
      const { fixture, raiz, texto, reloj } = renderizar();
      const boton = raiz.querySelector<HTMLButtonElement>('.reproducir')!;
      boton.click();
      fixture.detectChanges();
      expect(reloj.reproduciendo()).toBe(true);
      expect(texto()).toContain('EN VIVO');
      boton.click();
      fixture.detectChanges();
      expect(reloj.reproduciendo()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

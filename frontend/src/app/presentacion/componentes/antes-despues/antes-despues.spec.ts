import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { AntesDespues } from './antes-despues';

describe('Antes y después del Brote Sorpresa', () => {
  function renderizar(actual: ResultadoSimulacion) {
    const fixture = TestBed.createComponent(AntesDespues);
    fixture.componentRef.setInput('anterior', resultadoDePrueba);
    fixture.componentRef.setInput('actual', actual);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, texto: el.textContent?.replace(/\s+/g, ' ') ?? '' };
  }

  it('muestra qué cambió y que la recomendación cambia de plan', () => {
    const { el, texto } = renderizar({
      ...resultadoDePrueba,
      escenario: {
        ...resultadoDePrueba.escenario,
        plaga: { ...resultadoDePrueba.escenario.plaga, r0: 5 },
      },
      recomendado: 'azar',
    });
    expect(texto).toContain('La recomendación cambia');
    expect(texto).toContain('R0 2,5 → 5');
    const planes = [...el.querySelectorAll('.plan')].map((p) => p.textContent?.trim());
    expect(planes).toEqual(['Anillo', 'Azar']);
  });

  it('con el mismo escenario lo dice y la recomendación se mantiene', () => {
    const { texto } = renderizar(resultadoDePrueba);
    expect(texto).toContain('La recomendación se mantiene');
    expect(texto).toContain('Misma configuración');
  });

  it('el botón fija el resultado actual como referencia', () => {
    const { fixture, el } = renderizar(resultadoDePrueba);
    let fijado = false;
    fixture.componentInstance.fijar.subscribe(() => (fijado = true));
    el.querySelector<HTMLButtonElement>('.fijar')!.click();
    expect(fijado).toBe(true);
  });
});

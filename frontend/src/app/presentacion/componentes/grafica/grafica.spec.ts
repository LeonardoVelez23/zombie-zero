import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { RelojBrote } from '../../servicios/reloj-brote';
import { diaEnPunto } from '../../utilidades/grafica';
import { Grafica } from './grafica';

describe('Gráfica de zombies activos', () => {
  function renderizar(dia: number) {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(3);
    reloj.irA(dia);
    const fixture = TestBed.createComponent(Grafica);
    fixture.componentRef.setInput('resultado', resultadoDePrueba);
    fixture.detectChanges();
    return { fixture, reloj, raiz: fixture.nativeElement as HTMLElement };
  }

  const valores = (raiz: HTMLElement) =>
    [...raiz.querySelectorAll('.valores-dia strong')].map((e) => e.textContent?.trim());

  it('marca el día del reloj con una línea y el valor de cada plan', () => {
    const { raiz } = renderizar(1);
    expect(raiz.querySelector('.cursor text')?.textContent).toContain('Día 1');
    expect(raiz.querySelectorAll('.cursor circle').length).toBe(3);
    expect(valores(raiz)).toEqual(['10', '10', '10']);
  });

  it('se actualiza cuando avanza el reloj', () => {
    const { fixture, raiz, reloj } = renderizar(1);
    reloj.irA(2);
    fixture.detectChanges();
    expect(raiz.querySelector('.cursor text')?.textContent).toContain('Día 2');
    expect(valores(raiz)).toEqual(['4', '4', '4']);
  });

  it('dibuja la curva completa de fondo y el tramo recorrido encima', () => {
    const { raiz } = renderizar(1);
    const tramo = raiz.querySelector('path.linea.ninguna:not(.completa)')!.getAttribute('d')!;
    const completa = raiz.querySelector('path.linea.completa.ninguna')!.getAttribute('d')!;
    // Hasta el día 1 hay dos puntos; la curva completa tiene los cuatro días.
    expect(tramo.split('L').length).toBe(2);
    expect(completa.split('L').length).toBe(4);
  });

  it('convierte la posición del puntero en día', () => {
    const svg = { getBoundingClientRect: () => ({ left: 0, width: 700 }) } as unknown as Element;
    const area = { izquierda: 50, derecha: 650, arriba: 0, abajo: 100 };
    expect(diaEnPunto({ clientX: 50, currentTarget: svg }, area, 180, 700)).toBe(0);
    expect(diaEnPunto({ clientX: 350, currentTarget: svg }, area, 180, 700)).toBe(90);
    expect(diaEnPunto({ clientX: 699, currentTarget: svg }, area, 180, 700)).toBe(180);
    expect(diaEnPunto({ clientX: 0, currentTarget: svg }, area, 180, 700)).toBe(0);
  });
});

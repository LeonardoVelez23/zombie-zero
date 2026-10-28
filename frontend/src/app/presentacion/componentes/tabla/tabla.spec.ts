import { TestBed } from '@angular/core/testing';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { RelojBrote } from '../../servicios/reloj-brote';
import { Tabla } from './tabla';

// Mordidos acumulados por día (un barrio): sin intervenir y con los demás planes.
const conSeries: ResultadoSimulacion = {
  ...resultadoDePrueba,
  planes: resultadoDePrueba.planes.map((p) => ({
    ...p,
    mapaAfectados: p.id === 'ninguna' ? [[5], [300], [2000], [4637]] : [[5], [50], [150], [212]],
  })),
};

describe('Comparativa de planes', () => {
  function renderizar(dia: number) {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(3);
    reloj.irA(dia);
    const fixture = TestBed.createComponent(Tabla);
    fixture.componentRef.setInput('resultado', conSeries);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const columna = () =>
      [...raiz.querySelectorAll('tbody td.al-dia')].map((e) =>
        e.textContent?.replace(/\s+/g, ' ').trim(),
      );
    return { fixture, reloj, raiz, columna };
  }

  it('agrega mordidos y salvados hasta el día de la línea de tiempo', () => {
    const { raiz, columna } = renderizar(1);
    expect(raiz.querySelector('th.al-dia')?.textContent).toContain('Hasta el día 1');
    expect(columna()).toEqual(['300 línea base', '50 250 salvados', '50 250 salvados']);
  });

  it('cambia con el reloj y en el último día coincide con los totales', () => {
    const { fixture, reloj, columna } = renderizar(1);
    reloj.irA(3);
    fixture.detectChanges();
    expect(columna()).toEqual(['4.637 línea base', '3.741 896 salvados', '212 4.425 salvados']);
  });
});

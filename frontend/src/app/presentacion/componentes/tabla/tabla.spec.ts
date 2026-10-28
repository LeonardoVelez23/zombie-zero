import { TestBed } from '@angular/core/testing';

import { resultadoDePrueba } from '../../../../testing/datos';
import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { Tabla } from './tabla';

describe('Comparativa de planes', () => {
  // Las líneas base y el recomendado de los datos de prueba, más cinco candidatos con distintos infectados.
  const candidato = (id: string, media: number) => ({
    ...resultadoDePrueba.planes.find((p) => p.id === 'anillo')!,
    id,
    nombre: id,
    infectados: { ...resultadoDePrueba.planes[0].infectados, media },
  });
  const conMuchos: ResultadoSimulacion = {
    ...resultadoDePrueba,
    planes: [
      ...resultadoDePrueba.planes,
      candidato('c900', 900),
      candidato('c300', 300),
      candidato('c700', 700),
      candidato('c400', 400),
      candidato('c500', 500),
    ],
  };

  function filas() {
    const fixture = TestBed.createComponent(Tabla);
    fixture.componentRef.setInput('resultado', conMuchos);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const ids = () =>
      [...raiz.querySelectorAll('tbody tr th strong')].map((e) => e.textContent?.trim());
    return { fixture, raiz, ids };
  }

  it('muestra las líneas base, el recomendado y los tres mejores', () => {
    const { ids } = filas();
    expect(ids()).toEqual(['ninguna', 'azar', 'anillo', 'c300', 'c400', 'c500']);
  });

  it('«Ver los N planes» muestra todos', () => {
    const { fixture, raiz, ids } = filas();
    const boton = raiz.querySelector<HTMLButtonElement>('.ver-todos')!;
    expect(boton.textContent).toContain('Ver los 8 planes');
    boton.click();
    fixture.detectChanges();
    expect(ids()).toHaveLength(8);
  });
});

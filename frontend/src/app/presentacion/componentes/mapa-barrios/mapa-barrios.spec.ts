import { TestBed } from '@angular/core/testing';

import { ResultadoSimulacion } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { RelojBrote } from '../../servicios/reloj-brote';
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
  // El día lo marca el reloj compartido (la línea de tiempo del panel).
  function renderizar(dia = 2) {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(2);
    reloj.irA(dia);
    const fixture = TestBed.createComponent(MapaBarrios);
    fixture.componentRef.setInput('resultado', resultado);
    fixture.detectChanges();
    const panel = fixture.nativeElement as HTMLElement;
    const texto = () => panel.textContent?.replace(/\s+/g, ' ') ?? '';
    return { fixture, panel, texto, reloj };
  }

  it('muestra el día del reloj con el plan recomendado frente a no intervenir', () => {
    const { texto } = renderizar();
    expect(texto()).toContain('PAUSA · DÍA 2');
    expect(texto()).toContain(
      'con anillo está mordido el 3 % de la ciudad frente al 50 % sin intervenir',
    );
    expect(texto()).toContain('Tarqui2 %');
  });

  it('al elegir otro plan cambian los barrios', () => {
    const { fixture, panel, texto } = renderizar();
    [...panel.querySelectorAll<HTMLButtonElement>('.plan')]
      .find((b) => b.textContent?.includes('Sin intervenir'))!
      .click();
    fixture.detectChanges();
    expect(texto()).toContain('con ningún plan está mordido el 50 %');
    expect(texto()).toContain('Manta60 %');
  });

  it('sigue al reloj cuando cambia el día', () => {
    const { fixture, texto, reloj } = renderizar();
    reloj.irA(1);
    fixture.detectChanges();
    expect(texto()).toContain('Día 1: con anillo está mordido el 2 % de la ciudad frente al 15 %');
  });

  it('ya no tiene un reproductor propio: lo maneja la línea de tiempo', () => {
    const { panel } = renderizar();
    expect(panel.querySelector('.reproduccion')).toBeNull();
    expect(panel.querySelector('input[type="range"]')).toBeNull();
  });

  it('colorea según la fracción mordida', () => {
    expect(nivelDe(0.01).nombre).toBe('Contenido');
    expect(nivelDe(0.1).nombre).toBe('En alerta');
    expect(nivelDe(0.44).nombre).toBe('Fuera de control');
  });
});

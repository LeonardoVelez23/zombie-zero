import { TestBed } from '@angular/core/testing';

import { ConfiguracionSimulacion } from '../../../dominio/modelos/escenario';
import { SimulacionGuardada } from '../../../dominio/modelos/resultado';
import { resultadoDePrueba } from '../../../../testing/datos';
import { informeTexto, nombreInforme } from '../../utilidades/informe-descarga';
import { Historial } from './historial';

const esc = resultadoDePrueba.escenario;
const guardada: SimulacionGuardada = {
  id: 'abc',
  momento: '2026-10-28T21:40:00+00:00',
  semilla: 7,
  repeticiones: 50,
  inicio: 'mercado',
  nPersonas: esc.nPersonas,
  dias: esc.dias,
  casosIniciales: esc.casosIniciales,
  plaga: { ...esc.plaga, r0: 5 },
  recursos: esc.recursos,
  recomendado: 'anillo',
  nivel: 'solida',
  ganaAAzar: 0.9,
  salvadosVsNinguna: 4321,
  planes: [
    {
      id: 'anillo',
      nombre: 'Vacunación en anillo',
      tipo: 'candidato',
      costo: 5000,
      vacunas: 500,
      infectados: 300,
      infectadosP5: 10,
      infectadosP95: 900,
      salvados: 4321,
    },
  ],
};

describe('Resultados anteriores', () => {
  function renderizar(simulaciones: SimulacionGuardada[]) {
    const fixture = TestBed.createComponent(Historial);
    fixture.componentRef.setInput('simulaciones', simulaciones);
    fixture.detectChanges();
    return { fixture, raiz: fixture.nativeElement as HTMLElement };
  }

  it('muestra la configuración usada y el resultado de cada simulación', () => {
    const { raiz } = renderizar([guardada]);
    const fila = raiz.querySelector('tbody tr')!.textContent!.replace(/\s+/g, ' ');
    expect(fila).toContain('Mercado · R0 5');
    expect(fila).toContain('semilla 7');
    expect(fila).toContain('Vacunación en anillo');
    expect(fila).toContain('4.321');
  });

  it('«Volver a simular» repite la misma configuración y semilla', () => {
    const { fixture, raiz } = renderizar([guardada]);
    const pedidas: ConfiguracionSimulacion[] = [];
    fixture.componentInstance.repetir.subscribe((c) => pedidas.push(c));
    raiz.querySelector<HTMLButtonElement>('.repetir')!.click();
    expect(pedidas).toEqual([
      {
        repeticiones: 50,
        escenario: {
          nPersonas: esc.nPersonas,
          dias: esc.dias,
          semilla: 7,
          inicio: 'mercado',
          casosIniciales: esc.casosIniciales,
          plaga: { ...esc.plaga, r0: 5 },
          recursos: esc.recursos,
        },
      },
    ]);
  });

  it('sin simulaciones guardadas lo dice', () => {
    const { raiz } = renderizar([]);
    expect(raiz.querySelector('.vacio')?.textContent).toContain('Todavía no hay simulaciones');
  });
});

describe('Informe descargable', () => {
  it('trae la configuración, la recomendación y todos los planes', () => {
    const texto = informeTexto(guardada);
    expect(texto).toContain('Origen del brote: Mercado');
    expect(texto).toContain('semilla 7');
    expect(texto).toContain('R0 5');
    expect(texto).toContain('Plan recomendado: Vacunación en anillo');
    expect(texto).toContain('Confianza: sólida (gana al reparto al azar en 90 %');
    expect(texto).toContain('- Vacunación en anillo (RECOMENDADO): 300 infectados (10–900), 4.321 salvados');
  });

  it('el nombre del archivo lleva la fecha y la semilla', () => {
    expect(nombreInforme(guardada)).toBe('zombie-zero-20261028-2140-semilla7.txt');
  });

  it('cada fila tiene su botón de descarga', () => {
    const fixture = TestBed.createComponent(Historial);
    fixture.componentRef.setInput('simulaciones', [guardada]);
    fixture.detectChanges();
    const botones = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody button')];
    expect(botones.map((b) => b.textContent?.trim())).toEqual(['Volver a simular', 'Descargar informe']);
  });
});

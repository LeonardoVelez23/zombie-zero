import { TestBed } from '@angular/core/testing';

import { Calibracion as DatosCalibracion } from '../../../dominio/modelos/escenario';
import { Calibracion } from './calibracion';

const datos: DatosCalibracion = {
  fuente: 'SNGRE',
  urlFuente: 'https://github.com/andrab/ecuacovid',
  semanas: [
    { semana: 33, fin: '2020-08-16', acumulado: 100, nuevos: 19 },
    { semana: 34, fin: '2020-08-23', acumulado: 109, nuevos: 9 },
    { semana: 35, fin: '2020-08-30', acumulado: 156, nuevos: 47 },
    { semana: 36, fin: '2020-09-06', acumulado: 186, nuevos: 30 },
  ],
  ventana: [34, 35],
  ajuste: [10, 40],
  rDiario: 0.0204,
  duplicacionDias: 34,
  rEfectivo: 1.17,
  ic95: [1.07, 1.27],
};

describe('Calibracion', () => {
  async function renderizar() {
    const fixture = TestBed.createComponent(Calibracion);
    fixture.componentRef.setInput('calibracion', datos);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja una barra por semana y resalta solo la ventana ajustada', async () => {
    const raiz = await renderizar();
    expect(raiz.querySelectorAll('rect.barra').length).toBe(4);
    expect(raiz.querySelectorAll('rect.barra.ventana').length).toBe(2);
    expect(raiz.querySelector('path.ajuste')?.getAttribute('d')).toMatch(/^M[\d.]+,[\d.]+ L/);
  });

  it('explica el R efectivo con su intervalo, el periodo y la fuente', async () => {
    const texto = (await renderizar()).textContent ?? '';
    expect(texto).toContain('1,17');
    expect(texto).toContain('1,07 – 1,27');
    expect(texto).toContain('23 ago al 30 ago de 2020');
    expect(texto).toContain('se duplicaba cada 34 días');
    expect(texto).toContain('186 en 2020');
  });
});

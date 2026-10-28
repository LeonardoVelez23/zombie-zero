import { TestBed } from '@angular/core/testing';

import { ConfiguracionSimulacion } from '../../../dominio/modelos/escenario';
import { parametrosDePrueba } from '../../../../testing/datos';
import { Controles } from './controles';

describe('Brote Sorpresa en un clic', () => {
  function renderizar() {
    const fixture = TestBed.createComponent(Controles);
    fixture.componentRef.setInput('parametros', parametrosDePrueba);
    fixture.detectChanges();
    const enviados: ConfiguracionSimulacion[] = [];
    fixture.componentInstance.ejecutar.subscribe((c) => enviados.push(c));
    const panel = fixture.nativeElement as HTMLElement;
    const boton = (texto: string) =>
      [...panel.querySelectorAll<HTMLButtonElement>('.sorpresa')].find((b) =>
        b.textContent?.includes(texto),
      )!;
    return { fixture, enviados, boton };
  }

  it('cada sorpresa ajusta el escenario por defecto y simula', () => {
    const { fixture, enviados, boton } = renderizar();
    boton('R0 doble').click();
    boton('Mercado').click();
    fixture.detectChanges();

    const ultimo = enviados.at(-1)!.escenario!;
    expect(enviados).toHaveLength(2);
    expect(ultimo.plaga?.r0).toBe(5); // el doble de 2,5: las sorpresas se acumulan
    expect(ultimo.inicio).toBe('mercado');
    expect(boton('R0 doble').getAttribute('aria-pressed')).toBe('true');
  });

  it('el corte de vacunas empieza el día en que se empieza a actuar', () => {
    const { enviados, boton } = renderizar();
    boton('Corte de vacunas').click();
    const recursos = enviados[0].escenario!.recursos!;
    expect(recursos.corteDesde).toBe(parametrosDePrueba.porDefecto.recursos.diaInicio);
    expect(recursos.corteDias).toBe(30);
  });

  it('restablecer vuelve a los valores por defecto', () => {
    const { fixture, enviados, boton } = renderizar();
    boton('Variante').click();
    boton('Restablecer').click();
    fixture.detectChanges();

    expect(enviados.at(-1)!.escenario!.recursos?.eficacia).toBe(0.9);
    expect(boton('Variante').getAttribute('aria-pressed')).toBe('false');
  });
});

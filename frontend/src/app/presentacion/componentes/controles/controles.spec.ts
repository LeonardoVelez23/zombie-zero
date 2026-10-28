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

describe('Más parámetros', () => {
  it('empieza plegado y se abre si un Brote Sorpresa cambia uno de sus campos', () => {
    const fixture = TestBed.createComponent(Controles);
    fixture.componentRef.setInput('parametros', parametrosDePrueba);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const avanzado = raiz.querySelector<HTMLDetailsElement>('details.avanzado')!;
    expect(avanzado.open).toBe(false);
    expect(raiz.querySelector('#semilla')).not.toBeNull(); // la semilla siempre a la vista

    [...raiz.querySelectorAll<HTMLButtonElement>('.sorpresa')]
      .find((b) => b.textContent?.includes('Corte de vacunas'))!
      .click();
    fixture.detectChanges();
    expect(avanzado.open).toBe(true);
  });
});

describe('Volver a simular desde el historial', () => {
  it('pone en el formulario los valores usados, sin simular, y abre «Más parámetros» si hace falta', () => {
    const fixture = TestBed.createComponent(Controles);
    fixture.componentRef.setInput('parametros', parametrosDePrueba);
    fixture.detectChanges();
    const enviados: ConfiguracionSimulacion[] = [];
    fixture.componentInstance.ejecutar.subscribe((c) => enviados.push(c));
    const d = parametrosDePrueba.porDefecto;

    fixture.componentInstance.cargar({
      repeticiones: 50,
      escenario: {
        ...d,
        semilla: 7,
        inicio: 'mercado',
        plaga: { ...d.plaga, r0: 5 },
        recursos: { ...d.recursos, vacunasDisponibles: 250, corteDesde: 21, corteDias: 30 },
      },
    });
    fixture.detectChanges();
    expect(enviados).toHaveLength(0);

    // Al simular desde el formulario sale exactamente esa configuración.
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.requestSubmit();
    const escenario = enviados[0].escenario!;
    expect(enviados[0].repeticiones).toBe(50);
    expect(escenario.semilla).toBe(7);
    expect(escenario.inicio).toBe('mercado');
    expect(escenario.plaga?.r0).toBe(5);
    expect(escenario.recursos?.vacunasDisponibles).toBe(250);
    expect(escenario.recursos?.corteDias).toBe(30);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Corte');
  });
});

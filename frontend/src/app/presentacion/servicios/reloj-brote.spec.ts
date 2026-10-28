import { TestBed } from '@angular/core/testing';

import { RelojBrote } from './reloj-brote';

describe('Reloj del brote', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('con un brote nuevo se reproduce desde el día 0 hasta el final y se detiene', () => {
    const reloj = TestBed.inject(RelojBrote);
    reloj.nuevoBrote(3);
    expect(reloj.dia()).toBe(0);
    expect(reloj.reproduciendo()).toBe(true);
    vi.advanceTimersByTime(120);
    expect(reloj.dia()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(reloj.dia()).toBe(3);
    expect(reloj.reproduciendo()).toBe(false);
  });

  it('ir a un día pausa la reproducción y lo acota al rango', () => {
    const reloj = TestBed.inject(RelojBrote);
    reloj.nuevoBrote(10);
    reloj.irA(4.4);
    expect(reloj.dia()).toBe(4);
    expect(reloj.reproduciendo()).toBe(false);
    reloj.irA(50);
    expect(reloj.dia()).toBe(10);
    reloj.irA(-3);
    expect(reloj.dia()).toBe(0);
  });

  it('al final, reproducir vuelve a empezar desde el día 0', () => {
    const reloj = TestBed.inject(RelojBrote);
    reloj.total.set(5);
    reloj.irA(5);
    reloj.alternar();
    expect(reloj.dia()).toBe(0);
    expect(reloj.reproduciendo()).toBe(true);
    reloj.alternar();
    expect(reloj.reproduciendo()).toBe(false);
  });

  it('la velocidad cambia el ritmo de los días', () => {
    const reloj = TestBed.inject(RelojBrote);
    reloj.nuevoBrote(100);
    reloj.cambiarVelocidad(30);
    vi.advanceTimersByTime(300);
    expect(reloj.dia()).toBe(10);
  });

  it('con movimiento reducido muestra directamente el último día', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    try {
      const reloj = TestBed.inject(RelojBrote);
      reloj.nuevoBrote(7);
      expect(reloj.dia()).toBe(7);
      expect(reloj.reproduciendo()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

import {
  ZonaBarrio,
  circulo,
  radioZona,
  zombiesGeoJSON,
  zombiesPorPunto,
  zonasGeoJSON,
} from './capas';

const zona = (nombre: string, lng: number): ZonaBarrio => ({
  nombre,
  centro: [lng, -0.96],
  radioKm: 1,
  fraccion: 0.1,
  color: '#ffba52',
});

describe('Capas del mapa por barrio', () => {
  it('la zona es un círculo cerrado del radio pedido', () => {
    const anillo = circulo([-80.7, -0.96], 1);
    expect(anillo[0]).toEqual(anillo[anillo.length - 1]);
    // 1 km al este del centro: unos 0,009 grados de longitud en Manta.
    expect(anillo[0][0] + 80.7).toBeCloseTo(0.009, 3);
  });

  it('el barrio más poblado tiene la zona más grande', () => {
    expect(radioZona(3000, 3000)).toBeGreaterThan(radioZona(500, 3000));
  });

  it('lleva el color y la fracción mordida de cada barrio', () => {
    const { features } = zonasGeoJSON([zona('Tarqui', -80.71)]);
    expect(features[0].properties).toEqual({ nombre: 'Tarqui', fraccion: 0.1, color: '#ffba52' });
  });

  it('un punto por zombie activo mientras no pasen del tope por barrio', () => {
    expect(zombiesPorPunto([[[3, 40]], [[150, 0]]])).toBe(1);
    expect(zombiesPorPunto([[[0, 600]], undefined])).toBe(4);
    const puntos = zombiesGeoJSON([zona('Tarqui', -80.71), zona('Manta', -80.73)], [12, 4], 2);
    expect(puntos.features).toHaveLength(8);
  });

  it('los puntos son siempre los mismos y quedan dentro de su zona', () => {
    const z = zona('Tarqui', -80.71);
    const a = zombiesGeoJSON([z], [30], 1);
    expect(zombiesGeoJSON([z], [30], 1)).toEqual(a);
    for (const p of a.features) {
      const [lng, lat] = p.geometry.coordinates;
      const km = Math.hypot((lng - z.centro[0]) * 111.3, (lat - z.centro[1]) * 110.6);
      expect(km).toBeLessThan(z.radioKm);
    }
  });
});

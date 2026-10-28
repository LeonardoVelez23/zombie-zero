import {
  ZonaBarrio,
  circulo,
  corredoresDe,
  corredoresGeoJSON,
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

describe('Corredores de contagio', () => {
  const nombres = ['Tarqui', 'Manta', 'Rural'];
  // Fila: barrio de origen; columna: barrio mordido.
  const matriz = [
    [50, 10, 0.2],
    [6, 40, 0],
    [0.3, 0, 5],
  ];

  it('suma ambos sentidos, ignora lo de dentro del barrio y lo menor a una mordida', () => {
    expect(corredoresDe(nombres, matriz)).toEqual([{ a: 'Tarqui', b: 'Manta', mordidas: 16 }]);
    expect(corredoresDe(nombres, undefined)).toEqual([]);
  });

  it('dibuja una línea entre los centros con grosor relativo al mayor corredor', () => {
    const centros = { Tarqui: [-80.71, -0.95], Manta: [-80.73, -0.94] } as Record<
      string,
      [number, number]
    >;
    const { features } = corredoresGeoJSON(
      [{ a: 'Tarqui', b: 'Manta', mordidas: 16 }],
      centros,
      32,
    );
    expect(features[0].geometry.coordinates).toEqual([centros['Tarqui'], centros['Manta']]);
    expect(features[0].properties).toEqual({ mordidas: 16, ancho: 5 });
    // Con un corredor mayor de 200 mordidas en otro plan, este (menos del 10 %) no se dibuja.
    expect(
      corredoresGeoJSON([{ a: 'Tarqui', b: 'Manta', mordidas: 16 }], centros, 200).features,
    ).toEqual([]);
  });
});

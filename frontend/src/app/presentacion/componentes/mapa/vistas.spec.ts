import { LIMITES_MANTA, SECTORES, VISTAS, estiloBase } from './vistas';

describe('vistas del mapa', () => {
  it('cada vista solo muestra sus capas', () => {
    for (const vista of VISTAS) {
      const estilo = estiloBase(vista.id);
      const visibles = estilo.layers
        .filter((c) => (c.layout as { visibility?: string } | undefined)?.visibility === 'visible')
        .map((c) => c.id);
      expect(visibles.sort()).toEqual([...vista.capas].sort());
    }
  });

  it('todas las capas de las vistas existen en el estilo y tienen atribución en su fondo', () => {
    const estilo = estiloBase('satelite');
    const ids = estilo.layers.map((c) => c.id);
    for (const vista of VISTAS) for (const capa of vista.capas) expect(ids).toContain(capa);
    for (const fuente of ['satelite', 'calles', 'oscuro']) {
      expect((estilo.sources[fuente] as { attribution?: string }).attribution).toBeTruthy();
    }
  });

  it('los sectores caen dentro del encuadre de Manta', () => {
    const [oeste, sur, este, norte] = LIMITES_MANTA;
    for (const {
      lngLat: [lon, lat],
    } of SECTORES) {
      expect(lon).toBeGreaterThanOrEqual(oeste);
      expect(lon).toBeLessThanOrEqual(este);
      expect(lat).toBeGreaterThanOrEqual(sur);
      expect(lat).toBeLessThanOrEqual(norte);
    }
  });
});

import { resultadoDePrueba } from '../../../testing/datos';
import { comparacion } from './planes';

describe('comparacion', () => {
  it('separa el plan recomendado de las dos líneas base', () => {
    const { recomendado, sinIntervencion, azar } = comparacion(resultadoDePrueba);
    expect(recomendado.id).toBe('anillo');
    expect(sinIntervencion.id).toBe('ninguna');
    expect(azar.id).toBe('azar');
  });

  it('falla con un mensaje claro si falta un plan', () => {
    const incompleto = { ...resultadoDePrueba, recomendado: 'centralidad' };
    expect(() => comparacion(incompleto)).toThrow('centralidad');
  });
});

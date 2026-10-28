import { InformeIa, ResultadoSimulacion } from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Pasa a palabras para el alcalde una simulación ya hecha: no vuelve a simular ni cambia la recomendación.
export class RedactarInforme {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(resultado: ResultadoSimulacion): Promise<InformeIa> {
    return this.simulador.informe(resultado);
  }
}

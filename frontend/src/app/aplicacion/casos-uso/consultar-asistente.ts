import { InformeIa, PeticionIa } from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';

// Pasa a palabras una simulación ya hecha (para el alcalde, el PDF, una pregunta o una comparación):
// no vuelve a simular ni cambia la recomendación. `alEscribir` recibe el texto a medida que llega.
export class ConsultarAsistente {
  constructor(private readonly simulador: SimuladorRepositorio) {}

  ejecutar(peticion: PeticionIa, alEscribir?: (parcial: InformeIa) => void): Promise<InformeIa> {
    return this.simulador.asistente(peticion, alEscribir);
  }
}

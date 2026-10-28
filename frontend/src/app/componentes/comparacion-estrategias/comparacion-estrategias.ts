import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlanResultado, SimulacionRespuesta } from '../../modelos/parametros';

@Component({
  selector: 'app-comparacion-estrategias',
  imports: [CommonModule],
  templateUrl: './comparacion-estrategias.html',
  styles: [':host { display: block; }'],
})
export class ComparacionEstrategiasComponent {
  @Input() respuesta: SimulacionRespuesta | null = null;
  @Input() planVisualizado: PlanResultado | null = null;
  @Input() planRecomendado: PlanResultado | null = null;

  @Output() readonly seleccionarPlan = new EventEmitter<string>();

  seleccionar(idPlan: string): void {
    this.seleccionarPlan.emit(idPlan);
  }
}

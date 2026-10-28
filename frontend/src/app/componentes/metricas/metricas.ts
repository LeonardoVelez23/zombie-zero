import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { PlanResultado, SimulacionRespuesta } from '../../modelos/parametros';

@Component({
  selector: 'app-metricas',
  imports: [CommonModule],
  templateUrl: './metricas.html',
  styles: [':host { display: block; }'],
})
export class MetricasComponent {
  @Input() respuesta: SimulacionRespuesta | null = null;
  @Input() plan: PlanResultado | null = null;
}

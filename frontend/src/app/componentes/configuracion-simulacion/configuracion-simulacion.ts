import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ParametrosRespuesta, SimulacionRespuesta } from '../../modelos/parametros';

@Component({
  selector: 'app-configuracion-simulacion',
  imports: [CommonModule],
  templateUrl: './configuracion-simulacion.html',
  styles: [':host { display: flex; min-width: 0; } .config-panel { width: 100%; }'],
})
export class ConfiguracionSimulacionComponent {
  @Input() parametros: ParametrosRespuesta | null = null;
  @Input() poblacion = 10000;
  @Input() duracion = 180;
  @Input() semilla = 42;
  @Input() origen = 'aleatorio';
  @Input() estrategia = 'auto';
  @Input() repeticiones = 50;
  @Input() estadoConexion: 'conectando' | 'online' | 'offline' = 'conectando';
  @Input() errorCarga: string | null = null;
  @Input() errorSimulacion: string | null = null;
  @Input() simulando = false;
  @Input() respuestaSimulacion: SimulacionRespuesta | null = null;

  @Output() readonly poblacionChange = new EventEmitter<number>();
  @Output() readonly duracionChange = new EventEmitter<number>();
  @Output() readonly semillaChange = new EventEmitter<number>();
  @Output() readonly origenChange = new EventEmitter<string>();
  @Output() readonly estrategiaChange = new EventEmitter<string>();
  @Output() readonly repeticionesChange = new EventEmitter<number>();
  @Output() readonly ejecutar = new EventEmitter<void>();

  actualizarPoblacion(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!isNaN(value)) this.poblacionChange.emit(value);
  }

  actualizarDuracion(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!isNaN(value)) this.duracionChange.emit(value);
  }

  actualizarSemilla(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!isNaN(value)) this.semillaChange.emit(value);
  }

  actualizarOrigen(event: Event): void {
    this.origenChange.emit((event.target as HTMLSelectElement).value);
  }

  actualizarEstrategia(event: Event): void {
    this.estrategiaChange.emit((event.target as HTMLSelectElement).value);
  }

  actualizarRepeticiones(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (!isNaN(value)) this.repeticionesChange.emit(value);
  }
}

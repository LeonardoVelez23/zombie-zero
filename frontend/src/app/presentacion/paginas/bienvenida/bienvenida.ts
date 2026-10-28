import { Component, output, signal } from '@angular/core';

const NOMBRE_POR_DEFECTO = 'Comité de Contención Manta';
const NOMBRE_SI_VACIO = 'Comité de Emergencia';

// Pantalla de entrada: presenta el reto y da paso directo al panel (sin registro).
@Component({
  selector: 'app-bienvenida',
  templateUrl: './bienvenida.html',
  styleUrl: './bienvenida.css',
})
export class Bienvenida {
  readonly ingresar = output<string>();

  protected readonly nombre = signal(NOMBRE_POR_DEFECTO);

  // Partículas flotantes del fondo (posición, tamaño, retraso, duración y color).
  protected readonly particulas = [
    { izquierda: '15%', tamano: '6px', retraso: '0s', duracion: '9s', color: null },
    { izquierda: '25%', tamano: '4px', retraso: '2s', duracion: '11s', color: '#a855f7' },
    { izquierda: '75%', tamano: '7px', retraso: '4s', duracion: '8s', color: null },
    { izquierda: '85%', tamano: '5px', retraso: '1s', duracion: '12s', color: '#10b981' },
  ];

  protected cambiarNombre(evento: Event): void {
    this.nombre.set((evento.target as HTMLInputElement).value);
  }

  protected entrar(): void {
    this.ingresar.emit(this.nombre().trim() || NOMBRE_SI_VACIO);
  }
}

import { Injectable } from '@angular/core';

export type EstadoGuia = 'completada' | 'saltada';

export const CLAVE_GUIA = 'zombie-zero.guia';

// Recuerda en este navegador si el recorrido se terminó o se saltó.
// Solo sirve para mostrarlo en el botón: la guía se puede abrir siempre.
// Si el almacenamiento no está disponible (modo privado, bloqueado), se ignora sin fallar.
@Injectable({ providedIn: 'root' })
export class PreferenciaGuia {
  leer(): EstadoGuia | null {
    try {
      const valor = globalThis.localStorage?.getItem(CLAVE_GUIA);
      return valor === 'completada' || valor === 'saltada' ? valor : null;
    } catch {
      return null;
    }
  }

  guardar(estado: EstadoGuia): void {
    try {
      globalThis.localStorage?.setItem(CLAVE_GUIA, estado);
    } catch {
      // Sin almacenamiento la guía sigue funcionando; solo no se recuerda.
    }
  }
}

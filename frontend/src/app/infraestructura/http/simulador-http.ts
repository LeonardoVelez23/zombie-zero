import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ConfiguracionDifusion,
  ConfiguracionSimulacion,
  Parametros,
} from '../../dominio/modelos/escenario';
import {
  InformeIa,
  PeticionIa,
  ResultadoDifusion,
  ResultadoSimulacion,
  SimulacionGuardada,
} from '../../dominio/modelos/resultado';
import { SimuladorRepositorio } from '../../dominio/puertos/simulador.repositorio';
import { aCamel, aSnake, renombrarClaves } from './mapeo';

// Adaptador del puerto contra la API HTTP del backend (local o Lambda). Ver docs/api.md.
@Injectable()
export class SimuladorHttp implements SimuladorRepositorio {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api`;

  parametros(): Promise<Parametros> {
    return this.pedir(this.http.get(`${this.base}/parametros`));
  }

  simular(configuracion: ConfiguracionSimulacion): Promise<ResultadoSimulacion> {
    return this.pedir(this.http.post(`${this.base}/simular`, renombrarClaves(configuracion, aSnake)));
  }

  difusion(configuracion: ConfiguracionDifusion): Promise<ResultadoDifusion> {
    return this.pedir(this.http.post(`${this.base}/edp`, renombrarClaves(configuracion, aSnake)));
  }

  // POST /api/asistente/stream: Server-Sent Events. En local el texto llega a medida que la IA lo
  // escribe; en Lambda los mismos eventos llegan juntos al final. Con fetch y no con HttpClient,
  // que no entrega el cuerpo por partes.
  async asistente(
    peticion: PeticionIa,
    alEscribir?: (parcial: InformeIa) => void,
  ): Promise<InformeIa> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.base}/asistente/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(renombrarClaves(cuerpoAsistente(peticion), aSnake)),
      });
    } catch {
      throw new Error(SIN_CONEXION);
    }
    if (!respuesta.ok || !respuesta.body) {
      const error = await respuesta.json().catch(() => null);
      throw new Error(error?.error ?? `La API respondió ${respuesta.status}`);
    }

    const informe: InformeIa = { fuente: 'local', modelo: null, texto: '' };
    const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
    let pendiente = '';
    for (;;) {
      const { value, done } = await lector.read();
      if (value) pendiente += value;
      const { eventos, resto } = separarEventos(done ? pendiente + '\n\n' : pendiente);
      pendiente = resto;
      for (const evento of eventos) aplicarEvento(informe, evento);
      if (eventos.length) alEscribir?.({ ...informe, texto: textoPlano(informe.texto) });
      if (done) break;
    }
    return { ...informe, texto: textoPlano(informe.texto).trim() };
  }

  async historial(): Promise<SimulacionGuardada[]> {
    const { simulaciones } = await this.pedir<{ simulaciones: SimulacionGuardada[] }>(
      this.http.get(`${this.base}/historial`),
    );
    return simulaciones;
  }

  private async pedir<T>(peticion: Observable<unknown>): Promise<T> {
    try {
      return renombrarClaves(await firstValueFrom(peticion), aCamel) as T;
    } catch (error) {
      throw new Error(mensajeDeError(error));
    }
  }
}

const SIN_CONEXION = 'No se pudo conectar con la API. ¿Está levantado el backend?';

interface EventoIa {
  tipo: 'inicio' | 'texto' | 'aviso' | 'fin';
  fuente?: InformeIa['fuente'];
  modelo?: string | null;
  texto?: string;
  aviso?: string;
}

// Corta el texto recibido en eventos SSE completos ("data: {...}" separados por una línea en blanco);
// lo que queda a medias se devuelve en `resto` para juntarlo con el siguiente trozo.
export function separarEventos(texto: string): { eventos: EventoIa[]; resto: string } {
  const bloques = texto.replace(/\r\n/g, '\n').split('\n\n');
  const resto = bloques.pop() ?? '';
  const eventos = bloques
    .map((bloque) =>
      bloque
        .split('\n')
        .filter((linea) => linea.startsWith('data:'))
        .map((linea) => linea.slice(5).trim())
        .join(''),
    )
    .filter(Boolean)
    .map((dato) => JSON.parse(dato) as EventoIa);
  return { eventos, resto };
}

// Se pide texto plano, pero a veces el modelo marca negritas o títulos en markdown: se quitan las marcas.
export function textoPlano(texto: string): string {
  return texto.replace(/\*\*|__/g, '').replace(/^#{1,6}\s+/gm, '');
}

function aplicarEvento(informe: InformeIa, evento: EventoIa): void {
  if (evento.tipo === 'inicio') {
    // Un inicio nuevo es otro proveedor: lo anterior se descarta.
    informe.fuente = evento.fuente ?? 'local';
    informe.modelo = evento.modelo ?? null;
    informe.texto = '';
  } else if (evento.tipo === 'texto') {
    informe.texto += evento.texto ?? '';
  } else if (evento.tipo === 'aviso') {
    informe.aviso = evento.aviso;
  }
}

// La petición al asistente con cada simulación reducida a lo que necesita la IA.
export function cuerpoAsistente(p: PeticionIa) {
  return {
    tarea: p.tarea,
    resultado: resumenParaInforme(p.resultado),
    ...(p.anterior ? { anterior: resumenParaInforme(p.anterior) } : {}),
    ...(p.pregunta !== undefined ? { pregunta: p.pregunta } : {}),
    ...(p.conversacion ? { conversacion: p.conversacion } : {}),
  };
}

// Solo lo que necesita el informe: el resultado completo, con mapas y curvas, pesa cientos de KB.
// Del escenario van sus parámetros (son pocos números) para explicar y comparar.
export function resumenParaInforme(r: ResultadoSimulacion) {
  return {
    escenario: r.escenario,
    repeticiones: r.repeticiones,
    recomendado: r.recomendado,
    veredicto: r.veredicto,
    planes: r.planes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      vacunas: p.vacunas,
      costo: p.costo,
      infectados: p.infectados.media,
      salvadosVsNinguna: p.salvadosVsNinguna?.media,
      salvadosVsAzar: p.salvadosVsAzar?.media,
      ganaANinguna: p.ganaANinguna,
      ganaAAzar: p.ganaAAzar,
    })),
  };
}

// El backend responde {"error": "..."} en los 400; con estado 0 ni siquiera hubo respuesta.
function mensajeDeError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return String(error);
  if (error.status === 0) return SIN_CONEXION;
  return error.error?.error ?? `La API respondió ${error.status}`;
}

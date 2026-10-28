import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ConfiguracionDifusion,
  ConfiguracionSimulacion,
  Parametros,
} from '../../dominio/modelos/escenario';
import { InformeIa, ResultadoDifusion, ResultadoSimulacion } from '../../dominio/modelos/resultado';
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

  informe(resultado: ResultadoSimulacion): Promise<InformeIa> {
    return this.pedir(this.http.post(`${this.base}/informe`, renombrarClaves(resumenParaInforme(resultado), aSnake)));
  }

  private async pedir<T>(peticion: Observable<unknown>): Promise<T> {
    try {
      return renombrarClaves(await firstValueFrom(peticion), aCamel) as T;
    } catch (error) {
      throw new Error(mensajeDeError(error));
    }
  }
}

// Solo lo que necesita el informe: el resultado completo, con mapas y curvas, pesa cientos de KB.
export function resumenParaInforme(r: ResultadoSimulacion) {
  return {
    escenario: { nPersonas: r.escenario.nPersonas },
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
  if (error.status === 0) return 'No se pudo conectar con la API. ¿Está levantado el backend?';
  return error.error?.error ?? `La API respondió ${error.status}`;
}

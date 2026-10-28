import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EstadoSalud, ParametrosRespuesta } from '../modelos/parametros';

@Injectable({
  providedIn: 'root',
})
export class Api {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8000/api';

  obtenerParametros(): Observable<ParametrosRespuesta> {
    return this.http.get<ParametrosRespuesta>(`${this.baseUrl}/parametros`);
  }

  comprobarSalud(): Observable<EstadoSalud> {
    return this.http.get<EstadoSalud>(`${this.baseUrl}/salud`);
  }
}

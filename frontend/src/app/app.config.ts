import { ApplicationConfig, Provider, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

import { ModelarDifusion } from './aplicacion/casos-uso/modelar-difusion';
import { ObtenerParametros } from './aplicacion/casos-uso/obtener-parametros';
import { RedactarInforme } from './aplicacion/casos-uso/redactar-informe';
import { SimularBrote } from './aplicacion/casos-uso/simular-brote';
import { SimuladorRepositorio } from './dominio/puertos/simulador.repositorio';
import { SimuladorHttp } from './infraestructura/http/simulador-http';

// Los casos de uso son clases sin Angular: aquí se les inyecta el puerto.
const casoDeUso = <T>(clase: new (simulador: SimuladorRepositorio) => T): Provider => ({
  provide: clase,
  useFactory: (simulador: SimuladorRepositorio) => new clase(simulador),
  deps: [SimuladorRepositorio],
});

export const casosDeUso: Provider[] = [
  casoDeUso(ObtenerParametros),
  casoDeUso(SimularBrote),
  casoDeUso(ModelarDifusion),
  casoDeUso(RedactarInforme),
];

// Punto de composición: el único lugar que une el puerto con su adaptador.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    { provide: SimuladorRepositorio, useClass: SimuladorHttp },
    ...casosDeUso,
  ],
};

# Frontend (Angular)

Panel del simulador: arma la simulación, compara los planes y muestra la
recomendación. Habla con la API del backend; el formato está en
[docs/api.md](../docs/api.md).

## Levantar en local

Necesita Node.js 22.22 o superior y la API corriendo en otra terminal
(ver el [README principal](../README.md)):

```bash
npm install
npm start        # http://localhost:4200, llama a la API en http://localhost:8000
npm test         # pruebas con Vitest
npm run build    # build de producción en dist/zombie-zero-ui/browser
```

## URL de la API

- `src/environments/environment.development.ts`: la de `ng serve` (local).
- `src/environments/environment.ts`: la del build de producción. Antes de
  `npm run build` hay que poner ahí la salida `ApiUrl` de la pila de AWS, sin
  la `/` final.

## Arquitectura limpia

Las dependencias apuntan siempre hacia adentro: la presentación usa casos de
uso, los casos de uso usan el dominio, y la infraestructura implementa los
puertos del dominio. El dominio no importa Angular, rxjs ni HTTP.

```
src/app/
├── dominio/                 reglas del negocio, sin dependencias
│   ├── modelos/             Escenario, Parametros, ResultadoSimulacion, ResultadoDifusion
│   ├── puertos/             SimuladorRepositorio: lo que la app necesita del motor
│   └── reglas/              planes.ts: recomendado frente a las líneas base
├── aplicacion/
│   └── casos-uso/           ObtenerParametros, SimularBrote, ModelarDifusion
├── infraestructura/
│   └── http/                SimuladorHttp (adaptador del puerto) y mapeo snake_case ⇄ camelCase
├── presentacion/
│   ├── paginas/panel/       estado de la pantalla; solo habla con los casos de uso
│   ├── componentes/         controles, grafica, tabla, informe, mapa (reciben datos por input)
│   └── utilidades/          formato de números y trazos SVG
├── app.config.ts            punto de composición: une el puerto con SimuladorHttp
└── app.ts
```

Reglas para agregar código:

- Un dato nuevo de la API entra primero como tipo en `dominio/modelos/` (en
  camelCase); el adaptador lo convierte solo.
- Una operación nueva del backend es un método del puerto, su implementación en
  `SimuladorHttp`, un caso de uso y su registro en `casosDeUso` de `app.config.ts`.
- Los componentes no inyectan servicios: reciben datos con `input()` y avisan con
  `output()`. Solo la página `panel` usa casos de uso.
- Para probar la interfaz sin HTTP basta con un `SimuladorRepositorio` falso
  (ver `app.spec.ts`).

## Pendiente

- Mapa por barrio con MapLibre a partir de `mapa` y `poblacion_barrio` de
  `/api/simular`. Hoy `componentes/mapa` muestra la cuadrícula del modelo EDP.
- Los parámetros menos usados (latencia, costos, cierres) toman el valor por
  defecto; se agregan a `SECCIONES` en `controles.ts` si hacen falta.

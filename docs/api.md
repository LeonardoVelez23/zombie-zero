# API de Zombie Zero

La misma API corre en local (`python -m zombie.servidor`, puerto 8000) y en AWS
Lambda (`zombie.api.lambda_handler`). Todo es JSON en UTF-8.

Respuesta de ejemplo completa y real: [`docs/ejemplos/respuesta-simular.json`](ejemplos/respuesta-simular.json)
(escenario por defecto, 100 repeticiones, semilla 42).

## `GET /api/salud`

```json
{"estado": "ok"}
```

## `GET /api/parametros`

Valores por defecto y límites de cada parámetro, para armar los controles de la interfaz.

```json
{
  "por_defecto": { "n_personas": 5000, "dias": 180, "semilla": 42, "inicio": "aeropuerto", "casos_iniciales": 5,
                   "plaga": {...}, "recursos": {...} },
  "limites": { "escenario": {"n_personas": [1000, 20000], ...},
               "plaga": {"r0": [0.5, 10.0], ...},
               "recursos": {...} },
  "inicios": ["aleatorio", "aeropuerto", "mercado", "colegio", "Tarqui", "Manta", "Los Esteros", "Eloy Alfaro", "San Mateo", "Rural"],
  "repeticiones": {"por_defecto": 100, "limites": [5, 200]},
  "calibracion": { "fuente": "SNGRE, casos positivos por cantón (repositorio ecuacovid)",
                   "url_fuente": "https://github.com/andrab/ecuacovid",
                   "semanas": [{"semana": 12, "fin": "2020-03-22", "acumulado": 18, "nuevos": 18}, ...],
                   "ventana": [34, 46], "ajuste": [18.8, 21.7, ...],
                   "r_diario": 0.0204, "duplicacion_dias": 34.0, "r_efectivo": 1.17, "ic95": [1.07, 1.27] }
}
```

## `POST /api/simular`

### Petición

Todo es opcional: lo que no se envía toma el valor por defecto.

```json
{
  "repeticiones": 100,
  "escenario": {
    "semilla": 42,
    "n_personas": 5000,
    "dias": 180,
    "inicio": "mercado",
    "casos_iniciales": 5,
    "plaga":    { "r0": 2.5, "dias_latencia": 3, "dias_infeccioso": 5, "deteccion": 0.7 },
    "recursos": { "presupuesto": 20000, "costo_vacuna": 10, "vacunas_disponibles": 1000,
                  "vacunas_por_dia": 100, "dia_inicio": 3, "eficacia": 0.9,
                  "corte_desde": 0, "corte_dias": 0,
                  "dias_cierre": 14, "cumplimiento_cierre": 0.8,
                  "costo_cierre_mercado": 600, "costo_cierre_colegio": 800 }
  }
}
```

`corte_desde` y `corte_dias` simulan un imprevisto: no llegan vacunas desde ese día durante esos días (0 = sin corte).

**Brote Sorpresa típico:** `{"escenario": {"inicio": "mercado", "plaga": {"r0": 5}, "recursos": {"vacunas_disponibles": 500, "eficacia": 0.5}}}`.

### Respuesta

```json
{
  "escenario": { ... lo que se simuló, con todos los valores ... },
  "repeticiones": 100,
  "r0": 2.5,
  "beta": 0.04626,
  "barrios": ["Tarqui", "Manta", "Los Esteros", "Eloy Alfaro", "San Mateo", "Rural"],
  "poblacion_barrio": [2990, 2511, ...],
  "recomendado": "anillo+mercado",
  "veredicto": {
    "nivel": "solida",              // "solida" | "debil" | "insuficiente"
    "gana_a_azar": 0.98,            // de los brotes en que hubo diferencia, fracción en que gana al azar
    "empates_con_azar": 0.14,       // fracción de brotes que terminan igual (la plaga se apagó sola)
    "salvados_vs_ninguna": 4812.0,
    "salvados_vs_azar": 3896.0
  },
  "planes": [
    {
      "id": "anillo+mercado",
      "nombre": "anillo + cerrar mercado",
      "tipo": "candidato",          // "linea_base" (ninguna, azar) | "candidato"
      "descripcion": "Vacuna a los contactos de los zombies...",
      "vacunacion": "anillo",
      "cierres": ["mercado"],
      "vacunas": 1000,
      "costo": 18400.0,
      "infectados":      { "media": 320.0, "mediana": 151.0, "p5": 6.0, "p95": 1882.0 },
      "pico":            { "media": ..., "mediana": ..., "p5": ..., "p95": ... },
      "dia_pico": 21.4,
      "curva_zombies":   { "media": [dias+1 números], "mediana": [...], "p5": [...], "p95": [...] },
      "estados": {
        "S": { "media": [dias+1 números], "mediana": [...], "p5": [...], "p95": [...] },
        "E": { ... }, "I": { ... }, "R": { ... }
      },
      "mapa": [[zombies promedio por barrio el día 0], [día 1], ...],   // (dias+1) × 6
      "mapa_afectados": [[mordidos acumulados por barrio el día 0], ...], // (dias+1) × 6, lo pinta el mapa por barrio
      "corredores": [[mordidas del barrio 0 a cada barrio], ...],      // 6 × 6, fila = origen, columna = mordido; promedio en todo el brote. Una mordida se reparte entre los barrios de los zombies que presionaban ese día, según su peso de contacto
      "vacunas_perdidas": 12.3,
      "salvados_vs_ninguna": { "media": ..., "mediana": ..., "p5": ..., "p95": ... },
      "salvados_vs_azar":    { "media": ..., "mediana": ..., "p5": ..., "p95": ... },
      "gana_a_ninguna": 0.98,       // solo entre los brotes en que hubo diferencia
      "gana_a_azar": 0.98,
      "empate_con_ninguna": 0.14,   // fracción de brotes con el mismo resultado
      "empate_con_azar": 0.14
    }
  ]
}
```

- `infectados`: personas que llegaron a ser mordidas en todo el brote (media, mediana y rango p5–p95 entre repeticiones).
- `curva_zombies`: zombies activos por día; sirve para la gráfica con banda de rango.
- `estados`: personas en cada estado del modelo, día a día: 🟢 `S` sanos,
  🟡 `E` mordidos (incuban, aún no contagian), 🔴 `I` zombies (contagian) y
  🔵 `R` exorcizados (inmunes). La media de los cuatro suma `n_personas` cada día;
  `estados.I` es igual a `curva_zombies`. La interfaz los muestra en el panel
  "02B / Estados día a día".
- `mapa[d][b] / poblacion_barrio[b]`: fracción de zombies en el barrio `b` el día `d`, para colorear el mapa.
- `salvados_vs_*`: diferencia pareada (misma semilla) de infectados frente a la línea base.

### Errores

| Código | Cuándo | Cuerpo |
|---|---|---|
| 400 | JSON inválido, campo desconocido o valor fuera de rango | `{"error": "r0 debe estar entre 0.5 y 10.0"}` |
| 404 | Ruta inexistente | `{"error": "No existe GET /api/otra"}` |

### Tiempo de respuesta

El motor simula las repeticiones en lotes vectorizados con numpy
(`modelo.simular_lote`). Un brote de 5.000 personas cuesta unos 10 ms en un núcleo
de 2,8 GHz; la Lambda de 2 GB es unas 2,4 veces más lenta (con el motor anterior,
50 repeticiones de 10.000 personas tardaban ~12 s en local y ~29 s en AWS).

| Repeticiones × 10 planes | Brotes | Local (medido) | Lambda 2 GB (estimado ×2,4) |
|---|---|---|---|
| 100 (por defecto) | 1.000 | ~8,5 s | ~20 s |
| 200 (máximo de la API) | 2.000 | ~19 s | ~45 s |
| 300 | 3.000 | ~29 s | ~70 s: no cabe en 60 s |
| 1.000 (CLI) | 10.000 | ~95 s | — |

Esa tabla es de la versión en serie. Ahora los planes se reparten entre procesos (2 en la Lambda de
3.008 MB, todos los núcleos en la CLI) y los lotes son de 50 repeticiones: en local, con 6 procesos,
300 repeticiones tardan 5,6 s. Con la estrategia adaptativa son 14 planes; con 2 procesos en local, 100
repeticiones tardan 9,4 s (escenario por defecto) y 17 s (R0 = 5). Falta medirlo en AWS después del despliegue.

Por eso la API usa 100 repeticiones por defecto y acepta hasta 300: el reto pide
1.000 por defecto, pero con 14 planes no caben en los 60 s de la Lambda. La CLI
(`python -m zombie.cli`, sin límite de tiempo) sí usa 1.000. Escala lineal con
`repeticiones` y con `n_personas`. Se puede verificar en AWS con la métrica
`Duration` de CloudWatch.

## `POST /api/edp`

Modelo de contraste: SEIR zombie con difusión espacial (EDP) sobre una cuadrícula
de Manta. No decide la recomendación; sirve para comparar con el modelo de red.
Ver `backend/src/zombie/edp.py`.

### Petición

El mismo `escenario` que `/api/simular` (se ignora `repeticiones`), más los
parámetros propios de la EDP. Todo es opcional.

```json
{
  "escenario": { "inicio": "aeropuerto", "plaga": { "r0": 2.5 } },
  "edp": { "d_sanos": 0.1, "d_zombies": 0.05, "alfa": 0.02 }
}
```

| Campo | Unidad | Límites |
|---|---|---|
| `d_sanos` | km²/día | 0 – 5 |
| `d_zombies` | km²/día | 0 – 5 |
| `alfa` | 1/día | 0 – 1 |

### Respuesta

```json
{
  "modelo": "edp",
  "parametros": { "d_sanos": 0.1, "d_zombies": 0.05, "alfa": 0.02, "beta": 0.55, "sigma": 0.3333, "gamma": 0.2 },
  "malla": { "lon_min": -80.92, "lon_max": -80.64, "lat_min": -1.08, "lat_max": -0.92, "dx_km": 0.5, "filas": 36, "columnas": 62 },
  "aeropuerto": [-80.6788, -0.9461],
  "escenarios": [
    { "id": "ninguna", "nombre": "Sin intervención",
      "serie": { "S": [...], "E": [...], "Z": [...], "R": [...] },
      "infectados_total": 7961.0, "pico": 974.9, "dia_pico": 64, "vacunas_usadas": 0,
      "fotogramas": [ { "dia": 0, "zombies": [[...], ...] }, { "dia": 10, "zombies": [[...], ...] } ] },
    { "id": "vacunacion_zonal", "nombre": "Vacunar por zonas", "...": "..." }
  ]
}
```

- `serie`: personas en cada estado por día (suman `n_personas`).
- `fotogramas`: zombies por celda cada día (cada 2 días o más si `dias` pasa de 180, para no superar los 6 MB de respuesta de Lambda); la fila 0 es el borde norte y la
  columna 0 el oeste, según `malla`. Sirve para el mapa de calor.

Tarda alrededor de 1,5 s y responde unos 450 KB.

## `POST /api/informe`

Informe para el alcalde en lenguaje simple. **El motor calcula y la IA solo redacta:** recibe el
resultado de una simulación ya hecha, no vuelve a simular y no cambia la recomendación ni el veredicto.
Ver `backend/src/zombie/informe_ia.py`.

Es un endpoint aparte de `/api/simular` por dos razones: la simulación no se vuelve más lenta, y si
Bedrock falla en vivo, la simulación sigue funcionando.

### Petición

Un resumen del resultado de `/api/simular` (la interfaz lo arma en `resumenParaInforme`). Las cifras
pueden ir sueltas o como rango `{ "media": ... }`. Máximo 50 KB y 64 planes.

```json
{
  "escenario": { "n_personas": 5000 },
  "repeticiones": 100,
  "recomendado": "centralidad",
  "veredicto": { "nivel": "solida", "gana_a_azar": 0.9, "empates_con_azar": 0.1,
                 "salvados_vs_ninguna": 812.4, "salvados_vs_azar": 120.0 },
  "planes": [
    { "id": "centralidad", "nombre": "centralidad", "tipo": "candidato", "vacunas": 1000, "costo": 5000,
      "infectados": 2287.6, "salvados_vs_ninguna": 812.4, "salvados_vs_azar": 120.0, "gana_a_azar": 0.9 }
  ]
}
```

### Respuesta

```json
{ "fuente": "bedrock", "modelo": "amazon.nova-micro-v1:0", "texto": "Se recomienda ..." }
```

- `fuente: "bedrock"`: lo redactó Amazon Bedrock (Converse API, máximo 400 tokens, temperatura 0,2).
- `fuente: "local"` y `modelo: null`: plantilla fija sin IA. Se usa cuando `IA_ACTIVA` no es `true` (por
  defecto en local) o cuando Bedrock falla; la interfaz la muestra como «Texto automático (sin IA)».

Al modelo solo le llega lo necesario (sin mapas ni curvas), más la cifra ya calculada para toda Manta,
para que no tenga que hacer cuentas. Las instrucciones le piden usar solo esas cifras, no presentar la
recomendación como garantía e ignorar cualquier instrucción que venga dentro de los datos. Si Bedrock
falla, en los logs queda solo el tipo de error, nunca los datos.

**Tope de gasto.** El endpoint es público y cada llamada a Bedrock se cobra, así que:

- Cada contenedor de la Lambda llama a Bedrock como mucho `IA_LLAMADAS_POR_MINUTO` veces por minuto (4 por
  defecto). Pasado ese cupo responde la plantilla, sin costo de Bedrock.
- Si se pide el informe del mismo resultado, se reutiliza el texto ya generado (caché de los últimos 256 por
  contenedor) y no se vuelve a pagar. Los fallos no se guardan.
- Cada llamada está acotada a 400 tokens de salida y a unos 1.100 de entrada (cuerpo de 50 KB como máximo,
  medido en bytes UTF-8).
- Tiempos de Bedrock: 3 s para conectar, 12 s de lectura y 2 intentos en total (≈ 31 s en el peor caso). Así,
  si Bedrock no responde, queda tiempo de devolver la plantilla antes del corte de 60 s de la Lambda.

Variables de entorno de la Lambda (`infra/template.yaml`): `IA_ACTIVA`, `MODELO_IA` e `IA_LLAMADAS_POR_MINUTO`. El permiso IAM
es solo `bedrock:InvokeModel` sobre ese modelo. Si se usa un ID que empieza con `us.` (un *inference
profile*), la política tiene que permitir también el ARN de ese perfil.

Respuesta 400 si falta algún campo, si el cuerpo pasa de 50 KB, si alguna cifra no es un número finito
(se rechazan `NaN`, `Infinity` y valores por encima de 10⁹) o si `nivel` no es `solida`, `debil` o
`insuficiente`.

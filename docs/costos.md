# Declaración de costos

Región: **us-east-1**. Precios on-demand tomados de la API de precios de AWS (`aws pricing get-products`)
el 28/10/2026. No se cuentan los créditos del plan gratuito.

## Cuánto consume cada acción (medido)

| Acción | Qué se usa | Medición |
|---|---|---|
| Simulación completa (`POST /api/simular`, 100 repeticiones × 14 planes, escenario por defecto) | Lambda de 3.008 MB (2,94 GB) | 13,1 a 14,9 s facturados → usamos **14 s = 41 GB-s**. Respuesta de 233 KB comprimida |
| Simulación del Brote Sorpresa (R0 = 5) | Lambda de 3.008 MB | 22,2 s facturados = **65 GB-s** |
| Mapa EDP (`POST /api/edp`) | Lambda de 3.008 MB | 1,9 s facturados → usamos **2 s = 6 GB-s**. Respuesta de 204 KB comprimida |
| Parámetros y salud (`GET /api/...`) | Lambda | 2 ms (despreciable) |
| Informe para el alcalde (`POST /api/informe`) | Amazon Bedrock (Nova Micro) + Lambda | Resumen de 2,6 KB + instrucciones ≈ **1.100 tokens de entrada**; respuesta de **400 tokens como máximo**. Lambda: ~2 s esperando a Bedrock |
| Primera visita a la web | CloudFront + S3 | 8 archivos, **0,52 MB** comprimidos (el código de MapLibre es la mayor parte) |
| Mosaicos del mapa | Esri, OpenStreetMap | Fuera de AWS y sin costo para nosotros |

Las duraciones salen de las líneas `REPORT` de CloudWatch Logs; los tamaños, de descargar cada recurso por
la URL pública (medido el 28/10/2026, después del despliegue de las 14:20). La Lambda usa solo ~220 MB de
memoria: se le asignan 3.008 MB porque en Lambda la CPU crece
con la memoria: con menos memoria cada simulación tendría menos CPU, tardaría más y se acercaría al límite
de 60 s de CloudFront.

Con 3.008 MB la Lambda tiene 2 vCPU y simula los planes en 2 procesos en paralelo. La simulación pasó de 10 a
14 planes (estrategia adaptativa) y el mapa trae un fotograma por día; por eso cuesta más que la primera
medición (12 s × 2 GB = 24 GB-s con 10 planes).

### Informe con IA (Amazon Bedrock)

Solo se llama cuando alguien pulsa «Explicar al alcalde»; si Bedrock falla, responde la plantilla sin IA y
no se cobra nada de Bedrock. Precio on-demand de Amazon Nova Micro en us-east-1: **$0,035 por millón de
tokens de entrada** y **$0,14 por millón de tokens de salida** (precio de lista de la página de Bedrock;
falta confirmarlo con `aws pricing get-products`, como el resto de la tabla).

**Gasto real en Bedrock: $0.** AWS le asignó a esta cuenta nueva una cuota de 0 solicitudes por minuto para
Nova Micro (y para los demás modelos que probamos), así que Bedrock responde `ThrottlingException` y el informe
sale con la plantilla sin IA. El aumento de cuota se pide a AWS Support; la tabla siguiente es el techo para cuando esté
activa.

| | Cálculo | Costo |
|---|---|---|
| Un informe (peor caso, 400 tokens de salida) | 1.100 × $0,035/M + 400 × $0,14/M | ≈ **$0,0001** |
| Lambda por informe | 2 s × 2,94 GB = 6 GB-s | ≈ $0,0001 |
| Uso normal, un informe por simulación (peor caso) | 3.000 × ($0,0001 + $0,0001) | ≈ **$0,59 al mes** |
| Brote activo, un informe por simulación | 30.000 × ($0,0001 + $0,0001) | ≈ **$5,90 al mes** |

**Tope de gasto.** El endpoint es público y no pide inicio de sesión, por eso el gasto en Bedrock tiene un
techo por diseño, en dos capas:

1. **Por contenedor:** cada contenedor de la Lambda llama a Bedrock una vez por minuto como máximo
   (`IA_LLAMADAS_POR_MINUTO`). Pasado ese cupo responde la plantilla sin IA, y el mismo resultado pedido otra
   vez sale de la caché. La cuenta admite 10 ejecuciones simultáneas de Lambda, así que aunque alguien enviara
   peticiones sin parar a varios contenedores, el peor caso sería 10 × 1 × 60 × 24 = 14.400 llamadas al día
   ≈ **$1,45 al día**.
2. **Para toda la cuenta (corte de gasto):** el Budget `zombie-zero-bedrock` mide solo el gasto real en Bedrock.
   Si en el mes pasa de **3 USD**, una acción de presupuesto adjunta sola la política `zombie-zero-sin-bedrock`
   al rol de la Lambda: Bedrock queda negado, el informe sigue saliendo con la plantilla sin IA y llega un
   correo. AWS Budgets actualiza el gasto varias veces al día, así que el corte llega con unas horas de
   retraso; con la capa 1, ese retraso cuesta como mucho unos centavos por hora. Está en
   `infra/github-oidc.yaml`, la pila que despliega un administrador; para reactivar la IA se quita la
   política del rol.

Bedrock no tiene capa gratuita. Los segundos de Lambda sí entran en la capa gratuita junto con los demás.
Las cifras son un techo: en la práctica el informe se pide mucho menos que la simulación. El gasto real de
Bedrock aparece en AWS Budgets con el resto de la cuenta.

## Costo mensual estimado de operación

Dos escenarios de uso para el Comité de Contención de Manta. Se supone que cada simulación va acompañada de
un cálculo del mapa EDP.

- **Uso normal:** 500 visitas, 3.000 simulaciones y 3.000 mapas al mes (unas 100 simulaciones por día).
- **Brote activo:** diez veces más: 5.000 visitas, 30.000 simulaciones y 30.000 mapas al mes.

### Uso normal

| Servicio | Cálculo del uso | Precio unitario | Costo |
|---|---|---|---|
| Lambda: cómputo | 3.000 × 41 GB-s + 3.000 × 6 GB-s = **141.000 GB-s** | $0,0000166667 por GB-s | $2,35 |
| Lambda: solicitudes | 3.000 + 3.000 + 500 (parámetros) = **6.500** | $0,20 por millón | $0,0013 |
| CloudFront: transferencia | 500 × 0,52 MB + 3.000 × 0,233 MB + 3.000 × 0,204 MB = **1,53 GB** | $0,085 por GB | $0,13 |
| CloudFront: solicitudes HTTPS | 500 × 9 + 3.000 + 3.000 = **10.500** | $0,01 por 10.000 | $0,011 |
| S3: almacenamiento | **2,3 MB** de la web | $0,023 por GB-mes | $0,0001 |
| S3: lecturas | peor caso, sin caché: 500 × 8 = **4.000 GET** | $0,004 por 10.000 | $0,0016 |
| CloudWatch Logs | ~1 KB por invocación × 6.500 = **6,2 MB** (se guardan 7 días) | $0,50 por GB ingerido | $0,0031 |
| S3 de resultados | 3.000 resúmenes × 3 kB = **9 MB** (se borran a los 90 días) y 3.000 PUT + 3.000 GET del historial | $0,023 por GB-mes · $0,005 por 1.000 PUT · $0,0004 por 1.000 GET | $0,016 |
| Athena + Glue | Consultas ocasionales del comité: 20 al mes × 10 MB como mínimo facturado = **0,2 GB** leídos; Glue: 1 base y 1 tabla | $5 por TB · catálogo gratis hasta 1 millón de objetos | $0,001 |
| CloudWatch alarmas, dashboard y SNS | 3 alarmas, 1 dashboard, avisos por correo | Gratis hasta 10 alarmas, 3 dashboards y 1.000 correos | $0 |
| AWS Budgets | 4 presupuestos con alertas por correo (ver README), 1 de ellos con acción (corte de Bedrock) | Los 2 primeros presupuestos con acciones son gratis; Cost Explorer no muestra cargos de AWS Budgets en octubre | $0 |
| **Total** | | | **≈ $2,52 al mes** |

### Brote activo (10 veces más uso)

| Servicio | Cálculo del uso | Costo |
|---|---|---|
| Lambda: cómputo | 30.000 × 41 + 30.000 × 6 = **1.410.000 GB-s** | $23,50 |
| Lambda: solicitudes | **65.000** | $0,013 |
| CloudFront: transferencia | **15,3 GB** | $1,30 |
| CloudFront: solicitudes HTTPS | **105.000** | $0,11 |
| S3 (almacenamiento y 40.000 GET) | | $0,016 |
| CloudWatch Logs | **62 MB** | $0,031 |
| S3 de resultados (90 MB, 30.000 PUT y GET) | | $0,16 |
| Athena + Glue (consultas ocasionales) | | $0,001 |
| **Total** | | **≈ $25,13 al mes** |

### Con la capa siempre gratuita de AWS

AWS no cobra cada mes los primeros 400.000 GB-s y 1 millón de solicitudes de Lambda, 1 TB y 10 millones de
solicitudes de CloudFront ni 5 GB de logs ([aws.amazon.com/free](https://aws.amazon.com/free)). Con eso:

| Escenario | Sin capa gratuita | Con capa gratuita |
|---|---|---|
| Uso normal | $2,52 | **≈ $0,02** (solo S3 de resultados y Athena, que no están en la capa siempre gratuita) |
| Brote activo | $25,13 | **≈ $16,99** (los 1.010.000 GB-s de Lambda que pasan de 400.000, más S3 de resultados y Athena) |

**Conclusión:** casi todo el costo es el cómputo de la Lambda, es decir, cuántas simulaciones se corren. La web y
la transferencia cuestan centavos. Como no hay servidores encendidos ni base de datos, si nadie usa la
herramienta el costo es prácticamente cero. Un mes de brote activo pasaría del AWS Budget de 10 USD, y el Budget avisaría por correo
al 80 %. El informe con IA va aparte (tabla de Bedrock), con su propio tope de 3 USD.

**Cómo bajarlo si hiciera falta:** pasar la Lambda a arm64 (Graviton), que cuesta un 20 % menos por GB-s
($0,0000133334), o bajar las repeticiones por defecto de 100 a 50, que reduce el cómputo casi a la mitad.

## Gasto real durante el evento

Acumulado del mes en curso. Cada fila es una medición; se agrega una nueva con
`infra/costos.sh`, que lee la cuenta y no cambia nada.

| Fecha y hora (Ecuador) | Gasto real de la cuenta (AWS Budgets) | Invocaciones de la Lambda | Cómputo de la Lambda | Valor a precio de lista (sin capa gratuita) | Solicitudes a CloudFront |
|---|---|---|---|---|---|
| 28/10/2026 00:38 | $0.00 | 79 | 466 s × 2 GB = 932 GB-s | $0.0155 | 152 |
| 28/10/2026 11:18 | $0.01 | 122 | 722 s × 3 GB = 2120 GB-s | $0.0353 | 352 |
| 28/10/2026 14:53 | $0.01 | 153 | 809 s × 3 GB = 2377 GB-s | $0.0396 | 485 |
| 28/10/2026 17:52 | $0.01 | 237 | 1195 s × 3 GB = 3511 GB-s | $0.0585 | 648 |

- **Gasto real:** sale de AWS Budgets y es el de toda la cuenta. Al 28/10 a las 17:52 eran 0,006 USD; por
  servicio (Cost Explorer): DynamoDB $0,0047, S3 $0,0012, Secrets Manager $0,00001, CloudFront menos de
  $0,000001, y $0 en Lambda, CloudWatch, SNS y Glue (capa gratuita). **Zombie Zero no usa DynamoDB:** ese
  gasto es de la tabla `zombie-zero-sessions`, de otro proyecto en la misma cuenta.
- **Cómputo:** suma de las métricas `Invocations` y `Duration` de CloudWatch desde el día 1 del mes. Todo
  está dentro de la capa gratuita, por eso el gasto real es cero.
- AWS Budgets actualiza el gasto con hasta un día de retraso, así que la última fila puede no reflejar
  todavía las simulaciones de las últimas horas.
- La captura del Budget está en [budget.png](budget.png).

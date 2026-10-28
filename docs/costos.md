# Declaración de costos

Región: **us-east-1**. Precios on-demand tomados de la API de precios de AWS (`aws pricing get-products`)
el 28/10/2026. No se cuentan los créditos del plan gratuito.

## Cuánto consume cada acción (medido)

| Acción | Qué se usa | Medición |
|---|---|---|
| Simulación completa (`POST /api/simular`, 100 repeticiones × 10 planes) | Lambda de 2 GB | 10,4 a 12,3 s facturados → usamos **12 s = 24 GB-s**. Respuesta de 48,6 KB |
| Mapa EDP (`POST /api/edp`) | Lambda de 2 GB | 1,7 s facturados → usamos **2 s = 4 GB-s**. Respuesta de 27,5 KB |
| Parámetros y salud (`GET /api/...`) | Lambda | 2 ms (despreciable) |
| Informe para el alcalde (`POST /api/informe`) | Amazon Bedrock (Nova Micro) + Lambda | Resumen de 2,6 KB + instrucciones ≈ **1.100 tokens de entrada**; respuesta de **400 tokens como máximo**. Lambda: ~2 s esperando a Bedrock |
| Primera visita a la web | CloudFront + S3 | 8 archivos, **0,52 MB** comprimidos (el código de MapLibre es la mayor parte) |
| Mosaicos del mapa | Esri, OpenStreetMap | Fuera de AWS y sin costo para nosotros |

Las duraciones salen de las líneas `REPORT` de CloudWatch Logs; los tamaños, de descargar cada recurso por
la URL pública. La Lambda usa solo ~120 MB de memoria: se le asignan 2 GB porque en Lambda la CPU crece
con la memoria: con menos memoria cada simulación tendría menos CPU, tardaría más y se acercaría al límite
de 60 s de CloudFront.

### Cambios del 28/10 que todavía hay que medir en AWS

La tabla anterior se midió con la Lambda de 2 GB. Desde la versión con Monte Carlo en paralelo:

- **La Lambda tiene 3.008 MB** (2 vCPU) y simula los planes en 2 procesos. Se cobra 1,47 veces más por segundo,
  pero cada simulación debería tardar menos: en local, con 2 procesos y lotes de 50 repeticiones, la misma
  simulación tarda menos de la mitad.
- **14 planes en vez de 10** (se sumó la estrategia adaptativa): cada simulación hace un 40 % más de cómputo.
  En local, con 2 procesos, tarda 9,4 s en el escenario por defecto y 17 s con R0 = 5.
- **El mapa trae un fotograma por día** en vez de uno cada 10 días: la respuesta pasa de 27,5 KB a unos
  85 KB comprimidos (4 MB sin comprimir; CloudFront la comprime).

Si la duración no bajara nada (peor caso, sin contar los 4 planes nuevos), una simulación costaría 12 s × 2,94 GB = **35 GB-s** y un mapa
2 s × 2,94 GB = **6 GB-s**. Con eso el uso normal pasaría de $1,46 a **≈ $2,12** al mes (sigue en $0 con la
capa gratuita) y el brote activo de $14,57 a **≈ $21,22** (≈ $13,80 con la capa gratuita, por encima del Budget
de 10 USD, que avisaría). Con los 4 planes nuevos y la duración proporcional (12 s × 1,4 = 17 s), serían 49 GB-s por simulación:
≈ $2,82 al mes en uso normal y ≈ $28,22 en un brote activo, sin la capa gratuita (3.000 y 30.000 simulaciones con su mapa, a $0,0000166667 por GB-s, más los mismos ≈ $0,07 y ≈ $0,72 del resto de servicios). Las cifras definitivas se
recalculan con `infra/costos.sh` después del despliegue.
`infra/costos.sh` multiplica los segundos de todo el mes por la memoria actual, así que las filas de ese mes
mezclan invocaciones de 2 GB y de 3.008 MB y sobreestiman un poco el cómputo.

### Informe con IA (Amazon Bedrock)

Solo se llama cuando alguien pulsa «Explicar al alcalde»; si Bedrock falla, responde la plantilla sin IA y
no se cobra nada de Bedrock. Precio on-demand de Amazon Nova Micro en us-east-1: **$0,035 por millón de
tokens de entrada** y **$0,14 por millón de tokens de salida** (precio de lista de la página de Bedrock;
falta confirmarlo con `aws pricing get-products`, como el resto de la tabla).

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
| Lambda: cómputo | 3.000 × 24 GB-s + 3.000 × 4 GB-s = **84.000 GB-s** | $0,0000166667 por GB-s | $1,40 |
| Lambda: solicitudes | 3.000 + 3.000 + 500 (parámetros) = **6.500** | $0,20 por millón | $0,0013 |
| CloudFront: transferencia | 500 × 0,52 MB + 3.000 × 0,049 MB + 3.000 × 0,028 MB = **0,48 GB** | $0,085 por GB | $0,041 |
| CloudFront: solicitudes HTTPS | 500 × 9 + 3.000 + 3.000 = **10.500** | $0,01 por 10.000 | $0,011 |
| S3: almacenamiento | **2,3 MB** de la web | $0,023 por GB-mes | $0,0001 |
| S3: lecturas | peor caso, sin caché: 500 × 8 = **4.000 GET** | $0,004 por 10.000 | $0,0016 |
| CloudWatch Logs | ~1 KB por invocación × 6.500 = **6,2 MB** (se guardan 7 días) | $0,50 por GB ingerido | $0,0031 |
| AWS Budgets | 1 presupuesto con alertas por correo | Sin costo (AWS cobra solo los informes programados y las acciones) | $0 |
| **Total** | | | **≈ $1,46 al mes** |

### Brote activo (10 veces más uso)

| Servicio | Cálculo del uso | Costo |
|---|---|---|
| Lambda: cómputo | 30.000 × 24 + 30.000 × 4 = **840.000 GB-s** | $14,00 |
| Lambda: solicitudes | **65.000** | $0,013 |
| CloudFront: transferencia | **4,8 GB** | $0,41 |
| CloudFront: solicitudes HTTPS | **105.000** | $0,11 |
| S3 (almacenamiento y 40.000 GET) | | $0,016 |
| CloudWatch Logs | **62 MB** | $0,031 |
| **Total** | | **≈ $14,57 al mes** |

### Con la capa siempre gratuita de AWS

AWS no cobra cada mes los primeros 400.000 GB-s y 1 millón de solicitudes de Lambda, 1 TB y 10 millones de
solicitudes de CloudFront ni 5 GB de logs ([aws.amazon.com/free](https://aws.amazon.com/free)). Con eso:

| Escenario | Sin capa gratuita | Con capa gratuita |
|---|---|---|
| Uso normal | $1,46 | **$0,00** (todo entra en la capa gratuita) |
| Brote activo | $14,57 | **≈ $7,35** (solo los 440.000 GB-s de Lambda que pasan de 400.000) |

**Conclusión:** casi todo el costo es el cómputo de la Lambda, es decir, cuántas simulaciones se corren. La web y
la transferencia cuestan centavos. Como no hay servidores encendidos ni base de datos, si nadie usa la
herramienta el costo es prácticamente cero. El AWS Budget de 10 USD avisaría si un mes de brote activo se acerca
a ese límite.

**Cómo bajarlo si hiciera falta:** pasar la Lambda a arm64 (Graviton), que cuesta un 20 % menos por GB-s
($0,0000133334), o bajar las repeticiones por defecto de 100 a 50, que reduce el cómputo casi a la mitad.

## Gasto real durante el evento

Acumulado del mes en curso. Cada fila es una medición; se agrega una nueva con
`infra/costos.sh`, que lee la cuenta y no cambia nada.

| Fecha y hora (Ecuador) | Gasto real de la cuenta (AWS Budgets) | Invocaciones de la Lambda | Cómputo de la Lambda | Valor a precio de lista (sin capa gratuita) | Solicitudes a CloudFront |
|---|---|---|---|---|---|
| 28/10/2026 00:38 | $0.00 | 79 | 466 s × 2 GB = 932 GB-s | $0.0155 | 152 |
| 28/10/2026 11:18 | $0.01 | 122 | 722 s × 3 GB = 2120 GB-s | $0.0353 | 352 |

- **Gasto real:** sale de AWS Budgets y es el de toda la cuenta. AWS Cost Explorer todavía no muestra datos
  de esta cuenta (tarda hasta 24 horas en activarse).
- **Cómputo:** suma de las métricas `Invocations` y `Duration` de CloudWatch desde el día 1 del mes. Todo
  está dentro de la capa gratuita, por eso el gasto real es cero.
- AWS Budgets actualiza el gasto con hasta un día de retraso, así que la última fila puede no reflejar
  todavía las simulaciones de las últimas horas.
- La captura del Budget está en [budget.png](budget.png).

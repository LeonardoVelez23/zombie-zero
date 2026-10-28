# Declaración de costos

Región: **us-east-1**. Precios on-demand tomados de la API de precios de AWS (`aws pricing get-products`)
el 28/10/2026. No se cuentan los créditos del plan gratuito.

## Cuánto consume cada acción (medido)

| Acción | Qué se usa | Medición |
|---|---|---|
| Simulación completa (`POST /api/simular`, 100 repeticiones × 10 planes) | Lambda de 2 GB | 10,4 a 12,3 s facturados → usamos **12 s = 24 GB-s**. Respuesta de 48,6 KB |
| Mapa EDP (`POST /api/edp`) | Lambda de 2 GB | 1,7 s facturados → usamos **2 s = 4 GB-s**. Respuesta de 27,5 KB |
| Parámetros y salud (`GET /api/...`) | Lambda | 2 ms (despreciable) |
| Primera visita a la web | CloudFront + S3 | 8 archivos, **0,52 MB** comprimidos (el código de MapLibre es la mayor parte) |
| Mosaicos del mapa | Esri, OpenStreetMap, CARTO | Fuera de AWS y sin costo para nosotros |

Las duraciones salen de las líneas `REPORT` de CloudWatch Logs; los tamaños, de descargar cada recurso por
la URL pública. La Lambda usa solo ~120 MB de memoria: se le asignan 2 GB porque en Lambda la CPU crece
con la memoria: con menos memoria cada simulación tendría menos CPU, tardaría más y se acercaría al límite
de 60 s de CloudFront.

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

- **Gasto real:** sale de AWS Budgets y es el de toda la cuenta. AWS Cost Explorer todavía no muestra datos
  de esta cuenta (tarda hasta 24 horas en activarse).
- **Cómputo:** suma de las métricas `Invocations` y `Duration` de CloudWatch desde el día 1 del mes. Todo
  está dentro de la capa gratuita, por eso el gasto real es cero.
- AWS Budgets actualiza el gasto con hasta un día de retraso, así que la última fila puede no reflejar
  todavía las simulaciones de las últimas horas.
- La captura del Budget está en [budget.png](budget.png).

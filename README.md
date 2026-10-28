# 🧟‍♀️ Zombie Zero — Comité de Contención de Manta

Herramienta que simula cómo se propaga una plaga en una red de contactos de
Manta (hogares, colegios, trabajo, buses y el Mercado Central) y recomienda
**a quién vacunar, dónde y cuándo** con recursos limitados. Compara la
estrategia propuesta contra dos líneas base (no intervenir y vacunar al azar)
con miles de simulaciones, y reporta cuánta gente se salva.

> Hackathon · Track B · La Plaga Zombie

**Estados:** 🟢 Sano (S) · 🟡 Mordido (E) · 🔴 Zombie (I) · 🔵 Exorcizado (R)

## Contenido

- [Qué hace](#qué-hace)
- [Cómo probarlo](#cómo-probarlo)
- [Parámetros por defecto y semilla](#parámetros-por-defecto-y-semilla)
- [Cómo desplegarlo](#cómo-desplegarlo)
- [Arquitectura](#arquitectura)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Supuestos y fuentes](#supuestos-y-fuentes)
- [Limitaciones conocidas](#limitaciones-conocidas)
- [Costos](#costos)
- [AWS Budget](#aws-budget)
- [Equipo y flujo de trabajo](#equipo-y-flujo-de-trabajo)

## Qué hace

_Pendiente: se completa al subir el motor (etapas 3 a 6)._

## Cómo probarlo

El repositorio tiene dos partes independientes que se comunican por HTTP:

- `backend/`: motor de simulación y API en Python.
- `frontend/`: interfaz web.

### Requisitos

- Python 3.11 o superior
- Node.js 22.22 o superior (para el frontend)

### 1. Backend

Una sola vez, para crear el entorno e instalar las dependencias:

```bash
cd backend
python -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Pruebas (deben pasar todas antes de cada push):

```bash
.venv/bin/python -m pytest -q
```

Levantar la API en `http://127.0.0.1:8000`, que es la que usa el frontend:

```bash
.venv/bin/python -m zombie.servidor
```

Para comprobar que responde: `http://127.0.0.1:8000/api/salud` devuelve
`{"estado": "ok"}`. Los endpoints están en [docs/api.md](docs/api.md).

Simular desde la terminal, sin interfaz (útil para el Brote Sorpresa):

```bash
.venv/bin/python -m zombie.cli                                   # escenario por defecto
.venv/bin/python -m zombie.cli --r0 5 --vacunas 500 --inicio mercado
.venv/bin/python -m zombie.cli --help                            # todos los parámetros
```

En Windows, cambia `.venv/bin/python` por `.venv\Scripts\python`.

### 2. Frontend

Con la API corriendo en otra terminal:

```bash
cd frontend
npm install
npm start        # http://localhost:4200
```

Detalles y arquitectura en [frontend/README.md](frontend/README.md).

_Pendiente: URL pública en AWS._

## Parámetros por defecto y semilla

_Pendiente: tabla de parámetros por defecto y semilla para reproducir los resultados._

## Cómo desplegarlo

Todo está en `infra/` y se despliega en `us-east-1` con una sola plantilla
(`infra/template.yaml`):

| Recurso | Para qué |
|---|---|
| Lambda (Python 3.13, 2 GB, 60 s) + **Function URL** | La API. Function URL en vez de API Gateway porque una simulación puede pasar de los 30 s que permite API Gateway |
| S3 privado + CloudFront | La interfaz web en Angular |
| AWS Budget | Alerta por correo al 80 % del gasto mensual y si el pronóstico pasa del 100 % |
| CloudWatch Logs | Logs de la API, guardados 7 días |

Requisitos: [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html),
[SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
y [uv](https://docs.astral.sh/uv/). Las credenciales nunca van en el repositorio:

```bash
aws configure sso                  # una vez; región us-east-1
aws sso login                      # cada vez que expire la sesión
aws sts get-caller-identity        # comprueba la cuenta

CORREO_ALERTA=equipo@ejemplo.com infra/desplegar.sh
```

`desplegar.sh` arma el paquete de la Lambda (`infra/empaquetar.sh` descarga
numpy compilado para Lambda, sin Docker), despliega la pila `zombie-zero` e
imprime `ApiUrl` y `FrontendUrl`. Para publicar la interfaz después de
compilarla:

```bash
infra/publicar-frontend.sh frontend/dist/zombie-zero-ui/browser
```

Para borrar todo: `aws cloudformation delete-stack --stack-name zombie-zero`
(antes hay que vaciar el bucket del frontend).

## Arquitectura

![Arquitectura de Zombie Zero en AWS](docs/arquitectura.png)

Archivo fuente editable: [`docs/arquitectura.drawio`](docs/arquitectura.drawio) (se abre en [diagrams.net](https://app.diagrams.net)).

- **Región:** us-east-1. Todo es serverless y se define en [`infra/template.yaml`](infra/template.yaml) (SAM).
- **Público:** CloudFront (la única URL que usa la app) y la Function URL de la Lambda.
  **Privado:** el bucket S3, que solo CloudFront puede leer mediante OAC.
- **Flujo de una visita:** el navegador pide la página a CloudFront, que la toma de S3. Las simulaciones van
  a `/api/*` en el mismo dominio y CloudFront las pasa a la Lambda sin caché (hasta 60 s). La Lambda arma la
  red de contactos, corre el Monte Carlo y devuelve el resultado; no hay base de datos, porque con la misma
  semilla el resultado es siempre el mismo. Los mosaicos del mapa los pide el navegador directamente a Esri,
  OpenStreetMap y CARTO.
- **Despliegue:** cada merge a `main` corre las pruebas en GitHub Actions y, si pasan, despliega con un rol de
  IAM que se obtiene por OIDC. No hay llaves de AWS guardadas en GitHub y el rol solo puede tocar los recursos
  de esta aplicación ([`infra/github-oidc.yaml`](infra/github-oidc.yaml)).
- **Costos:** el AWS Budget `zombie-zero-mensual` (10 USD) avisa por correo al 80 % del gasto real y al 100 %
  del gasto previsto.

## Decisiones de diseño

_Pendiente._

## Supuestos y fuentes

_Pendiente: `docs/supuestos.md`._

## Limitaciones conocidas

_Pendiente._

## Costos

Ver [docs/costos.md](docs/costos.md).

## AWS Budget

_Pendiente: captura `docs/budget.png` del AWS Budget con alerta._

## Equipo y flujo de trabajo

| Integrante | Responsabilidad |
|---|---|
| _Pendiente_ | Población de Manta (red de contactos) |
| _Pendiente_ | Modelo SEIR y parámetros |
| _Pendiente_ | Estrategias y Monte Carlo |
| _Pendiente_ | Interfaz, AWS y documentación |

Cada integrante trabaja en una rama (`feat/...`, `docs/...`, `fix/...`) y la
integra a `develop` con un pull request. Antes de cada push: `pytest` en verde.

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
- Node.js 20 o superior (para el frontend)

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

_Pendiente: el frontend en Angular está en construcción (ver
[frontend/README.md](frontend/README.md)). Se levantará con `npm install` y
`npm start` dentro de `frontend/`, con la API corriendo en otra terminal._

_Pendiente: URL pública en AWS._

## Parámetros por defecto y semilla

_Pendiente: tabla de parámetros por defecto y semilla para reproducir los resultados._

## Cómo desplegarlo

_Pendiente: pasos de despliegue en AWS (región us-east-1)._

## Arquitectura

_Pendiente: `docs/arquitectura.png` y su archivo fuente `docs/arquitectura.drawio`._

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

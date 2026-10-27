# Frontend (Angular)

Interfaz web del simulador. Llama a la API del backend (`POST /api/simular`);
el formato de la respuesta está en `docs/api.md`.

## Estructura

```
frontend/
├── public/                  archivos estáticos (íconos, imágenes)
└── src/app/
    ├── servicios/           api.service.ts: llamada HTTP a la API
    ├── modelos/             interfaces TypeScript de la respuesta de la API
    ├── utilidades/          textos para el alcalde y formato de números
    └── componentes/
        ├── controles/       parámetros, semilla y botones del Brote Sorpresa
        ├── informe/         recomendación en lenguaje simple
        ├── grafica/         curva de zombies con la banda p5-p95
        ├── mapa/            Manta por sector con MapLibre
        └── tabla/           comparación de todos los planes
```

## Pendiente

- Generar el proyecto con Angular CLI y mover los archivos a esta estructura.
- La URL de la API va en `src/environments/` (en local: `http://localhost:8000`).

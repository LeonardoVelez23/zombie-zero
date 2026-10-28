# Resultados guardados (S3 + Athena)

Cada `POST /api/simular` guarda un resumen de una línea JSON en el bucket
`zombie-zero-resultados-<cuenta>`, en `simulaciones/fecha=AAAA-MM-DD/<id>.json`.
La respuesta de la API trae ese id en `guardado` (o `null` si no se guardó).

- **Qué se guarda:** el escenario completo (semilla, inicio, plaga, recursos), el plan
  recomendado, el veredicto y, por cada plan, costo, vacunas, infectados (media, p5, p95) y
  salvados. No se guardan curvas ni mapas: pesan cientos de kB y se recalculan con la semilla.
- **Nada personal:** no se guarda el nombre del operador ni la IP.
- **De mejor esfuerzo:** si S3 falla o tarda más de 2 s, la simulación se entrega igual.
- **Costo:** cada resumen pesa unos 3 kB. Los objetos se borran a los 90 días y los
  resultados de Athena a los 7. El grupo de trabajo `zombie-zero` cancela cualquier consulta
  que lea más de 100 MB (Athena cobra 5 USD por TB leído: 100 MB ≈ 0,0005 USD).
- **En la interfaz:** la sección «Resultados anteriores» muestra las últimas 10 (de hoy y de
  ayer) con su configuración y su resultado, vía `GET /api/historial`. «Volver a simular»
  repite la misma configuración con la misma semilla y da el mismo resultado; «Descargar
  informe» baja un .txt con la configuración, la recomendación y todos los planes.
- **Permisos:** la Lambda solo puede escribir y leer en `simulaciones/` (política
  `zombie-zero-guardar-resultados` en `infra/github-oidc.yaml`); no puede borrar.

## Consultas de ejemplo

En la consola de Athena, con el grupo de trabajo `zombie-zero` y la base `zombie_zero`:

```sql
-- Simulaciones de hoy: qué se probó y qué plan se recomendó
SELECT momento, inicio, plaga.r0, recursos.vacunas_disponibles, recomendado, nivel, salvados_vs_ninguna
FROM simulaciones
WHERE fecha = cast(current_date AS varchar)
ORDER BY momento DESC;

-- Qué plan se recomienda más en todos los Brote Sorpresa
SELECT recomendado, count(*) AS veces, round(avg(salvados_vs_ninguna)) AS salvados_promedio
FROM simulaciones
GROUP BY recomendado
ORDER BY veces DESC;

-- Cada plan frente a no intervenir, en todas las simulaciones
SELECT p.nombre, round(avg(p.infectados)) AS infectados, round(avg(p.salvados)) AS salvados
FROM simulaciones CROSS JOIN UNNEST(planes) AS t(p)
GROUP BY p.nombre
ORDER BY salvados DESC;
```

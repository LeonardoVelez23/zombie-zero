# Supuestos y de dónde salen los números

Leyenda: **Fuente** = número tomado de literatura o datos abiertos ·
**Supuesto** = decisión del equipo, razonada · ⚠️ = cifra a verificar antes de entregar.

## La plaga (inspirada en COVID-19, variante original)

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| R0 | 2,5 | Fuente | La OMS y estudios de 2020 lo ubican entre 2 y 3 (Liu et al., *J Travel Med* 2020, revisión de 12 estudios). En el Brote Sorpresa, "el doble de contagiosa" equivale a R0 = 5. |
| Días de latencia (mordido → zombie) | 3 | Fuente | Incubación media de unos 5 días (Lauer et al., *Ann Intern Med* 2020) y contagio desde unos 2 días antes de los síntomas (He et al., *Nat Med* 2020). |
| Días infeccioso (zombie → exorcizado) | 5 | Fuente | La mayor parte del contagio ocurre en la primera semana (He et al., 2020). |
| Transmisión | Por contacto en la red | Supuesto | Enfermedad respiratoria, de persona a persona. No usamos el dengue porque necesita un vector (el mosquito). |
| Mortalidad | No se modela | Supuesto | El objetivo es minimizar los contagiados. Los exorcizados quedan inmunes. |
| Zombies detectados | 70 % | Supuesto | Parte de los casos no se detecta (por ejemplo, los asintomáticos). Un zombie no detectado no activa la vacunación en anillo. Ajustable en la interfaz. |

**Calibración:** el usuario elige R0 y el sistema busca la tasa de contagio
(`beta`) que produce ese R0 en la red (`modelo.calibrar_beta`). R0 se estima como
los contagios esperados de un zombie en una población sana, ponderados por su
número de contactos.

## La población (Manta)

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| Personas simuladas | 10.000 | Supuesto | Escala de Manta (⚠️ unos 270.000 habitantes, verificar en el Censo INEC 2022). Los resultados se leen como proporciones. |
| Barrios | Tarqui 30 %, Manta 25 %, Los Esteros 18 %, Eloy Alfaro 15 %, San Mateo 7 %, Rural 5 % | ⚠️ Supuesto | Parroquias de Manta. Hay que reemplazar los porcentajes por la población de cada parroquia según el INEC. |
| Edades | 0-4: 8 %, 5-17: 20 %, 18-64: 63 %, 65+: 9 % | ⚠️ Supuesto | Hay que verificarlas con la pirámide del Censo INEC 2022 para Manabí. |
| Personas por hogar | 3,5 en promedio | ⚠️ Supuesto | Hay que verificarlo con el Censo INEC 2022. |
| Tamaño de aula | 30 | Supuesto | Aula pública típica. |
| Tamaño de grupo de trabajo | 8 | Supuesto | Contactos laborales cercanos. |
| Adultos con trabajo fuera de casa | 60 % | ⚠️ Supuesto | Hay que verificarlo con la ENEMDU del INEC (tasa de empleo). |
| Usan bus a diario | 50 % de escolares y adultos, 4 contactos cercanos | Supuesto | |
| Van al Mercado Central (Tarqui) | 30 % de adultos y mayores, 6 contactos | Supuesto | |

**Pesos por capa** (cuánto contagia un día de contacto): hogar 1,0 · colegio 0,5 ·
trabajo 0,4 · bus 0,2 · mercado 0,15. Es un supuesto basado en que los contactos
del hogar son más largos y cercanos, como muestran los estudios de contactos
(Mossong et al., *PLoS Med* 2008, estudio POLYMOD).

## Las intervenciones

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| Presupuesto total | $20.000 | Supuesto | Se reparte entre vacunas y cierres. Lo que no se gasta en cierres se gasta en vacunas. |
| Costo por vacuna aplicada | $10 | Supuesto | Dosis más aplicación. |
| Vacunas disponibles | 1.000 (10 % de la población) | Supuesto | Stock máximo, aunque sobre dinero. Recurso escaso por diseño del reto. |
| Vacunas por día | 100 | Supuesto | Capacidad de una brigada de vacunación. |
| Día en que se empieza a actuar | 3 | Supuesto | Tiempo para detectar el brote y movilizar recursos. |
| Eficacia | 90 % | Fuente | Rango de las vacunas de ARNm en sus ensayos (Polack et al., *NEJM* 2020: 95 %). La vacuna reduce la probabilidad de ser mordido; no actúa sobre quien ya lo fue. |
| Cierre del mercado | $600 por día | Supuesto | Compensación a comerciantes. |
| Cierre de colegios | $800 por día | Supuesto | Costo de clases a distancia y cuidado infantil. |
| Duración de un cierre | 14 días | Supuesto | Dos periodos de latencia más infeccioso. |
| Cumplimiento del cierre | 80 % | Supuesto | Fracción de contactos de ese lugar que realmente se evitan. |
| Visibilidad | Solo se ven los zombies detectados | Supuesto | Por eso una vacuna puede "perderse" en alguien ya mordido o no detectado. El sistema lo reporta. |

## Reproducibilidad

La semilla fija la red de Manta y cada repetición `r` usa
`SeedSequence([semilla, r])`. Todas las estrategias comparten los mismos números
aleatorios del brote, así que con la misma configuración y la misma semilla el
resultado es idéntico (lo prueba `tests/test_simulador.py`).

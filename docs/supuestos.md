# Supuestos y de dónde salen los números

Leyenda: **Fuente** = número tomado de literatura o datos abiertos ·
**Supuesto** = decisión del equipo, razonada. Las referencias [n] están al final.

## La plaga (inspirada en COVID-19, variante original)

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| R0 | 2,5 | Fuente | La OMS y estudios de 2020 lo ubican entre 2 y 3 (Liu et al., *J Travel Med* 2020, revisión de 12 estudios). En el Brote Sorpresa, "el doble de contagiosa" equivale a R0 = 5. |
| Días de latencia (mordido → zombie) | 3 | Fuente | Incubación media de unos 5 días (Lauer et al., *Ann Intern Med* 2020) y contagio desde unos 2 días antes de los síntomas (He et al., *Nat Med* 2020). |
| Días infeccioso (zombie → exorcizado) | 5 | Fuente | La mayor parte del contagio ocurre en la primera semana (He et al., 2020). |
| Transmisión | Por contacto en la red | Supuesto | Enfermedad respiratoria, de persona a persona. No usamos el dengue porque necesita un vector (el mosquito). |
| Mortalidad | No se modela | Supuesto | El objetivo es minimizar los contagiados. Los exorcizados quedan inmunes. |
| Zombies detectados | 40 % | Supuesto con fuente | Al comienzo de la COVID-19 en China, el 86 % de las infecciones no se documentó (Li et al., *Science* 2020), y cerca del 35 % de los infectados nunca tiene síntomas (Sah et al., *PNAS* 2021). Tomamos un 40 %, entre esos dos extremos. Un zombie no detectado no activa la vacunación en anillo. Ajustable en la interfaz. |
| Inicio "aeropuerto" (historia del brote) | Equipo de rescate de hasta 8 personas, mordidos | Supuesto | Un avión llega lleno de zombies y muerden a los bomberos y médicos que lo abren. El equipo es un grupo de trabajo de la red; empieza como mordidos (E), sin detectar, y contagia a sus familias al volverse zombies. Los pasajeros quedan aislados en el aeropuerto. |

**Calibración:** el usuario elige R0 y el sistema busca la tasa de contagio
(`beta`) que produce ese R0 en la red (`modelo.calibrar_beta`). R0 se estima como
los contagios esperados de un zombie en una población sana, ponderados por su
número de contactos.

## La población (Manta)

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| Personas simuladas | 5.000 | Supuesto | Manta tiene **271.145 habitantes** según el Censo 2022 [1]. Se simula a escala 1:54 (el reto pide de 2.000 a 5.000 nodos) y los resultados se leen como proporciones. Con 5.000 personas, 1.000 brotes caben en el límite de 60 s de la Lambda (ver `docs/api.md`). Ajustable de 1.000 a 20.000. |
| Zona rural | 4,6 % | Fuente | 12.448 personas viven en el área rural (parroquias San Lorenzo y Santa Marianita) y 258.697 en el área urbana [1]. |
| Parroquias urbanas | Tarqui 30,1 %, Manta 25,1 %, Los Esteros 18,1 %, Eloy Alfaro 15,1 %, San Mateo 7,0 % | Supuesto | El INEC publica la ciudad como un solo bloque urbano; no encontramos datos públicos del Censo 2022 por parroquia urbana. El reparto refleja que Tarqui es la parroquia más poblada [4] y se puede reemplazar con los tabulados por parroquia del INEC. |
| Edades | 0-4: 8,1 %, 5-17: 20,4 %, 18-64: 63,5 %, 65+: 8,0 % | Fuente | Manta, Censo 2022: 0-14 años = 66.266 (24,4 %), 15-64 = 183.270 (67,6 %), 65+ = 21.609 (8,0 %) [1]. Para pasar a nuestros grupos se supone un reparto uniforme dentro de cada grupo del censo: 0-4 = 5/15 de 0-14; 5-17 = 10/15 de 0-14 más 3/50 de 15-64; 18-64 = 47/50 de 15-64. |
| Personas por hogar | 3,3 en promedio | Fuente | Tamaño medio del hogar en Manabí, Censo 2022 (bajó de 4,0 en 2010) [2]. |
| Tamaño de aula | 30 | Supuesto | Aula pública típica. |
| Tamaño de grupo de trabajo | 8 | Supuesto | Contactos laborales cercanos. |
| Adultos con trabajo fuera de casa | 56 % | Fuente | Tasa de empleo bruto de Manabí en 2025: 55,9 % (personas con empleo / población en edad de trabajar), ENEMDU anual 2025, Tabla 4 [3]. Incluye el empleo informal, que también genera contactos. |
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
| Vacunas disponibles | 500 (10 % de la población) | Supuesto | Stock máximo, aunque sobre dinero. Recurso escaso por diseño del reto: con 1.000 dosis (20 %) hasta repartirlas al azar frenaba la mitad del brote y el escenario era demasiado fácil. |
| Vacunas por día | 50 | Supuesto | Capacidad de una brigada pequeña para toda la ciudad: con 500 dosis, la vacunación dura al menos 10 días. |
| Día en que se empieza a actuar | 21 | Supuesto | Tres semanas desde que llega el avión: los primeros zombies aparecen hacia el día 3, se confunden con otras enfermedades, hay que confirmar el brote y movilizar las brigadas. Con 3 días el escenario era poco creíble: se actuaba cuando apenas había casos. |
| Eficacia | 90 % | Fuente | Rango de las vacunas de ARNm en sus ensayos (Polack et al., *NEJM* 2020: 95 %). La vacuna reduce la probabilidad de ser mordido; no actúa sobre quien ya lo fue. |
| Cierre del mercado | $600 por día | Supuesto | Compensación a comerciantes. |
| Cierre de colegios | $800 por día | Supuesto | Costo de clases a distancia y cuidado infantil. |
| Duración de un cierre | 14 días | Supuesto | Dos periodos de latencia más infeccioso. |
| Cumplimiento del cierre | 80 % | Supuesto | Fracción de contactos de ese lugar que realmente se evitan. |
| Corte de vacunas | Sin corte por defecto | Imprevisto | Bloqueos de vías como los paros de 2019 y 2022 en Ecuador dificultaron el abastecimiento durante 11 y 18 días. Durante el corte no se vacuna; al reanudarse cada plan decide con lo que observa ese día. |
| Visibilidad | Solo se ven los zombies detectados | Supuesto | Por eso una vacuna puede "perderse" en alguien ya mordido o no detectado. El sistema lo reporta. |

### Dificultad del escenario por defecto

Los organizadores pidieron calibrar un escenario de dificultad creíble. Con nuestros primeros valores
(70 % de detección, actuar desde el día 3 y 1.000 vacunas) la estrategia recomendada bajaba los
infectados un 99 %: un resultado que parece armado a propósito. Con los valores actuales el problema es
difícil de verdad: repartir las vacunas al azar casi no sirve y la estrategia tiene que elegir bien.

Medido con el inicio en el aeropuerto, 5.000 personas y 100 repeticiones (infectados en promedio):

| Escenario | Sin intervenir | Vacunas al azar | Estrategia recomendada | Gana al azar (empates aparte) |
|---|---|---|---|---|
| Inicial (70 %, día 3, 1.000 vacunas), semilla 42 | 2.204 | 1.080 | 23 (−99 %) | 99 % (4 % de empates) |
| Actual (40 %, día 21, 500 vacunas), semilla 42 | 2.204 | 1.795 | 546 (−75 %), p5–p95: 7–1.767 | 100 % (14 % de empates) |
| Actual, semilla 7 | 2.204 | 1.818 | 552 (−75 %), p5–p95: 8–1.705 | 99 % (11 % de empates) |

El rango p5–p95 muestra que en algunos brotes la plaga se escapa aun con la mejor estrategia; por eso
se reportan rangos y no una sola simulación. "Gana al azar" se cuenta solo entre los brotes en que hubo
diferencia: en un empate la plaga se apagó sola antes del día en que se empieza a actuar y ningún plan
llegó a influir.

Con el Brote Sorpresa "el doble de contagiosa" (R0 = 5) ningún plan supera al azar: con R0 = 5 haría falta
inmunizar a cerca del 80 % de la población (1 − 1/R0) y solo hay vacunas para el 10 %. El sistema lo informa
como "recursos insuficientes" en vez de presentar un plan como ganador.

Con el imprevisto de un corte de vacunas (semilla 42, 100 repeticiones):

| Corte | Recomendación | Infectados | Salvados frente a no intervenir | Gana al azar |
|---|---|---|---|---|
| Sin corte | anillo + cerrar colegio | 546 | 1.658 | 100 % |
| Desde el día 30, durante 21 días | anillo + cerrar colegio | 591 | 1.613 | 100 % |
| Desde el día 21, durante 30 días | centralidad + cerrar colegio | 995 | 1.209 | 100 % |

Si el corte llega justo cuando se empieza a actuar, el anillo pierde su ventaja: cuando vuelven las
vacunas el brote ya es grande y vacunar alrededor de cada zombie llega tarde, así que conviene proteger
primero a los superpropagadores.

## Modelo de contraste (EDP espacial)

El modelo de red decide la recomendación. Para compararlo con un modelo clásico
resolvemos además el sistema SEIR zombie con difusión
(`backend/src/zombie/edp.py`, `POST /api/edp`), en la línea de
Munz et al. (2009) [5].

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| β, σ, γ | Calibrados con R0, latencia y días infeccioso | Fuente | Los mismos de la tabla de la plaga: R0 = β / (γ + α). |
| Contagio por frecuencia (β S Z / N) | — | Supuesto | Así R0 no depende de la densidad de cada celda y se compara con la red. |
| α (zombies eliminados por la población) | 0,02 por día | Supuesto | Término de Munz et al. (2009). Los eliminados pasan a R para que la población se conserve. |
| D_S (sanos, mordidos, exorcizados) | 0,1 km²/día | Supuesto | Movilidad neta: la gente se mueve de día pero vuelve a casa. Ajustable. |
| D_Z (zombies) | 0,05 km²/día | Supuesto | Los zombies se mueven más lento que los sanos. Ajustable. |
| Cuadrícula | Celdas de 0,5 km | Supuesto | La población de cada sector se reparte como una mancha gaussiana de 1 km (3 km en la zona rural) alrededor de su centro aproximado. No distingue mar y tierra dentro de la zona poblada. |
| Vacunar por zonas | Dosis del día repartidas según los zombies de cada celda | Supuesto | La EDP no distingue personas: la dosis llega a todos los de la celda y solo protege a los sanos. Es el equivalente continuo de la vacunación en anillo. |

**Lo que muestra el contraste:** la EDP mezcla a todos los de una celda, así que
contagia más que la red (sin intervención, unos 7.960 contra unos 4.000 desde el
aeropuerto) y vacunar por zonas salva poco. La red sabe quién es contacto de quién
y por eso la vacunación en anillo es mucho más eficaz con las mismas dosis.

## Referencias de datos abiertos

1. INEC, Censo de Población y Vivienda 2022: población del cantón Manta por área y grupos de edad, vía [citypopulation.de](https://www.citypopulation.de/en/ecuador/admin/manab%C3%AD/1308__manta/) y [ecuadorencifras.gob.ec](https://www.ecuadorencifras.gob.ec/institucional/201-279-personas-mas-viven-en-manabi/).
2. INEC, "201.279 personas más viven en Manabí" (resultados del Censo 2022 para Manabí): [ecuadorencifras.gob.ec](https://www.ecuadorencifras.gob.ec/institucional/201-279-personas-mas-viven-en-manabi/).
3. INEC, Boletín técnico ENEMDU anual enero-diciembre 2025, Tabla 4: [PDF](https://www.ecuadorencifras.gob.ec/documentos/web-inec/EMPLEO/2025/anual/Boletin_tecnico_anual_enero-diciembre_2025.pdf).
4. El Diario, "La Parroquia Tarqui está de fiesta…" (2025): [eldiario.ec](https://www.eldiario.ec/manta/la-parroquia-tarqui-esta-de-fiesta-este-9-de-octubre-celebra-96-anos-de-historia-y-empuje-26092025/).

5. Munz, P., Hudea, I., Imad, J. y Smith?, R. J. (2009). "When zombies attack!: Mathematical modelling of an outbreak of zombie infection". En *Infectious Disease Modelling Research Progress*, Nova Science, pp. 133-150.

## Monte Carlo

| Parámetro | Valor | Tipo | Justificación |
|---|---|---|---|
| Repeticiones por plan (CLI) | 1.000 | Reto | Lo pide el reglamento. `--n-sims` lo cambia. |
| Repeticiones por plan (API e interfaz) | 100 (máximo 300) | Medido | Los planes se simulan en procesos paralelos (2 en la Lambda de 3.008 MB). Tiempos en `docs/api.md`; falta medir el máximo en AWS. |
| Estadísticos | Media, mediana y rango p5–p95 | Reto | De infectados totales, pico de zombies y personas salvadas frente a cada línea base. |
| Contagio en la simulación | Umbral exponencial por persona (Sellke) | Supuesto | Cada persona sortea una vez un umbral ~ Exponencial(1) y es mordida cuando la presión acumulada de sus contactos zombies lo supera. Es equivalente a sortear cada día con probabilidad 1 − exp(−β · presión), pero permite simular muchos brotes a la vez. Latencia e infeccioso son geométricas con media 3 y 5 días, como el sorteo diario. |

## Reproducibilidad

La semilla fija la red de Manta y cada repetición `r` usa
`SeedSequence([semilla, r]).spawn(3)` (inicio, brote y estrategia). El resultado de
la repetición `r` no depende de con qué otras repeticiones se simule en el lote. Todas las estrategias comparten los mismos números
aleatorios del brote, así que con la misma configuración y la misma semilla el
resultado es idéntico (lo prueba `backend/tests/test_simulador.py`).

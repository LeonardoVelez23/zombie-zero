"""Motor SEIR sobre la red de contactos, en pasos de un día.

Estados: 🟢 S sano · 🟡 E mordido · 🔴 I zombie · 🔵 R exorcizado.

Reproducibilidad: cada repetición usa SeedSequence([semilla, repetición]) y la
divide en flujos independientes (inicio, brote, estrategia). Los números del brote
de cada persona se sacan al empezar y no dependen de la estrategia, así que todas
las estrategias enfrentan exactamente la misma "suerte" (números aleatorios
comunes) y la comparación entre ellas es justa.

Rendimiento: `simular_lote` avanza muchas repeticiones a la vez con operaciones
de numpy sobre arreglos (repetición, persona), en vez de un bucle por repetición.
"""
from dataclasses import dataclass

import numpy as np

from .config import Escenario, Plaga
from .poblacion import BARRIOS, CAPAS, ESCOLAR, TAM_TRABAJO, TRABAJO, Red

S, E, I, R = 0, 1, 2, 3
CERRABLES = {"mercado": CAPAS.index("mercado"), "colegio": CAPAS.index("colegio")}


@dataclass
class Observacion:
    """Lo que el Comité de Contención puede ver un día dado.

    Solo se ve a los zombies detectados. Un mordido (E), un zombie no detectado o
    un exorcizado que nunca se detectó parecen sanos, así que una estrategia puede
    gastar una vacuna en ellos sin saberlo.
    """
    dia: int
    red: Red
    visible: np.ndarray      # True si se detectó como zombie alguna vez
    vacunado: np.ndarray
    zombies: np.ndarray      # índices de los zombies activos detectados

    def elegibles(self) -> np.ndarray:
        return np.flatnonzero(~self.visible & ~self.vacunado)


@dataclass
class Resultado:
    serie: np.ndarray        # (dias + 1, 4): cuántos S, E, I, R hay cada día
    serie_barrio: np.ndarray  # (dias + 1, len(BARRIOS)): zombies activos por barrio
    nuevos: np.ndarray       # mordidos nuevos cada día
    infectados_total: int
    vacunas_usadas: int
    vacunas_perdidas: int    # aplicadas a quien ya no estaba sano
    # Al final y opcional: así la firma anterior del constructor sigue sirviendo.
    afectados_barrio: np.ndarray | None = None  # (dias + 1, len(BARRIOS)): mordidos acumulados por barrio

    @property
    def pico(self) -> int:
        return int(self.serie[:, I].max())

    @property
    def dia_pico(self) -> int:
        return int(self.serie[:, I].argmax())


def _probabilidad_contagio(beta: float, peso: np.ndarray, plaga: Plaga) -> np.ndarray:
    """Probabilidad de que un zombie muerda a un contacto durante todo su periodo infeccioso.

    El periodo infeccioso dura T días con T ~ Geométrica(1/dias_infeccioso);
    cada día la probabilidad de contagio es 1 - exp(-beta * peso).
    """
    q = 1.0 / plaga.dias_infeccioso
    escape = np.exp(-beta * peso)
    return 1.0 - q * escape / (1.0 - (1.0 - q) * escape)


def estimar_r0(red: Red, beta: float, plaga: Plaga) -> float:
    """R0 de primera generación en una población totalmente sana.

    Promedio de contagios esperados por zombie, ponderado por la fuerza de contacto
    (quien tiene más contactos tiene más probabilidad de ser mordido primero).
    """
    p = _probabilidad_contagio(beta, red.peso, plaga)
    por_persona = np.bincount(red.origen, weights=p, minlength=red.n)
    return float(np.average(por_persona, weights=red.fuerza))


def calibrar_beta(red: Red, plaga: Plaga) -> float:
    """Busca por bisección el beta que produce el R0 pedido en esta red."""
    bajo, alto = 0.0, 5.0
    for _ in range(60):
        medio = (bajo + alto) / 2
        if estimar_r0(red, medio, plaga) < plaga.r0:
            bajo = medio
        else:
            alto = medio
    return (bajo + alto) / 2


def _desde_aeropuerto(red: Red, casos: int, rng: np.random.Generator) -> np.ndarray:
    """Un avión llega lleno de zombies y muerden al equipo de rescate que lo abre.

    El equipo (bomberos y médicos) es un grupo de trabajo de la red: se conocen
    entre sí, viven en barrios distintos y vuelven a casa sin saber que fueron
    mordidos. Los pasajeros quedan aislados en el aeropuerto y no entran a la red.
    """
    casos = min(casos, TAM_TRABAJO)
    companeros = np.bincount(red.origen[red.capa == TRABAJO], minlength=red.n)
    jefe = rng.choice(np.flatnonzero(companeros >= casos - 1))
    aristas = red.aristas_de(np.array([jefe]))
    equipo = red.destino[aristas][red.capa[aristas] == TRABAJO]
    otros = rng.choice(equipo, size=casos - 1, replace=False)
    return np.concatenate([[jefe], otros]).astype(np.int64)


def casos_iniciales(red: Red, esc: Escenario, rng: np.random.Generator) -> np.ndarray:
    if esc.inicio == "aeropuerto":
        return _desde_aeropuerto(red, esc.casos_iniciales, rng)
    if esc.inicio == "aleatorio":
        candidatos = np.arange(red.n)
    elif esc.inicio == "mercado":
        candidatos = np.flatnonzero(red.va_mercado)
    elif esc.inicio == "colegio":
        candidatos = np.flatnonzero(red.edad == ESCOLAR)
    elif esc.inicio in BARRIOS:
        candidatos = np.flatnonzero(red.barrio == BARRIOS.index(esc.inicio))
    else:
        raise ValueError(f"Punto de inicio desconocido: {esc.inicio!r}")
    return rng.choice(candidatos, size=min(esc.casos_iniciales, len(candidatos)), replace=False)


def simular(red: Red, esc: Escenario, estrategia, beta: float, repeticion: int = 0,
            cierres: tuple[str, ...] = (), vacunas: int | None = None) -> Resultado:
    """Simula un brote completo (una sola repetición). Ver `simular_lote`."""
    return simular_lote(red, esc, estrategia, beta, [repeticion], cierres, vacunas).resultado(0)


@dataclass
class Lote:
    """Resultados de varias repeticiones del mismo plan, apiladas en el primer eje."""
    serie: np.ndarray          # (R, dias + 1, 4)
    serie_barrio: np.ndarray   # (R, dias + 1, len(BARRIOS))
    nuevos: np.ndarray         # (R, dias + 1)
    vacunas_usadas: np.ndarray  # (R,)
    vacunas_perdidas: np.ndarray  # (R,)
    afectados_barrio: np.ndarray | None = None  # (R, dias + 1, len(BARRIOS)); opcional como en Resultado

    @property
    def infectados_total(self) -> np.ndarray:
        return self.serie[:, -1, :].sum(axis=1) - self.serie[:, -1, S]

    def resultado(self, k: int) -> Resultado:
        return Resultado(serie=self.serie[k], serie_barrio=self.serie_barrio[k],
                         afectados_barrio=None if self.afectados_barrio is None else self.afectados_barrio[k],
                         nuevos=self.nuevos[k], infectados_total=int(self.infectados_total[k]),
                         vacunas_usadas=int(self.vacunas_usadas[k]),
                         vacunas_perdidas=int(self.vacunas_perdidas[k]))


def simular_lote(red: Red, esc: Escenario, estrategia, beta: float, repeticiones,
                 cierres: tuple[str, ...] = (), vacunas: int | None = None) -> Lote:
    """Simula varias repeticiones a la vez, vectorizado con numpy.

    `estrategia` decide a quién vacunar cada día, con como máximo `vacunas` dosis
    en total (por defecto, todo el stock). `cierres` son los lugares que se cierran
    desde el día en que se detecta el brote durante `dias_cierre` días.

    Azar de cada repetición r (independiente de qué otras repeticiones vayan en el lote):
    SeedSequence([semilla, r]).spawn(3) da tres flujos (inicio, brote, estrategia).
    Del flujo del brote se sacan, una sola vez y al empezar, los números de cada persona:
      - umbral ~ Exponencial(1): la persona es mordida el día en que la presión de
        contagio acumulada (suma de beta * peso de contacto con zombies) lo supera.
        Equivale a contagiarse cada día con probabilidad 1 - exp(-beta * presión)
        (construcción de Sellke), pero sin sortear de nuevo cada día;
      - días de latencia ~ Geométrica(1/dias_latencia) y días infeccioso ~
        Geométrica(1/dias_infeccioso), las mismas distribuciones que el sorteo diario;
      - si será detectada cuando se vuelva zombie (probabilidad `deteccion`).
    Como esos números no dependen de la estrategia, todas las estrategias enfrentan
    la misma "suerte" en la repetición r (números aleatorios comunes).
    """
    repeticiones = list(repeticiones)
    nr, n, dias = len(repeticiones), red.n, esc.dias
    plaga, recursos = esc.plaga, esc.recursos
    vacunas = recursos.vacunas_disponibles if vacunas is None else vacunas
    nb = len(BARRIOS)

    estado = np.full((nr, n), S, dtype=np.int8)
    umbral = np.empty((nr, n))
    latencia = np.empty((nr, n), dtype=np.int32)
    infeccioso = np.empty((nr, n), dtype=np.int32)
    detectable = np.empty((nr, n), dtype=bool)
    detectado = np.zeros((nr, n), dtype=bool)
    vacunado = np.zeros((nr, n), dtype=bool)
    agenda: dict[int, list[np.ndarray]] = {}   # día -> personas (índice plano) que cambian de estado ese día

    def agendar(dia_cambio: np.ndarray, personas: np.ndarray) -> None:
        for d in np.unique(dia_cambio):
            agenda.setdefault(int(d), []).append(personas[dia_cambio == d])
    rng_estrategia = []
    for k, r in enumerate(repeticiones):
        rng_inicio, rng_brote, rng_est = (
            np.random.default_rng(s) for s in np.random.SeedSequence([esc.semilla, r]).spawn(3))
        iniciales = casos_iniciales(red, esc, rng_inicio)
        umbral[k] = rng_brote.standard_exponential(n)
        latencia[k] = rng_brote.geometric(1.0 / plaga.dias_latencia, n)
        infeccioso[k] = rng_brote.geometric(1.0 / plaga.dias_infeccioso, n)
        detectable[k] = rng_brote.random(n) < plaga.deteccion
        if esc.inicio == "aeropuerto":
            # Recién mordidos: nadie sabe que lo están hasta que se vuelven zombies.
            estado[k, iniciales] = E
            agendar(latencia[k, iniciales], k * n + iniciales)
        else:
            estado[k, iniciales] = I
            agendar(infeccioso[k, iniciales], k * n + iniciales)
            detectado[k, iniciales] = rng_inicio.random(len(iniciales)) < plaga.deteccion
        rng_estrategia.append(rng_est)

    # Vistas planas (repetición k, persona i) -> k * n + i.
    est, det = estado.ravel(), detectado.ravel()
    umb, lat, inf, detec, vac = (umbral.ravel(), latencia.ravel(), infeccioso.ravel(),
                                 detectable.ravel(), vacunado.ravel())
    presion_acumulada = np.zeros(nr * n)

    factor_cerrado = np.ones(len(CAPAS))
    for lugar in cierres:
        factor_cerrado[CERRABLES[lugar]] = 1.0 - recursos.cumplimiento_cierre
    fin_cierre = recursos.dia_inicio + recursos.dias_cierre

    usadas = np.zeros(nr, dtype=np.int64)
    perdidas = np.zeros(nr, dtype=np.int64)
    serie = np.zeros((nr, dias + 1, 4), dtype=np.int64)
    serie_barrio = np.zeros((nr, dias + 1, nb), dtype=np.int64)
    nuevos = np.zeros((nr, dias + 1), dtype=np.int64)

    conteo = np.stack([(estado == s).sum(axis=1) for s in (S, E, I, R)], axis=1)
    zombies = np.flatnonzero(est == I)

    def por_barrio(flat):
        return np.bincount((flat // n) * nb + red.barrio[flat % n], minlength=nr * nb).reshape(nr, nb)

    serie[:, 0] = conteo
    serie_barrio[:, 0] = por_barrio(zombies)
    afectados_barrio = np.zeros_like(serie_barrio)   # quienes ya no están sanos (E, I o R)
    afectados_barrio[:, 0] = por_barrio(np.flatnonzero(est != S))
    vivas = conteo[:, E] + conteo[:, I] > 0

    for dia in range(1, dias + 1):
        # 1. Vacunación del día con las dosis disponibles (cada repetición decide por su cuenta).
        en_corte = recursos.corte_desde <= dia < recursos.corte_desde + recursos.corte_dias
        if vacunas > 0 and dia >= recursos.dia_inicio and not en_corte:
            for k in np.flatnonzero(vivas & (usadas < vacunas)):
                dosis = int(min(recursos.vacunas_por_dia, vacunas - usadas[k]))
                obs = Observacion(dia, red, detectado[k], vacunado[k],
                                  np.flatnonzero(detectado[k] & (estado[k] == I)))
                elegidos = np.asarray(estrategia.elegir(obs, dosis, rng_estrategia[k]), dtype=np.int64)
                _validar(elegidos, obs, dosis, estrategia)
                vacunado[k, elegidos] = True
                usadas[k] += len(elegidos)
                perdidas[k] += int((estado[k, elegidos] != S).sum())

        # 2. Contagio: presión de los zombies sobre sus contactos (menor en lugares cerrados).
        mordidos = np.empty(0, dtype=np.int64)
        if zombies.size:
            persona = zombies % n
            aristas = red.aristas_de(persona)
            grado = red.indptr[persona + 1] - red.indptr[persona]
            destino = np.repeat(zombies - persona, grado) + red.destino[aristas]
            peso = red.peso[aristas]
            if cierres and recursos.dia_inicio <= dia < fin_cierre:
                peso = peso * factor_cerrado[red.capa[aristas]]
            presion = np.bincount(destino, weights=peso, minlength=nr * n)
            # `expuestos` puede repetir personas: la suma con índices repetidos escribe el
            # mismo valor varias veces, así que cada persona suma su presión una sola vez.
            expuestos = destino[est[destino] == S]
            tasa = beta * presion[expuestos]
            tasa[vac[expuestos]] *= 1.0 - recursos.eficacia
            presion_acumulada[expuestos] = presion_acumulada[expuestos] + tasa
            mordidos = np.unique(expuestos[presion_acumulada[expuestos] >= umb[expuestos]])

        # 3. Progresión con el estado del inicio del día.
        pendientes = agenda.pop(dia, [])
        transicion = np.concatenate(pendientes) if pendientes else np.empty(0, dtype=np.int64)
        previo = est[transicion]
        nuevos_zombies = transicion[previo == E]
        exorcizados = transicion[previo == I]
        est[mordidos] = E
        agendar(dia + lat[mordidos], mordidos)
        est[nuevos_zombies] = I
        agendar(dia + inf[nuevos_zombies], nuevos_zombies)
        det[nuevos_zombies] |= detec[nuevos_zombies]
        est[exorcizados] = R

        m = np.bincount(mordidos // n, minlength=nr)
        z = np.bincount(nuevos_zombies // n, minlength=nr)
        x = np.bincount(exorcizados // n, minlength=nr)
        conteo[:, S] -= m
        conteo[:, E] += m - z
        conteo[:, I] += z - x
        conteo[:, R] += x
        zombies = np.concatenate([zombies[est[zombies] == I], nuevos_zombies])
        serie[:, dia] = conteo
        serie_barrio[:, dia] = por_barrio(zombies)
        afectados_barrio[:, dia] = afectados_barrio[:, dia - 1] + por_barrio(mordidos)
        nuevos[:, dia] = m
        vivas = conteo[:, E] + conteo[:, I] > 0

        # Todos los brotes extinguidos: ya nada puede cambiar, se repite el último día.
        if not vivas.any():
            serie[:, dia + 1:] = serie[:, dia:dia + 1]
            serie_barrio[:, dia + 1:] = serie_barrio[:, dia:dia + 1]
            afectados_barrio[:, dia + 1:] = afectados_barrio[:, dia:dia + 1]
            break

    return Lote(serie=serie, serie_barrio=serie_barrio, afectados_barrio=afectados_barrio, nuevos=nuevos,
                vacunas_usadas=usadas, vacunas_perdidas=perdidas)


def _validar(elegidos: np.ndarray, obs: Observacion, dosis: int, estrategia) -> None:
    """Una estrategia nunca puede vacunar de más, repetir, ni vacunar a un caso conocido."""
    nombre = type(estrategia).__name__
    if len(elegidos) > dosis:
        raise ValueError(f"{nombre} pidió {len(elegidos)} vacunas y solo hay {dosis}")
    if len(np.unique(elegidos)) != len(elegidos):
        raise ValueError(f"{nombre} vacunó dos veces a la misma persona")
    if obs.visible[elegidos].any() or obs.vacunado[elegidos].any():
        raise ValueError(f"{nombre} vacunó a un zombie conocido o a un ya vacunado")

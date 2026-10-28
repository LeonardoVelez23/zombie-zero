"""API HTTP: valida la petición, corre la comparación y devuelve JSON.

La misma función sirve en AWS Lambda (`lambda_handler`, detrás de una Function URL
o API Gateway) y en el servidor local de desarrollo (servidor.py).
Ver docs/api.md.
"""
import base64
import json
from dataclasses import asdict, fields, replace

from .config import Escenario, Plaga, Recursos
from .edp import Difusion, resolver
from .informe_ia import ResumenInvalido, redactar
from .montecarlo import comparar
from .poblacion import BARRIOS

INICIOS = ("aleatorio", "aeropuerto", "mercado", "colegio", *BARRIOS)

# Límites de cada parámetro: protegen el costo y el tiempo de cómputo.
LIMITES = {
    "escenario": {
        "n_personas": (1000, 20_000),
        "dias": (30, 365),
        "semilla": (0, 2**31 - 1),
        "casos_iniciales": (1, 100),
    },
    "plaga": {
        "r0": (0.5, 10.0),
        "dias_latencia": (1.0, 21.0),
        "dias_infeccioso": (1.0, 21.0),
        "deteccion": (0.0, 1.0),
    },
    "recursos": {
        "presupuesto": (0.0, 1_000_000.0),
        "costo_vacuna": (0.01, 10_000.0),
        "vacunas_disponibles": (0, 20_000),
        "vacunas_por_dia": (1, 20_000),
        "dia_inicio": (0, 365),
        "corte_desde": (0, 365),
        "corte_dias": (0, 365),
        "eficacia": (0.0, 1.0),
        "dias_cierre": (0, 365),
        "cumplimiento_cierre": (0.0, 1.0),
        "costo_cierre_mercado": (0.0, 1_000_000.0),
        "costo_cierre_colegio": (0.0, 1_000_000.0),
    },
    "edp": {
        "d_sanos": (0.0, 5.0),
        "d_zombies": (0.0, 5.0),
        "alfa": (0.0, 1.0),
    },
}
# Tiempo de respuesta (docs/api.md): con el motor por lotes y 5.000 personas, un brote
# tarda ~10 ms en un núcleo de 2,8 GHz y ~2,4 veces más en la Lambda de 2 GB (medido con
# 50 repeticiones del motor anterior: ~12 s en local y ~29 s en AWS). 100 repeticiones x
# 10 planes = 1.000 brotes caben en ~25 s; 200 repeticiones rozan el corte de 60 s.
# La CLI, sin ese límite, usa 1.000 repeticiones por defecto, como pide el reto.
REPETICIONES = (5, 300)
REPETICIONES_POR_DEFECTO = 100
# El informe recibe un resumen compacto de la simulación (unos pocos KB), no el resultado con mapas y curvas.
MAX_CUERPO_INFORME = 50_000


class PeticionInvalida(ValueError):
    pass


def _numero(grupo: str, nombre: str, valor, tipo):
    minimo, maximo = LIMITES[grupo][nombre]
    try:
        numero = tipo(valor)
    except (TypeError, ValueError):
        raise PeticionInvalida(f"{nombre} debe ser un número") from None
    if not minimo <= numero <= maximo:
        raise PeticionInvalida(f"{nombre} debe estar entre {minimo} y {maximo}")
    return numero


def _grupo(objeto, grupo: str, datos: dict):
    if not isinstance(datos, dict):
        raise PeticionInvalida(f"{grupo} debe ser un objeto")
    cambios = {}
    for campo in fields(objeto):
        if campo.name in datos and campo.name in LIMITES[grupo]:
            cambios[campo.name] = _numero(grupo, campo.name, datos[campo.name], campo.type)
    desconocidos = set(datos) - {c.name for c in fields(objeto)}
    if desconocidos:
        raise PeticionInvalida(f"Campos desconocidos en {grupo}: {', '.join(sorted(desconocidos))}")
    return replace(objeto, **cambios)


def leer_peticion(cuerpo: dict) -> tuple[Escenario, int]:
    """Convierte el JSON de la petición en un Escenario validado (lo que falta toma el valor por defecto)."""
    if not isinstance(cuerpo, dict):
        raise PeticionInvalida("El cuerpo debe ser un objeto JSON")
    datos = dict(cuerpo.get("escenario", {}))
    plaga = _grupo(Plaga(), "plaga", datos.pop("plaga", {}))
    recursos = _grupo(Recursos(), "recursos", datos.pop("recursos", {}))

    inicio = datos.pop("inicio", Escenario.inicio)
    if inicio not in INICIOS:
        raise PeticionInvalida(f"inicio debe ser uno de: {', '.join(INICIOS)}")
    esc = _grupo(Escenario(), "escenario", datos)
    esc = replace(esc, inicio=inicio, plaga=plaga, recursos=recursos)

    if esc.recursos.dia_inicio > esc.dias:
        raise PeticionInvalida("dia_inicio no puede ser mayor que dias")
    repeticiones = cuerpo.get("repeticiones", REPETICIONES_POR_DEFECTO)
    if not isinstance(repeticiones, int) or not REPETICIONES[0] <= repeticiones <= REPETICIONES[1]:
        raise PeticionInvalida(f"repeticiones debe ser un entero entre {REPETICIONES[0]} y {REPETICIONES[1]}")
    return esc, repeticiones


def parametros() -> dict:
    """Valores por defecto y límites, para que la interfaz arme sus controles."""
    return {
        "por_defecto": Escenario().a_dict(),
        "edp_por_defecto": asdict(Difusion()),
        "limites": {g: {k: list(v) for k, v in campos.items()} for g, campos in LIMITES.items()},
        "inicios": list(INICIOS),
        "repeticiones": {"por_defecto": REPETICIONES_POR_DEFECTO, "limites": list(REPETICIONES)},
    }


def _json(cuerpo: str | None):
    try:
        return json.loads(cuerpo or "{}")
    except json.JSONDecodeError:
        raise PeticionInvalida("El cuerpo no es JSON válido") from None


def atender(metodo: str, ruta: str, cuerpo: str | None) -> tuple[int, dict]:
    """Enruta una petición y devuelve (código HTTP, JSON)."""
    ruta = "/" + ruta.strip("/")
    try:
        if metodo == "GET" and ruta in ("/api/parametros", "/parametros"):
            return 200, parametros()
        if metodo == "GET" and ruta in ("/api/salud", "/salud"):
            return 200, {"estado": "ok"}
        if metodo == "POST" and ruta in ("/api/simular", "/simular"):
            esc, repeticiones = leer_peticion(_json(cuerpo))
            return 200, comparar(esc, repeticiones)
        if metodo == "POST" and ruta in ("/api/edp", "/edp"):
            datos = _json(cuerpo)
            esc, _ = leer_peticion(datos)
            return 200, resolver(esc, _grupo(Difusion(), "edp", datos.get("edp", {})))
        if metodo == "POST" and ruta in ("/api/informe", "/informe"):
            # Aparte de /api/simular: no la hace más lenta y, si Bedrock falla, la simulación sigue andando.
            if len(cuerpo or "") > MAX_CUERPO_INFORME:
                raise PeticionInvalida("El resultado es demasiado grande para el informe")
            try:
                return 200, redactar(_json(cuerpo))
            except ResumenInvalido as error:
                raise PeticionInvalida(str(error)) from None
        return 404, {"error": f"No existe {metodo} {ruta}"}
    except PeticionInvalida as e:
        return 400, {"error": str(e)}


def lambda_handler(evento: dict, contexto) -> dict:
    """Entrada de AWS Lambda (formato de evento 2.0 de Function URL / HTTP API)."""
    http = evento.get("requestContext", {}).get("http", {})
    cuerpo = evento.get("body")
    if cuerpo and evento.get("isBase64Encoded"):
        cuerpo = base64.b64decode(cuerpo).decode("utf-8")
    codigo, respuesta = atender(http.get("method", "GET"), evento.get("rawPath", "/"), cuerpo)
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json; charset=utf-8"},
        "body": json.dumps(respuesta, ensure_ascii=False),
    }

from datetime import datetime
from zoneinfo import ZoneInfo

from arres import cerebro
from arres.almacen import AlmacenMemoria
from arres.herramientas import Contexto
from arres.modelos import PENDIENTE

from .conftest import IAFalsa

AHORA = datetime(2026, 11, 4, 12, 0, tzinfo=ZoneInfo("America/Mexico_City"))


async def test_conversacion_completa_por_whatsapp():
    almacen = AlmacenMemoria.con_demo()
    ctx = Contexto(almacen, almacen.restaurantes["demo"], "whatsapp", "+522221234567",
                   reloj=lambda: AHORA)
    ia = IAFalsa([
        ("ver_disponibilidad", {"fecha": "2026-11-06", "hora": "21:00", "personas": 4}),
        ("crear_reserva", {"nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00", "confirmado_por_cliente": True}),
        "¡Listo, Ana! Tu solicitud quedó registrada; te confirmamos en unos minutos.",
    ])
    respuesta = await cerebro.responder(ctx, "Mesa para 4 el viernes a las 9, a nombre de Ana",
                                        cliente=ia, modelo="falso")

    assert respuesta.startswith("¡Listo, Ana!")
    [reserva] = almacen.reservas.values()
    assert reserva.estado == PENDIENTE and reserva.canal == "whatsapp"
    # La IA recibe el calendario de la semana y las acciones disponibles.
    primer_turno = ia.recibido[0]
    assert "2026-11-06" in primer_turno["messages"][0]["content"]
    assert {t["function"]["name"] for t in primer_turno["tools"]} == {
        "buscar_horarios", "ver_disponibilidad", "crear_reserva", "escalar_a_humano"}
    # Ve lo que devolvió cada acción.
    assert '"disponible": true' in ia.recibido[1]["messages"][-1]["content"]
    # Queda el historial para el siguiente mensaje.
    historial = await almacen.mensajes("demo", "+522221234567", "whatsapp")
    assert [m["rol"] for m in historial] == ["cliente", "agente"]


async def test_usa_el_historial_previo():
    almacen = AlmacenMemoria.con_demo()
    ctx = Contexto(almacen, almacen.restaurantes["demo"], "whatsapp", "+522221234567",
                   reloj=lambda: AHORA)
    await cerebro.responder(ctx, "Hola", cliente=IAFalsa(["¡Hola! ¿En qué te ayudo?"]), modelo="x")
    ia = IAFalsa(["Claro."])
    await cerebro.responder(ctx, "¿Tienen estacionamiento?", cliente=ia, modelo="x")
    roles = [m["role"] for m in ia.recibido[0]["messages"]]
    assert roles == ["system", "user", "assistant", "user"]

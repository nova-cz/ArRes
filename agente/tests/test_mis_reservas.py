from datetime import datetime
from zoneinfo import ZoneInfo

from arres import herramientas
from arres.almacen import AlmacenMemoria
from arres.herramientas import Contexto, nombre_coincide
from arres.modelos import CANCELADA, CONFIRMADA, NO_LLEGO, PENDIENTE

MX = ZoneInfo("America/Mexico_City")
AHORA = datetime(2026, 11, 4, 12, 0, tzinfo=MX)  # miércoles
TEL = "+522212848351"


def contexto(almacen, telefono=TEL):
    return Contexto(almacen, almacen.restaurantes["demo"], "llamada", telefono,
                    reloj=lambda: AHORA)


async def reservar(almacen, fecha="2026-11-07", hora="20:00", personas=4,
                   nombre="Miguel Ángel Cruz"):
    r = await herramientas.ejecutar(contexto(almacen), "crear_reserva", {
        "nombre": nombre, "personas": personas, "fecha": fecha, "hora": hora,
        "confirmado_por_cliente": True})
    return r["reserva_id"]


def test_nombres():
    assert nombre_coincide("Miguel", "Miguel Ángel Cruz Reyes")
    assert nombre_coincide("miguel angel", "Miguel Ángel Cruz")
    assert not nombre_coincide("Sara", "Miguel Ángel Cruz")
    assert not nombre_coincide("", "Miguel")


async def test_consulta_sus_reservas():
    almacen = AlmacenMemoria.con_demo()
    await reservar(almacen)
    r = await herramientas.ejecutar(contexto(almacen), "buscar_mis_reservas", {"nombre": "Miguel"})
    assert r["encontrada"] and r["reservas"][0]["cuando"] == "sábado 7 de noviembre a las 8 pm"


async def test_no_revela_reservas_ajenas():
    almacen = AlmacenMemoria.con_demo()
    await reservar(almacen)
    # Nombre equivocado con el teléfono correcto.
    r = await herramientas.ejecutar(contexto(almacen), "buscar_mis_reservas", {"nombre": "Sara"})
    assert r["encontrada"] is False and "reservas" not in r
    # Nombre correcto desde otro teléfono.
    otro = contexto(almacen, telefono="+522225551234")
    r = await herramientas.ejecutar(otro, "buscar_mis_reservas", {"nombre": "Miguel"})
    assert r["encontrada"] is False


async def test_cancelar_pide_confirmacion_y_libera_la_mesa():
    almacen = AlmacenMemoria.con_demo()
    reserva_id = await reservar(almacen)
    ctx = contexto(almacen)
    r = await herramientas.ejecutar(ctx, "cancelar_reserva",
                                    {"reserva_id": reserva_id, "nombre": "Miguel"})
    assert r["cancelada"] is False and "confirmas" in r["siguiente_paso"]
    r = await herramientas.ejecutar(ctx, "cancelar_reserva", {
        "reserva_id": reserva_id, "nombre": "Miguel", "confirmado_por_cliente": True})
    assert r["cancelada"] and almacen.reservas[reserva_id].estado == CANCELADA
    # Cancelar no cuenta como falta.
    assert await almacen.contar_faltas("demo", TEL) == 0


async def test_no_cancela_reserva_de_otro_aunque_tenga_el_id():
    almacen = AlmacenMemoria.con_demo()
    reserva_id = await reservar(almacen)
    otro = contexto(almacen, telefono="+522225551234")
    r = await herramientas.ejecutar(otro, "cancelar_reserva", {
        "reserva_id": reserva_id, "nombre": "Miguel", "confirmado_por_cliente": True})
    assert r["encontrada"] is False
    assert almacen.reservas[reserva_id].estado == CONFIRMADA


async def test_cambiar_hora_revisa_lugar_y_confirma():
    almacen = AlmacenMemoria.con_demo()
    reserva_id = await reservar(almacen)
    ctx = contexto(almacen)
    r = await herramientas.ejecutar(ctx, "cambiar_reserva",
                                    {"reserva_id": reserva_id, "nombre": "Miguel", "hora": "21:00"})
    assert r["cambiada"] is False and "Sí hay lugar" in r["siguiente_paso"]
    r = await herramientas.ejecutar(ctx, "cambiar_reserva", {
        "reserva_id": reserva_id, "nombre": "Miguel", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert r["cambiada"] and r["estado"] == CONFIRMADA
    assert almacen.reservas[reserva_id].inicio.hour == 21


async def test_cambiar_no_choca_consigo_misma():
    # Con cupo justo para su propia mesa, moverla 30 min debe poder hacerse.
    almacen = AlmacenMemoria.con_demo()
    almacen._reglas["demo"].cupo_personas = 4
    reserva_id = await reservar(almacen)
    r = await herramientas.ejecutar(contexto(almacen), "cambiar_reserva", {
        "reserva_id": reserva_id, "nombre": "Miguel", "hora": "20:30",
        "confirmado_por_cliente": True})
    assert r["cambiada"]


async def test_cambiar_a_hora_llena_ofrece_alternativas():
    almacen = AlmacenMemoria.con_demo()
    almacen._reglas["demo"].cupo_personas = 4
    mia = await reservar(almacen, hora="14:00")
    await reservar(almacen, hora="20:00", nombre="Otra Persona")
    r = await herramientas.ejecutar(contexto(almacen), "cambiar_reserva", {
        "reserva_id": mia, "nombre": "Miguel", "hora": "20:00", "confirmado_por_cliente": True})
    assert r["cambiada"] is False and r["motivo"] == "sin_cupo" and r["alternativas"]


async def test_cambio_de_quien_falta_lo_revisa_el_equipo():
    almacen = AlmacenMemoria.con_demo()
    for fecha in ("2026-11-05", "2026-11-06"):
        await almacen.cambiar_estado(await reservar(almacen, fecha=fecha), NO_LLEGO)
    reserva_id = await reservar(almacen)  # ya queda pendiente por las faltas
    r = await herramientas.ejecutar(contexto(almacen), "cambiar_reserva", {
        "reserva_id": reserva_id, "nombre": "Miguel", "personas": 2,
        "confirmado_por_cliente": True})
    assert r["estado"] == PENDIENTE and "te llama" in r["que_decir"]

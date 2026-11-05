from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from arres import herramientas
from arres.almacen import AlmacenMemoria
from arres.herramientas import Contexto
from arres.modelos import CONFIRMADA, ESCALADA, PENDIENTE
from arres.textos import fecha_legible, normalizar_telefono

MX = ZoneInfo("America/Mexico_City")
AHORA = datetime(2026, 11, 4, 12, 0, tzinfo=MX)  # miércoles


def contexto(telefono="+522221234567"):
    almacen = AlmacenMemoria.con_demo()
    return Contexto(almacen, almacen.restaurantes["demo"], "llamada", telefono, reloj=lambda: AHORA)


def test_telefonos():
    assert normalizar_telefono("222 123 4567") == "+522221234567"
    assert normalizar_telefono("5212221234567") == "+522221234567"  # formato viejo de WhatsApp
    assert normalizar_telefono("+52 222 123 4567") == "+522221234567"


def test_fecha_legible():
    assert fecha_legible(datetime(2026, 11, 6, 20, 30)) == "viernes 6 de noviembre a las 8:30 pm"
    assert fecha_legible(datetime(2026, 11, 6, 13, 0)) == "viernes 6 de noviembre a las 1 pm"


async def test_reserva_queda_pendiente_en_modo_supervisado():
    ctx = contexto()
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00"})
    assert r["registrada"] and r["estado"] == PENDIENTE
    assert "4567" in r["que_decir"]
    guardada = await ctx.almacen.reserva(r["reserva_id"])
    assert guardada.telefono == "+522221234567" and guardada.canal == "llamada"


async def test_no_duplica_si_la_ia_repite_la_accion():
    ctx = contexto()
    datos = {"nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00"}
    primera = await herramientas.ejecutar(ctx, "crear_reserva", datos)
    segunda = await herramientas.ejecutar(ctx, "crear_reserva", datos)
    assert primera["reserva_id"] == segunda["reserva_id"]
    assert len(ctx.almacen.reservas) == 1


async def test_pide_telefono_si_no_lo_conoce():
    ctx = contexto(telefono="")
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00"})
    assert "teléfono" in r["error"]


async def test_nunca_promete_la_misma_mesa_dos_veces():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).cupo_personas = 6
    a = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00"})
    otro = contexto()
    otro.almacen = ctx.almacen  # otra llamada, misma base
    b = await herramientas.ejecutar(otro, "crear_reserva", {
        "nombre": "Beto", "personas": 4, "fecha": "2026-11-06", "hora": "21:00"})
    assert a["registrada"] and not b["registrada"]
    assert b["motivo"] == "sin_cupo" and b["alternativas"]


async def test_auto_aprobacion_confirma_y_avisa_por_whatsapp():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).auto_aprobar_hasta = 4
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00"})
    assert r["estado"] == CONFIRMADA
    mensajes = await ctx.almacen.mensajes("demo", "+522221234567", "whatsapp")
    assert "confirmada" in mensajes[-1]["texto"]


async def test_grupo_grande_se_escala():
    ctx = contexto()
    disp = await herramientas.ejecutar(ctx, "ver_disponibilidad", {
        "fecha": "2026-11-06", "hora": "21:00", "personas": 15})
    assert disp["motivo"] == "grupo_grande" and "escalar_a_humano" in disp["siguiente_paso"]
    r = await herramientas.ejecutar(ctx, "escalar_a_humano", {
        "motivo": "Cumpleaños de 15 personas", "nombre": "Ana", "personas": 15,
        "fecha": "2026-11-06", "hora": "21:00"})
    assert r["estado"] == ESCALADA
    assert list(ctx.almacen.reservas.values())[0].motivo_escalada == "Cumpleaños de 15 personas"


@pytest.mark.parametrize("args", [
    {"fecha": "6 de noviembre", "hora": "21:00", "personas": 2},
    {"fecha": "2026-11-06", "hora": "nueve", "personas": 2},
])
async def test_formato_invalido_regresa_error_legible(args):
    r = await herramientas.ejecutar(contexto(), "ver_disponibilidad", args)
    assert "AAAA-MM-DD" in r["error"]

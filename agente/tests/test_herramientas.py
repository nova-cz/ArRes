from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from arres import herramientas
from arres.almacen import AlmacenMemoria
from arres.herramientas import Contexto
from arres.modelos import CONFIRMADA, ESCALADA, NO_LLEGO, PENDIENTE
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


async def test_se_confirma_en_la_misma_llamada():
    ctx = contexto()
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert r["estado"] == CONFIRMADA and "confirmada" in r["que_decir"]


async def test_reserva_queda_pendiente_en_modo_supervisado():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).auto_aprobar_hasta = 0
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert r["registrada"] and r["estado"] == PENDIENTE
    assert "4567" in r["que_decir"]
    guardada = await ctx.almacen.reserva(r["reserva_id"])
    assert guardada.telefono == "+522221234567" and guardada.canal == "llamada"


async def test_no_duplica_si_la_ia_repite_la_accion():
    ctx = contexto()
    datos = {"nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True}
    primera = await herramientas.ejecutar(ctx, "crear_reserva", datos)
    segunda = await herramientas.ejecutar(ctx, "crear_reserva", datos)
    assert primera["reserva_id"] == segunda["reserva_id"]
    assert len(ctx.almacen.reservas) == 1


async def test_pide_telefono_si_no_lo_conoce():
    ctx = contexto(telefono="")
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert "teléfono" in r["error"]


async def test_nunca_promete_la_misma_mesa_dos_veces():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).cupo_personas = 6
    a = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    otro = contexto()
    otro.almacen = ctx.almacen  # otra llamada, misma base
    b = await herramientas.ejecutar(otro, "crear_reserva", {
        "nombre": "Beto", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert a["registrada"] and not b["registrada"]
    assert b["motivo"] == "sin_cupo" and b["alternativas"]


async def test_auto_aprobacion_confirma_y_avisa_por_whatsapp():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).auto_aprobar_hasta = 4
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
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


async def test_buscar_horarios_de_un_dia():
    r = await herramientas.ejecutar(contexto(), "buscar_horarios",
                                    {"personas": 4, "fecha": "2026-11-07"})  # sábado
    assert r["dia"] == "sábado 7 de noviembre"
    assert r["primero"] == "1 pm" and r["ultimo"] == "9:30 pm"
    assert len(r["horarios"]) == herramientas.MAX_HORARIOS


async def test_lo_mas_pronto_desde_ahora():
    # Miércoles 12:00 con 60 min de anticipación: lo primero es hoy a la 1 pm.
    r = await herramientas.ejecutar(contexto(), "buscar_horarios", {"personas": 2})
    assert r["dia"] == "miércoles 4 de noviembre" and r["primero"] == "1 pm"


async def test_si_es_tarde_ofrece_el_dia_siguiente():
    tarde = datetime(2026, 11, 7, 22, 30, tzinfo=MX)  # sábado ya cerrando
    almacen = AlmacenMemoria.con_demo()
    ctx = Contexto(almacen, almacen.restaurantes["demo"], "llamada", "", reloj=lambda: tarde)
    r = await herramientas.ejecutar(ctx, "buscar_horarios", {"personas": 2})
    assert r["dia"] == "domingo 8 de noviembre"


async def test_dia_lleno_salta_al_siguiente_y_avisa():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).cupo_personas = 4
    for hora in ("13:00", "14:30", "16:00", "17:30"):  # domingo lleno de 1 a 7 pm
        await herramientas.ejecutar(contexto_con(ctx), "crear_reserva", {
            "nombre": "X", "personas": 4, "fecha": "2026-11-08", "hora": hora,
            "confirmado_por_cliente": True})
    r = await herramientas.ejecutar(ctx, "buscar_horarios", {"personas": 2, "fecha": "2026-11-08"})
    assert r["dia"] == "martes 10 de noviembre" and "aviso" in r  # lunes cierra


def contexto_con(ctx):
    return Contexto(ctx.almacen, ctx.restaurante, "llamada", "+522221234567", reloj=lambda: AHORA)


async def test_no_registra_sin_confirmacion_del_cliente():
    ctx = contexto()
    r = await herramientas.ejecutar(ctx, "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00"})
    assert r["registrada"] is False and "repite" in r["siguiente_paso"]
    assert ctx.almacen.reservas == {}


async def test_no_escala_sin_nombre_ni_telefono():
    ctx = contexto(telefono="")
    r = await herramientas.ejecutar(ctx, "escalar_a_humano", {"motivo": "Grupo de 15"})
    assert r["registrada"] is False and "teléfono" in r["siguiente_paso"]
    assert ctx.almacen.reservas == {}


async def test_confirmacion_menciona_la_tolerancia():
    r = await herramientas.ejecutar(contexto(), "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-06", "hora": "21:00",
        "confirmado_por_cliente": True})
    assert "15 minutos de tolerancia" in r["que_decir"]


async def test_no_llego_libera_la_mesa():
    ctx = contexto()
    (await ctx.almacen.reglas("demo")).cupo_personas = 4
    datos = {"nombre": "Ana", "personas": 4, "fecha": "2026-11-06", "hora": "21:00",
             "confirmado_por_cliente": True}
    primera = await herramientas.ejecutar(ctx, "crear_reserva", datos)
    lleno = await herramientas.ejecutar(ctx, "ver_disponibilidad",
                                        {"fecha": "2026-11-06", "hora": "21:00", "personas": 2})
    assert lleno["disponible"] is False
    await ctx.almacen.cambiar_estado(primera["reserva_id"], NO_LLEGO)
    libre = await herramientas.ejecutar(ctx, "ver_disponibilidad",
                                        {"fecha": "2026-11-06", "hora": "21:00", "personas": 2})
    assert libre["disponible"] is True


async def test_quien_falta_seguido_ya_no_se_confirma_solo():
    ctx = contexto()
    for dia in ("2026-11-06", "2026-11-07"):
        r = await herramientas.ejecutar(contexto_con(ctx), "crear_reserva", {
            "nombre": "Ana", "personas": 2, "fecha": dia, "hora": "14:00",
            "confirmado_por_cliente": True})
        await ctx.almacen.cambiar_estado(r["reserva_id"], NO_LLEGO)
    r = await herramientas.ejecutar(contexto_con(ctx), "crear_reserva", {
        "nombre": "Ana", "personas": 2, "fecha": "2026-11-10", "hora": "14:00",
        "confirmado_por_cliente": True})
    assert r["estado"] == PENDIENTE and "faltaste" not in r["que_decir"]
    guardada = await ctx.almacen.reserva(r["reserva_id"])
    assert "2 inasistencias" in guardada.motivo_escalada

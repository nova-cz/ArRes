import hashlib
import hmac
import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from arres import cerebro, config
from arres.servidor import app

from .conftest import IAFalsa


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setenv("MODO_PRUEBA", "1")
    monkeypatch.setenv("EVENTOS_SECRETO", "secreto-de-prueba")
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "token-meta")
    return TestClient(app)


def test_flujo_de_la_demo_chat_aprobar_y_confirmar(cliente, monkeypatch):
    # Un martes dentro de las próximas dos semanas (la demo abre de martes a domingo).
    dia = date.today() + timedelta(days=2)
    while dia.weekday() != 1:
        dia += timedelta(days=1)
    ia = IAFalsa([
        ("crear_reserva", {"nombre": "Ana", "personas": 2, "fecha": dia.isoformat(), "hora": "14:00", "confirmado_por_cliente": True}),
        "Listo, quedó registrada.",
    ])
    monkeypatch.setattr(cerebro, "cliente_llm", lambda: (ia, "falso"))
    config.almacen()._reglas["demo"].auto_aprobar_hasta = 0  # modo supervisado

    r = cliente.post("/prueba/chat", json={"telefono": "2221234567", "texto": "Mesa para 2"})
    assert r.json()["respuesta"] == "Listo, quedó registrada."

    [reserva] = cliente.get("/prueba/reservas").json()
    assert reserva["estado"] == "pendiente"

    r = cliente.post(f"/prueba/reservas/{reserva['id']}", json={"estado": "confirmada"})
    assert "confirmada" in r.json()["enviado"]
    mensajes = cliente.get("/prueba/mensajes", params={"telefono": "2221234567"}).json()
    assert "✅" in mensajes[-1]["texto"]


def test_modo_prueba_apagado_no_expone_nada(monkeypatch):
    monkeypatch.setenv("MODO_PRUEBA", "")
    c = TestClient(app)
    assert c.get("/prueba").status_code == 404
    assert c.get("/prueba/reservas").status_code == 404


def test_verificacion_de_meta(cliente):
    ok = cliente.get("/whatsapp", params={
        "hub.mode": "subscribe", "hub.verify_token": "token-meta", "hub.challenge": "123"})
    assert ok.text == "123"
    malo = cliente.get("/whatsapp", params={
        "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "123"})
    assert malo.status_code == 403


def test_firma_de_meta(cliente, monkeypatch):
    monkeypatch.setenv("WHATSAPP_APP_SECRET", "app-secret")
    cuerpo = json.dumps({"entry": []}).encode()
    firma = "sha256=" + hmac.new(b"app-secret", cuerpo, hashlib.sha256).hexdigest()
    headers = {"content-type": "application/json"}
    assert cliente.post("/whatsapp", content=cuerpo,
                        headers={**headers, "x-hub-signature-256": firma}).status_code == 200
    assert cliente.post("/whatsapp", content=cuerpo,
                        headers={**headers, "x-hub-signature-256": "sha256=mala"}).status_code == 401


def test_evento_del_panel_exige_secreto(cliente):
    evento = {"type": "UPDATE", "record": {"id": "x", "estado": "confirmada"},
              "old_record": {"id": "x", "estado": "pendiente"}}
    assert cliente.post("/eventos/reserva", json=evento).status_code == 401
    r = cliente.post("/eventos/reserva", json=evento, headers={"x-arres-secreto": "secreto-de-prueba"})
    assert r.status_code == 404  # la reserva x no existe en la demo


def test_evento_sin_cambio_de_estado_no_avisa(cliente):
    evento = {"type": "UPDATE", "record": {"id": "x", "estado": "pendiente"},
              "old_record": {"id": "x", "estado": "pendiente"}}
    r = cliente.post("/eventos/reserva", json=evento, headers={"x-arres-secreto": "secreto-de-prueba"})
    assert r.json() == {"enviado": None}


def test_mensaje_de_whatsapp_se_contesta(cliente, monkeypatch):
    almacen = config.almacen()
    almacen.restaurantes["demo"].whatsapp_phone_number_id = "PNID"
    monkeypatch.setattr(cerebro, "cliente_llm", lambda: (IAFalsa(["¡Hola!"]), "falso"))
    enviados = []

    async def enviar_texto(pnid, telefono, texto):
        enviados.append((pnid, telefono, texto))

    from arres import whatsapp
    monkeypatch.setattr(whatsapp, "enviar_texto", enviar_texto)
    aviso = {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "PNID"},
        "messages": [{"id": "wamid.1", "from": "5212221234567", "type": "text",
                      "text": {"body": "Hola"}}]}}]}]}
    cliente.post("/whatsapp", json=aviso)
    cliente.post("/whatsapp", json=aviso)  # Meta reintenta: no se contesta dos veces
    assert enviados == [("PNID", "+522221234567", "¡Hola!")]

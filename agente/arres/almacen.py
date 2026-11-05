"""Dónde se guardan restaurantes, reglas, reservas y mensajes.

- AlmacenMemoria: para probar en la laptop sin ninguna cuenta. Trae un restaurante demo.
- AlmacenSupabase: la base real, compartida con el panel web (ver supabase/esquema.sql).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Protocol

import httpx

from .modelos import Reglas, Reserva, Restaurante


class Almacen(Protocol):
    async def restaurante(self, restaurante_id: str) -> Restaurante | None: ...
    async def restaurante_por_telefono_agente(self, telefono: str) -> Restaurante | None: ...
    async def restaurante_por_whatsapp(self, phone_number_id: str) -> Restaurante | None: ...
    async def restaurante_por_defecto(self) -> Restaurante | None: ...
    async def reglas(self, restaurante_id: str) -> Reglas: ...
    async def reservas_entre(
        self, restaurante_id: str, desde: datetime, hasta: datetime
    ) -> list[Reserva]: ...
    async def reserva(self, reserva_id: str) -> Reserva | None: ...
    async def crear_reserva(self, reserva: Reserva) -> Reserva: ...
    async def cambiar_estado(self, reserva_id: str, estado: str) -> Reserva | None: ...
    async def marcar_notificada(self, reserva_id: str) -> None: ...
    async def guardar_mensaje(
        self, restaurante_id: str, telefono: str, canal: str, rol: str, texto: str
    ) -> None: ...
    async def mensajes(
        self, restaurante_id: str, telefono: str, canal: str, limite: int = 20
    ) -> list[dict]: ...


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Memoria (demo y pruebas)
# ---------------------------------------------------------------------------

INFO_DEMO = """\
Restaurante ficticio para la demo de ArRES.
Dirección: Av. Juárez 2915, colonia La Paz, Puebla.
Cocina poblana: mole poblano ($245), cemita de milanesa ($165), chalupas ($120),
pipián verde ($230), tacos árabes ($150). Opciones vegetarianas: chiles rellenos de queso
($190) y ensalada de nopales ($110).
Estacionamiento con valet ($50). Hay área para niños y terraza pet friendly.
Para grupos de más de 8 personas o eventos, lo revisa el gerente.
Tolerancia de 15 minutos; después la mesa puede liberarse.
"""


class AlmacenMemoria:
    def __init__(self) -> None:
        self.restaurantes: dict[str, Restaurante] = {}
        self._reglas: dict[str, Reglas] = {}
        self.reservas: dict[str, Reserva] = {}
        self._mensajes: list[dict] = []

    @classmethod
    def con_demo(cls) -> AlmacenMemoria:
        almacen = cls()
        demo = Restaurante(id="demo", nombre="La Talavera", info=INFO_DEMO)
        almacen.restaurantes[demo.id] = demo
        semana = [("13:00", "23:00")]
        almacen._reglas[demo.id] = Reglas(
            horario={0: [], 1: semana, 2: semana, 3: semana, 4: semana, 5: semana,
                     6: [("13:00", "19:00")]},
        )
        return almacen

    async def restaurante(self, restaurante_id):
        return self.restaurantes.get(restaurante_id)

    async def restaurante_por_telefono_agente(self, telefono):
        return next((r for r in self.restaurantes.values() if r.telefono_agente == telefono), None)

    async def restaurante_por_whatsapp(self, phone_number_id):
        return next(
            (r for r in self.restaurantes.values()
             if r.whatsapp_phone_number_id == phone_number_id),
            None,
        )

    async def restaurante_por_defecto(self):
        return next(iter(self.restaurantes.values()), None)

    async def reglas(self, restaurante_id):
        return self._reglas[restaurante_id]

    async def reservas_entre(self, restaurante_id, desde, hasta):
        return sorted(
            (r for r in self.reservas.values()
             if r.restaurante_id == restaurante_id and r.inicio
             and r.inicio < hasta and r.fin > desde),
            key=lambda r: r.inicio,
        )

    async def reserva(self, reserva_id):
        return self.reservas.get(reserva_id)

    async def crear_reserva(self, reserva):
        reserva.id = reserva.id or str(uuid.uuid4())
        reserva.creado_en = _ahora()
        self.reservas[reserva.id] = reserva
        return reserva

    async def cambiar_estado(self, reserva_id, estado):
        reserva = self.reservas.get(reserva_id)
        if reserva:
            reserva.estado = estado
        return reserva

    async def marcar_notificada(self, reserva_id):
        if reserva_id in self.reservas:
            self.reservas[reserva_id].extra["notificado_en"] = _ahora()

    async def guardar_mensaje(self, restaurante_id, telefono, canal, rol, texto):
        self._mensajes.append({
            "restaurante_id": restaurante_id, "telefono": telefono, "canal": canal,
            "rol": rol, "texto": texto, "creado_en": _ahora().isoformat(),
        })

    async def mensajes(self, restaurante_id, telefono, canal, limite=20):
        propios = [
            m for m in self._mensajes
            if m["restaurante_id"] == restaurante_id and m["telefono"] == telefono
            and m["canal"] == canal
        ]
        return propios[-limite:]


# ---------------------------------------------------------------------------
# Supabase (producción)
# ---------------------------------------------------------------------------

def _fecha(texto: str | None) -> datetime | None:
    return datetime.fromisoformat(texto) if texto else None


def _a_restaurante(fila: dict) -> Restaurante:
    return Restaurante(
        id=fila["id"],
        nombre=fila["nombre"],
        zona_horaria=fila.get("zona_horaria") or "America/Mexico_City",
        direccion=fila.get("direccion") or "",
        telefono_agente=fila.get("telefono_agente") or "",
        whatsapp_phone_number_id=fila.get("whatsapp_phone_number_id") or "",
        info=fila.get("info") or "",
    )


def _a_reglas(fila: dict) -> Reglas:
    horario = {int(dia): [tuple(t) for t in turnos] for dia, turnos in fila["horario"].items()}
    campos = ("duracion_min", "intervalo_min", "cupo_personas", "max_personas",
              "anticipacion_min", "dias_max_adelanto", "auto_aprobar_hasta", "minutos_alerta")
    return Reglas(horario=horario, **{c: fila[c] for c in campos if fila.get(c) is not None})


def _a_reserva(fila: dict) -> Reserva:
    return Reserva(
        id=fila["id"],
        restaurante_id=fila["restaurante_id"],
        nombre=fila["nombre"],
        telefono=fila["telefono"],
        personas=fila["personas"],
        inicio=_fecha(fila["inicio"]),
        fin=_fecha(fila["fin"]),
        estado=fila["estado"],
        canal=fila.get("canal") or "llamada",
        notas=fila.get("notas") or "",
        motivo_escalada=fila.get("motivo_escalada") or "",
        creado_en=_fecha(fila.get("creado_en")),
        extra={"notificado_en": fila.get("notificado_en")},
    )


class AlmacenSupabase:
    """Habla con la API REST de Supabase usando la llave de servicio (solo en el servidor)."""

    def __init__(self, url: str, llave_servicio: str) -> None:
        headers = {"apikey": llave_servicio, "Content-Type": "application/json"}
        # Las llaves viejas (service_role) son JWT y van también como Bearer.
        # Las nuevas (sb_secret_...) no son JWT: solo van en "apikey".
        if not llave_servicio.startswith("sb_"):
            headers["Authorization"] = f"Bearer {llave_servicio}"
        self._http = httpx.AsyncClient(
            base_url=url.rstrip("/") + "/rest/v1", headers=headers, timeout=10
        )

    async def _uno(self, tabla: str, params: dict) -> dict | None:
        filas = await self._varios(tabla, {**params, "limit": 1})
        return filas[0] if filas else None

    async def _varios(self, tabla: str, params: dict) -> list[dict]:
        respuesta = await self._http.get(f"/{tabla}", params=params)
        respuesta.raise_for_status()
        return respuesta.json()

    async def _restaurante_donde(self, campo: str, valor: str) -> Restaurante | None:
        fila = await self._uno("restaurantes", {campo: f"eq.{valor}"})
        return _a_restaurante(fila) if fila else None

    async def restaurante(self, restaurante_id):
        return await self._restaurante_donde("id", restaurante_id)

    async def restaurante_por_telefono_agente(self, telefono):
        return await self._restaurante_donde("telefono_agente", telefono)

    async def restaurante_por_whatsapp(self, phone_number_id):
        return await self._restaurante_donde("whatsapp_phone_number_id", phone_number_id)

    async def restaurante_por_defecto(self):
        fila = await self._uno("restaurantes", {"order": "creado_en.asc"})
        return _a_restaurante(fila) if fila else None

    async def reglas(self, restaurante_id):
        fila = await self._uno("reglas", {"restaurante_id": f"eq.{restaurante_id}"})
        if not fila:
            raise LookupError(f"El restaurante {restaurante_id} no tiene reglas configuradas")
        return _a_reglas(fila)

    async def reservas_entre(self, restaurante_id, desde, hasta):
        filas = await self._varios("reservas", {
            "restaurante_id": f"eq.{restaurante_id}",
            "inicio": f"lt.{hasta.isoformat()}",
            "fin": f"gt.{desde.isoformat()}",
            "order": "inicio.asc",
        })
        return [_a_reserva(f) for f in filas]

    async def reserva(self, reserva_id):
        fila = await self._uno("reservas", {"id": f"eq.{reserva_id}"})
        return _a_reserva(fila) if fila else None

    async def crear_reserva(self, reserva):
        datos = {
            "restaurante_id": reserva.restaurante_id,
            "nombre": reserva.nombre,
            "telefono": reserva.telefono,
            "personas": reserva.personas,
            "inicio": reserva.inicio.isoformat(),
            "fin": reserva.fin.isoformat(),
            "estado": reserva.estado,
            "canal": reserva.canal,
            "notas": reserva.notas,
            "motivo_escalada": reserva.motivo_escalada,
        }
        respuesta = await self._http.post(
            "/reservas", json=datos, headers={"Prefer": "return=representation"}
        )
        respuesta.raise_for_status()
        return _a_reserva(respuesta.json()[0])

    async def cambiar_estado(self, reserva_id, estado):
        respuesta = await self._http.patch(
            "/reservas", params={"id": f"eq.{reserva_id}"}, json={"estado": estado},
            headers={"Prefer": "return=representation"},
        )
        respuesta.raise_for_status()
        filas = respuesta.json()
        return _a_reserva(filas[0]) if filas else None

    async def marcar_notificada(self, reserva_id):
        respuesta = await self._http.patch(
            "/reservas", params={"id": f"eq.{reserva_id}"},
            json={"notificado_en": _ahora().isoformat()},
        )
        respuesta.raise_for_status()

    async def guardar_mensaje(self, restaurante_id, telefono, canal, rol, texto):
        respuesta = await self._http.post("/mensajes", json={
            "restaurante_id": restaurante_id, "telefono": telefono, "canal": canal,
            "rol": rol, "texto": texto,
        })
        respuesta.raise_for_status()

    async def mensajes(self, restaurante_id, telefono, canal, limite=20):
        filas = await self._varios("mensajes", {
            "restaurante_id": f"eq.{restaurante_id}",
            "telefono": f"eq.{telefono}",
            "canal": f"eq.{canal}",
            "order": "creado_en.desc",
            "limit": limite,
        })
        return list(reversed(filas))


def ventana_abierta(mensajes: list[dict], ahora: datetime | None = None) -> bool:
    """WhatsApp deja mandar texto libre solo 24 h después del último mensaje del cliente."""
    ahora = ahora or _ahora()
    del_cliente = [m for m in mensajes if m["rol"] == "cliente"]
    if not del_cliente:
        return False
    ultimo = datetime.fromisoformat(del_cliente[-1]["creado_en"])
    return ahora - ultimo < timedelta(hours=24)

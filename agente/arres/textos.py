"""Formato de fechas y teléfonos para hablar con el cliente."""

from __future__ import annotations

import re
from datetime import datetime

from .modelos import DIAS

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]


def normalizar_telefono(texto: str) -> str:
    """Deja el número como +52 y 10 dígitos. WhatsApp a veces manda 521 + 10 dígitos."""
    digitos = re.sub(r"\D", "", texto or "")
    if len(digitos) == 10:
        return "+52" + digitos
    if digitos.startswith("521") and len(digitos) == 13:
        return "+52" + digitos[3:]
    return "+" + digitos if digitos else ""


def fecha_legible(momento: datetime) -> str:
    """'viernes 7 de noviembre a las 8:30 pm' (así lo dice bien la voz)."""
    hora = momento.hour % 12 or 12
    minutos = f":{momento.minute:02d}" if momento.minute else ""
    sufijo = "am" if momento.hour < 12 else "pm"
    return (f"{DIAS[momento.weekday()]} {momento.day} de {MESES[momento.month - 1]} "
            f"a las {hora}{minutos} {sufijo}")

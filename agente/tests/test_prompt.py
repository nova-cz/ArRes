from datetime import datetime
from zoneinfo import ZoneInfo

from arres import prompt
from arres.modelos import Conocimiento, Reglas, Restaurante

AHORA = datetime(2026, 11, 6, 12, 0, tzinfo=ZoneInfo("America/Mexico_City"))


def test_incluye_agente_menu_faqs_y_solo_promos_vigentes():
    c = Conocimiento(
        nombre_agente="Sofi", tono="formal", sobre_negocio="Cocina poblana.",
        platillos=[{"categoria": "Fuertes", "nombre": "Mole", "precio": 245, "vegetariano": False},
                   {"categoria": "Fuertes", "nombre": "Chile relleno", "precio": "190.00",
                    "vegetariano": True}],
        faqs=[{"pregunta": "¿Estacionamiento?", "respuesta": "Valet $50."}],
        promociones=[{"texto": "2x1 en mezcal", "termina": "2026-11-30"},
                     {"texto": "Promo vieja", "termina": "2026-10-01"}],
    )
    texto = prompt.construir(Restaurante(id="x", nombre="La Talavera"), Reglas(horario={}),
                             "llamada", AHORA, c)
    assert "Eres Sofi" in texto and "de usted" in texto
    assert "- Mole: $245" in texto and "Chile relleno: $190 (vegetariano)" in texto
    assert "Valet $50." in texto and "Cocina poblana." in texto
    assert "2x1 en mezcal" in texto and "Promo vieja" not in texto


def test_sin_promos_lo_dice():
    texto = prompt.construir(Restaurante(id="x", nombre="X"), Reglas(horario={}), "llamada", AHORA)
    assert "No hay promociones vigentes." in texto

import json
from types import SimpleNamespace

import pytest

from arres import config


class IAFalsa:
    """Imita al cliente de OpenAI/Gemini con respuestas escritas a mano."""

    def __init__(self, guion):
        self.guion = list(guion)
        self.recibido = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._crear))

    async def _crear(self, **kwargs):
        # Copia: la lista de mensajes se sigue llenando después de esta llamada.
        self.recibido.append({**kwargs, "messages": list(kwargs["messages"])})
        paso = self.guion.pop(0)
        if isinstance(paso, str):
            mensaje = SimpleNamespace(content=paso, tool_calls=None)
        else:
            nombre, argumentos = paso
            llamada = SimpleNamespace(
                id=f"llamada-{len(self.recibido)}",
                function=SimpleNamespace(name=nombre, arguments=json.dumps(argumentos)),
            )
            mensaje = SimpleNamespace(content=None, tool_calls=[llamada])
        return SimpleNamespace(choices=[SimpleNamespace(message=mensaje)])


@pytest.fixture(autouse=True)
def entorno_limpio(monkeypatch):
    for nombre in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WHATSAPP_TOKEN",
                   "WHATSAPP_APP_SECRET", "RESTAURANTE_ID"):
        monkeypatch.setenv(nombre, "")
    config.almacen.cache_clear()
    yield
    config.almacen.cache_clear()

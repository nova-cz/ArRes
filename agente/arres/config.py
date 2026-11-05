"""Configuración leída de variables de entorno (archivo .env en local, Vercel/servidor en producción)."""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

from .almacen import Almacen, AlmacenMemoria, AlmacenSupabase

load_dotenv()

# En Mac, el Python de python.org no trae certificados SSL y falla al conectar con
# Deepgram, Gemini, etc. ("CERTIFICATE_VERIFY_FAILED"). Se usan los de certifi.
try:
    import certifi

    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except ImportError:
    pass

GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"


def env(nombre: str, defecto: str = "") -> str:
    return os.getenv(nombre, defecto).strip()


@lru_cache
def almacen() -> Almacen:
    """Supabase si hay credenciales; si no, la memoria con el restaurante demo."""
    url, llave = env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    if url and llave:
        return AlmacenSupabase(url, llave)
    return AlmacenMemoria.con_demo()


def llm() -> dict:
    """Proveedor de IA. Por defecto Gemini (capa gratuita) por su API compatible con OpenAI."""
    proveedor = env("LLM_PROVEEDOR", "gemini")
    if proveedor == "gemini":
        return {
            "proveedor": "gemini",
            "api_key": env("GEMINI_API_KEY"),
            "base_url": GEMINI_OPENAI_URL,
            "modelo": env("LLM_MODELO", "gemini-2.5-flash"),
        }
    return {
        "proveedor": "openai",
        "api_key": env("OPENAI_API_KEY"),
        "base_url": env("OPENAI_BASE_URL") or None,
        "modelo": env("LLM_MODELO", "gpt-5-mini"),
    }

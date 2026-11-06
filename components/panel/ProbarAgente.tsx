"use client";
import { Headset } from "@phosphor-icons/react";

// Abre la llamada de prueba (el mismo agente que contesta el teléfono) en otra pestaña:
// dentro de una ventana incrustada varios navegadores bloquean el micrófono.
const URL_AGENTE = process.env.NEXT_PUBLIC_AGENTE_URL || "http://localhost:7860/client/";

export default function ProbarAgente({ className = "" }: { className?: string }) {
  return (
    <a href={URL_AGENTE} target="_blank" rel="noopener noreferrer"
      title="Necesita el agente encendido (python voz/bot.py). Dale Connect y habla."
      className={`flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-bold text-white hover:bg-vino ${className}`}>
      <Headset size={18} />Hablar con el agente
    </a>
  );
}

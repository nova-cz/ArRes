"use client";
import { useState } from "react";
import { Headset, X } from "@phosphor-icons/react";

// Abre la llamada de prueba (el mismo agente que contesta el teléfono) sin salir del panel.
const URL_AGENTE = process.env.NEXT_PUBLIC_AGENTE_URL || "http://localhost:7860/client/";

export default function ProbarAgente({ className = "" }: { className?: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button onClick={() => setAbierto(true)}
        className={`flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-bold text-white hover:bg-vino ${className}`}>
        <Headset size={18} />Hablar con el agente
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/30 p-4 backdrop-blur-sm" onClick={() => setAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="aparecer flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] bg-papel shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className="font-serif text-2xl">Prueba a tu agente</h2>
                <p className="text-sm text-ink/55">Dale <b>Connect</b> y habla. Usa tus reglas y tu menú guardados. Necesita <code>python voz/bot.py</code> encendido.</p>
              </div>
              <button onClick={() => setAbierto(false)} className="p-1 text-ink/50 hover:text-rojo"><X size={24} /></button>
            </div>
            <iframe src={URL_AGENTE} allow="microphone; autoplay" className="flex-1 border-0" title="Agente de voz" />
          </div>
        </div>
      )}
    </>
  );
}

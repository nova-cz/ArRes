"use client";
import { Headset } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

// Abre la llamada de prueba en otra pestaña (incrustada, varios navegadores bloquean el
// micrófono). El agente verifica la sesión y contesta como el restaurante de quien prueba.
const BASE = (process.env.NEXT_PUBLIC_AGENTE_URL || "http://localhost:7860").replace(/\/client\/?$/, "").replace(/\/$/, "");

export default function ProbarAgente({ className = "" }: { className?: string }) {
  async function abrir() {
    const ventana = window.open("", "_blank"); // se abre ya, para que no la bloquee el navegador
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${BASE}/probar?token=${encodeURIComponent(session?.access_token ?? "")}`;
    if (ventana) ventana.location.href = url;
    else window.location.href = url;
  }
  return (
    <button onClick={abrir} title="Necesita el agente encendido (python voz/bot.py). Dale Connect y habla."
      className={`flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-bold text-white hover:bg-vino ${className}`}>
      <Headset size={18} />Hablar con el agente
    </button>
  );
}

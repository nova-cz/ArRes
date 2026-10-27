"use client";
import { useEffect, useState } from "react";
import ChatMock from "./ChatMock";

const PASOS = ["Pregunta", "Revisa", "Aprueba"];
const MS = 6500;

export default function Flujo() {
  const [paso, setPaso] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (pausa) return;
    const id = setTimeout(() => setPaso((p) => (p + 1) % PASOS.length), MS);
    return () => clearTimeout(id);
  }, [paso, pausa]);

  return (
    <div onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}>
      <div role="tablist" aria-label="Cómo atiende ArRES una reserva" className="mb-4 flex justify-center gap-2 text-xs font-bold">
        {PASOS.map((x, i) => (
          <button
            key={x}
            role="tab"
            aria-selected={paso === i}
            onClick={() => setPaso(i)}
            className={`relative overflow-hidden rounded-full px-4 py-2 transition-colors duration-200 ease-out ${
              paso === i ? "bg-naranja text-ink" : "glass-dark hover:bg-white/15"
            }`}
          >
            {x}
            {paso === i && !pausa && (
              <span key={paso} className="progreso absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ink/40" style={{ animationDuration: `${MS}ms` }} />
            )}
          </button>
        ))}
      </div>
      <ChatMock key={paso} paso={paso} />
    </div>
  );
}

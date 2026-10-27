"use client";
import { useState } from "react";
import { Check, Minus, X } from "@phosphor-icons/react/dist/ssr";

type Celda = { ok: "si" | "no" | "mid"; t: string };
const COLS = ["ArRES", "Contratar personal", "Chatbot genérico"];
const filas: [string, Celda, Celda, Celda][] = [
  ["Atiende fuera de horario", { ok: "si", t: "Sí, 24/7" }, { ok: "mid", t: "Depende del turno" }, { ok: "si", t: "Sí" }],
  ["Conoce las reglas de tu restaurante", { ok: "si", t: "Las configuras tú" }, { ok: "si", t: "Con capacitación" }, { ok: "no", t: "Respuestas genéricas" }],
  ["Revisa disponibilidad real", { ok: "si", t: "Sí" }, { ok: "si", t: "Sí" }, { ok: "no", t: "Normalmente no" }],
  ["Contesta llamadas y WhatsApp", { ok: "si", t: "Ambos" }, { ok: "mid", t: "Uno a la vez" }, { ok: "mid", t: "Solo chat" }],
  ["Una persona aprueba cada reserva", { ok: "si", t: "Siempre" }, { ok: "mid", t: "No aplica" }, { ok: "no", t: "No" }],
  ["Respuestas consistentes", { ok: "si", t: "Siempre las mismas reglas" }, { ok: "no", t: "Varían por persona" }, { ok: "no", t: "Varían sin control" }],
];

const Estado = ({ c, pop }: { c: Celda; pop: boolean }) => (
  <span className="flex items-center gap-2">
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${pop ? "pop" : ""} ${c.ok === "si" ? "bg-[#4E9A3E] text-white" : c.ok === "mid" ? "bg-dorado/90 text-vino" : "bg-rojo text-white"}`}>
      {c.ok === "si" ? <Check size={12} weight="bold" /> : c.ok === "mid" ? <Minus size={12} weight="bold" /> : <X size={12} weight="bold" />}
    </span>
    {c.t}
  </span>
);

// Ancho de la columna de criterios respecto a cada columna de opción (1.3 : 1)
const U = 100 / 4.3;

export default function Comparativa() {
  const [sel, setSel] = useState(0);
  const total = filas.length;
  const aciertos = filas.filter((f) => (f[sel + 1] as Celda).ok === "si").length;

  return (
    <div className="glass-dark mt-12 overflow-x-auto rounded-3xl p-3 sm:p-5">
      <div className="relative min-w-[720px] text-sm">
        {/* Resalte que se desliza a la columna elegida */}
        <div
          aria-hidden
          className="absolute inset-y-0 rounded-2xl bg-gradient-to-b from-rojo to-[#9E1217] shadow-xl shadow-black/30 transition-[left] duration-500 ease-[cubic-bezier(.3,.9,.3,1)]"
          style={{ left: `${(1.3 + sel) * U}%`, width: `${U}%` }}
        />
        <div className="relative grid grid-cols-[1.3fr_1fr_1fr_1fr]" role="table" aria-label="ArRES frente a las alternativas">
          <div role="row" className="contents">
            <div role="columnheader"><span className="sr-only">Característica</span></div>
            {COLS.map((n, i) => (
              <button
                key={n}
                role="columnheader"
                aria-pressed={sel === i}
                onClick={() => setSel(i)}
                className={`px-5 py-5 text-left font-bold transition-colors duration-300 hover:text-crema ${i === 0 ? "font-serif text-xl" : ""} ${sel === i ? "text-crema" : "text-crema/60"}`}
              >
                {n}
              </button>
            ))}
          </div>
          {filas.map((f, r) => (
            <div role="row" key={f[0]} className="contents">
              <div role="rowheader" className="border-t border-white/10 py-4 pr-4 font-semibold">{f[0]}</div>
              {[1, 2, 3].map((c) => {
                const activa = sel === c - 1;
                return (
                  <div
                    key={c}
                    role="cell"
                    className={`border-t px-5 py-4 transition-[color,opacity] duration-300 ${activa ? "border-white/15 font-bold text-crema" : "border-white/10 text-crema/70"}`}
                  >
                    {/* key = columna activa: al cambiar, los iconos de la nueva columna rebotan en cascada */}
                    <span key={activa ? `a${sel}` : "i"} style={activa ? { animationDelay: `${r * 70 + 150}ms` } : undefined}>
                      <Estado c={f[c] as Celda} pop={activa} />
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="relative mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-crema/80">
          <span className="w-[30%] font-semibold">Criterios cubiertos</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-dorado to-naranja transition-[width] duration-700 ease-out" style={{ width: `${(aciertos / total) * 100}%` }} />
          </div>
          <span className="w-24 text-right font-serif text-lg text-crema">{aciertos} de {total}</span>
        </div>
      </div>
    </div>
  );
}

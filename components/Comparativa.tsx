"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Minus, X } from "@phosphor-icons/react";

type Nivel = "si" | "medio" | "no";
const COLS = ["ArRES", "Personal", "Otra IA"];
const filas: [string, Nivel, Nivel, Nivel][] = [
  ["Contesta llamadas 24/7", "si", "medio", "medio"],
  ["Atiende varias llamadas a la vez", "si", "no", "si"],
  ["Confirma la reserva en la misma llamada", "si", "si", "medio"],
  ["Sigue las reglas de tu restaurante", "si", "medio", "medio"],
  ["Responde siempre lo mismo", "si", "no", "si"],
  ["Venta y capacitación en persona en Puebla", "si", "si", "no"],
];
const COSTO = ["$2,000", "$9,600", "$4,497+"];

const ICONO = {
  si: { Icono: Check, clase: "bg-[#4E9A3E] text-white", texto: "Sí" },
  medio: { Icono: Minus, clase: "bg-dorado text-vino", texto: "A medias" },
  no: { Icono: X, clase: "bg-white/15 text-crema/70", texto: "No" },
};

function Marca({ n }: { n: Nivel }) {
  const { Icono, clase, texto } = ICONO[n];
  return (
    <span title={texto} className={`mx-auto grid h-7 w-7 place-items-center rounded-full ${clase}`}>
      <Icono size={15} weight="bold" aria-hidden /><span className="sr-only">{texto}</span>
    </span>
  );
}

export default function Comparativa() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.25 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  // Cada fila entra una tras otra cuando la tabla aparece en pantalla.
  const entra = (i: number) => (visible
    ? { className: "fila-entra", style: { animationDelay: `${i * 90}ms` } }
    : { className: "opacity-0", style: {} });

  return (
    <div ref={ref} className="glass-dark mt-12 rounded-3xl p-3 sm:p-6">
      <table className="w-full text-sm sm:text-base">
        <thead>
          <tr>
            <th className="w-1/2" />
            {COLS.map((c, i) => (
              <th key={c} className={`px-1 pb-4 pt-3 text-center font-bold sm:px-3 ${i === 0 ? "rounded-t-2xl bg-rojo font-serif text-lg text-crema sm:text-xl" : "text-crema/70"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(([criterio, ...valores], f) => (
            <tr key={criterio} {...entra(f)} className={`group ${entra(f).className}`}>
              <td className="border-t border-white/10 py-4 pr-3 font-semibold transition-colors group-hover:text-white">{criterio}</td>
              {valores.map((v, i) => (
                <td key={i} className={`border-t px-1 py-4 sm:px-3 ${i === 0 ? "border-white/15 bg-rojo" : "border-white/10"}`}>
                  <Marca n={v} />
                </td>
              ))}
            </tr>
          ))}
          <tr {...entra(filas.length)}>
            <td className="border-t border-white/10 py-4 pr-3 font-semibold">Costo al mes (MXN)</td>
            {COSTO.map((c, i) => (
              <td key={c} className={`border-t px-1 py-4 text-center font-bold sm:px-3 ${i === 0 ? "rounded-b-2xl border-white/15 bg-rojo font-serif text-lg text-crema" : "border-white/10 text-crema/70"}`}>
                {c}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-crema/60">
        {(["si", "medio", "no"] as Nivel[]).map((n) => (
          <span key={n} className="flex items-center gap-1.5"><span className="scale-75"><Marca n={n} /></span>{ICONO[n].texto}</span>
        ))}
      </p>
      <p className="mt-2 text-center text-xs text-crema/50">
        Personal: un empleado con salario mínimo 2026 (CONASAMI) · Otra IA: Kosmo IA, plan básico; las llamadas se cobran aparte
      </p>
    </div>
  );
}

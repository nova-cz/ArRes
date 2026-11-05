"use client";
import { useEffect, useState } from "react";
import { supabase, dia, hora } from "@/lib/supabase";
import { useRestaurante } from "@/lib/panel";

type Mensaje = { id: number; telefono: string; rol: string; texto: string; creado_en: string };
type Llamada = { telefono: string; inicio: string; mensajes: Mensaje[] };

export default function Llamadas() {
  const restaurante = useRestaurante();
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [abierta, setAbierta] = useState<number | null>(0);

  useEffect(() => {
    supabase.from("mensajes").select("id, telefono, rol, texto, creado_en")
      .eq("restaurante_id", restaurante.id).eq("canal", "llamada")
      .order("id", { ascending: false }).limit(300)
      .then(({ data }) => {
        // Una llamada = mensajes seguidos del mismo teléfono guardados casi al mismo tiempo.
        const grupos: Llamada[] = [];
        for (const m of (data ?? []).reverse()) {
          const ultima = grupos.at(-1);
          const junto = ultima && ultima.telefono === m.telefono &&
            Math.abs(new Date(m.creado_en).getTime() - new Date(ultima.inicio).getTime()) < 60000;
          if (junto) ultima.mensajes.push(m);
          else grupos.push({ telefono: m.telefono, inicio: m.creado_en, mensajes: [m] });
        }
        setLlamadas(grupos.reverse());
      });
  }, [restaurante.id]);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Llamadas atendidas</h1>
      {!llamadas.length && <p className="text-ink/60">Todavía no hay llamadas.</p>}
      {llamadas.map((l, i) => (
        <section key={i} className="rounded-[1.5rem] bg-white/80 p-5">
          <button onClick={() => setAbierta(abierta === i ? null : i)} className="flex w-full justify-between text-left font-semibold">
            <span>{l.telefono}</span>
            <span className="text-sm text-ink/60">{dia(l.inicio)} · {hora(l.inicio)} · {l.mensajes.length} mensajes</span>
          </button>
          {abierta === i && (
            <div className="mt-4 space-y-2">
              {l.mensajes.map((m) => (
                <p key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  m.rol === "cliente" ? "ml-auto bg-orange-100" : "bg-crema"}`}>
                  {m.texto}
                </p>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

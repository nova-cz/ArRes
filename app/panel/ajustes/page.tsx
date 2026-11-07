"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Tarjeta, useRestaurante } from "@/lib/panel";
import Equipo from "@/components/panel/Equipo";

type Datos = { nombre: string; direccion: string; telefono_agente: string | null };

export default function Ajustes() {
  const { id } = useRestaurante();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [estado, setEstado] = useState("");

  useEffect(() => {
    supabase.from("restaurantes").select("nombre, direccion, telefono_agente").eq("id", id).single()
      .then(({ data }) => setDatos(data));
  }, [id]);

  if (!datos) return <p className="text-ink/60">Cargando…</p>;

  async function guardar() {
    setEstado("Guardando…");
    const { nombre, direccion } = datos!;
    const telefono_agente = normalizar(datos!.telefono_agente ?? "");
    const { error } = await supabase.from("restaurantes").update({ nombre, direccion, telefono_agente }).eq("id", id);
    if (error?.code === "23505") return setEstado("Ese número ya lo usa otro restaurante.");
    setDatos({ ...datos!, telefono_agente });
    setEstado(error ? "No se pudo guardar." : "Guardado. El agente lo usa desde la siguiente llamada.");
  }

  const numeroDesvio = normalizar(datos.telefono_agente ?? "") || "NÚMERO";
  const campo = "w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 outline-none focus:border-rojo";
  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Ajustes</h1>
      <Tarjeta className="space-y-4 bg-white/85">
        <label className="block"><span className="font-semibold">Nombre del restaurante</span>
          <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className={campo} /></label>
        <label className="block"><span className="font-semibold">Dirección</span>
          <input value={datos.direccion} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} className={campo} /></label>
        <p className="text-sm text-ink/60">El menú, las preguntas frecuentes y las promociones se editan en <a href="/panel/agente" className="font-semibold text-rojo">Agente</a>.</p>
        <label className="block"><span className="font-semibold">Número del agente (Twilio)</span>
          <input value={datos.telefono_agente ?? ""} placeholder="+1 555 123 4567 o 222 123 4567" inputMode="tel"
            onChange={(e) => setDatos({ ...datos, telefono_agente: e.target.value })} className={campo} />
          <span className="text-xs text-ink/55">El número que compraste en Twilio. Las llamadas que lleguen ahí las contesta tu agente.</span></label>
        <div className="rounded-2xl bg-crema/70 p-4 text-sm">
          <p className="mb-2 font-semibold">Desvía tu teléfono de siempre al agente</p>
          <p className="mb-2 text-ink/65">Desde la línea del restaurante (celular o fijo con desvío), marca el código y el número del agente:</p>
          <ul className="space-y-1 text-ink/75">
            <li><code className="rounded bg-white px-1.5">**61*{numeroDesvio}#</code> si nadie contesta <span className="text-ink/45">(recomendado)</span></li>
            <li><code className="rounded bg-white px-1.5">**67*{numeroDesvio}#</code> si la línea está ocupada</li>
            <li><code className="rounded bg-white px-1.5">**21*{numeroDesvio}#</code> siempre</li>
            <li><code className="rounded bg-white px-1.5">##002#</code> para quitar todos los desvíos</li>
          </ul>
          <p className="mt-2 text-xs text-ink/45">Los códigos pueden variar según tu compañía; si no funcionan, pídele a tu operador el “desvío de llamadas”.</p>
        </div>
      </Tarjeta>
      <div className="flex items-center gap-4">
        <button onClick={guardar} className="rounded-full bg-rojo px-6 py-3 font-bold text-white hover:bg-granate">Guardar</button>
        <span className="text-sm text-ink/70">{estado}</span>
      </div>
      <Equipo restauranteId={id} />
    </div>
  );
}

/** Formato internacional (+52…, +1…), igual al que manda Twilio en cada llamada. */
function normalizar(texto: string) {
  const d = texto.replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 10) return `+52${d}`;
  return `+${d}`;
}

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
    const { error } = await supabase.from("restaurantes").update({ nombre, direccion }).eq("id", id);
    setEstado(error ? "No se pudo guardar." : "Guardado. El agente lo usa desde la siguiente llamada.");
  }

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
        <p className="text-sm text-ink/60">Número del agente: <b>{datos.telefono_agente || "sin configurar"}</b>. Desvía aquí las llamadas que no alcances a contestar.</p>
      </Tarjeta>
      <div className="flex items-center gap-4">
        <button onClick={guardar} className="rounded-full bg-rojo px-6 py-3 font-bold text-white hover:bg-granate">Guardar</button>
        <span className="text-sm text-ink/70">{estado}</span>
      </div>
      <Equipo restauranteId={id} />
    </div>
  );
}

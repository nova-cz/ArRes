"use client";
import { useEffect, useState } from "react";
import { Phone, Warning } from "@phosphor-icons/react";
import { supabase, dia } from "@/lib/supabase";
import { Tarjeta, useReglas, useRestaurante } from "@/lib/panel";

type Cliente = { telefono: string; nombre: string; reservas: number; llego: number; faltas: number; ultima: string };

export default function Clientes() {
  const restaurante = useRestaurante();
  const [reglas] = useReglas();
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useEffect(() => {
    supabase.from("reservas").select("telefono, nombre, estado, inicio")
      .eq("restaurante_id", restaurante.id).not("inicio", "is", null).order("inicio", { ascending: false }).limit(1000)
      .then(({ data }) => {
        const porTel = new Map<string, Cliente>();
        for (const r of data ?? []) {
          const c = porTel.get(r.telefono) ?? { telefono: r.telefono, nombre: r.nombre, reservas: 0, llego: 0, faltas: 0, ultima: r.inicio };
          c.reservas += 1;
          if (r.estado === "llego") c.llego += 1;
          if (r.estado === "no_llego") c.faltas += 1;
          porTel.set(r.telefono, c);
        }
        setClientes([...porTel.values()].sort((a, b) => b.faltas - a.faltas || b.reservas - a.reservas));
      });
  }, [restaurante.id]);

  return (
    <div className="space-y-5">
      <h1 className="font-serif text-4xl">Clientes</h1>
      <p className="text-ink/60">Quién reserva seguido y quién suele faltar. Con {reglas?.max_faltas ?? 2} faltas, el agente ya no les confirma solo.</p>
      <Tarjeta className="overflow-x-auto bg-white/85">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="text-left text-ink/45">
            <tr><th className="py-2 font-medium">Cliente</th><th className="font-medium">Reservas</th><th className="font-medium">Llegó</th><th className="font-medium">Faltas</th><th className="font-medium">Última</th></tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.telefono} className="border-t border-ink/5">
                <td className="py-3">{c.nombre}
                  <a href={`tel:${c.telefono}`} className="flex items-center gap-1 text-xs text-ink/55 hover:text-rojo"><Phone size={12} />{c.telefono}</a></td>
                <td>{c.reservas}</td><td>{c.llego}</td>
                <td className={c.faltas >= (reglas?.max_faltas ?? 2) ? "font-bold text-rojo" : ""}>
                  {c.faltas >= (reglas?.max_faltas ?? 2) && <Warning size={14} className="mr-1 inline" />}{c.faltas}
                </td>
                <td>{dia(c.ultima)}</td>
              </tr>
            ))}
            {!clientes.length && <tr><td colSpan={5} className="py-8 text-center text-ink/45">Todavía no hay clientes.</td></tr>}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}

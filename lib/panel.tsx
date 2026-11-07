"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, rangoDia, type Reglas, type Reserva } from "@/lib/supabase";

export type Restaurante = { id: string; nombre: string };
export const RestauranteCtx = createContext<Restaurante | null>(null);
export const useRestaurante = () => useContext(RestauranteCtx)!;

export const ESTADOS: Record<string, [string, string]> = {
  confirmada: ["Confirmada", "text-green-700"],
  pendiente: ["Por confirmar", "text-naranja"],
  escalada: ["Escalada", "text-rojo"],
  llego: ["Llegó", "text-sky-700"],
  no_llego: ["No llegó", "text-ink/50"],
  rechazada: ["Rechazada", "text-ink/50"],
  cancelada: ["Cancelada", "text-ink/50"],
};

// Memoria entre secciones: se muestra lo último que se cargó mientras llega lo nuevo.
const cache = new Map<string, unknown>();

/** Reservas de `dias` días desde hoy, en vivo (lo que agenda el agente aparece solo). */
export function useReservas(dias = 1) {
  const { id } = useRestaurante();
  const clave = `reservas-${id}-${dias}`;
  const [reservas, setReservasEstado] = useState<Reserva[]>(() => (cache.get(clave) as Reserva[]) ?? []);
  const setReservas = useCallback((valor: Reserva[] | ((r: Reserva[]) => Reserva[])) => {
    setReservasEstado((previo) => {
      const nuevo = typeof valor === "function" ? valor(previo) : valor;
      cache.set(clave, nuevo);
      return nuevo;
    });
  }, [clave]);

  const cargar = useCallback(async () => {
    const [desde, hasta] = rangoDia(0, dias);
    const { data } = await supabase.from("reservas").select("*").eq("restaurante_id", id)
      .or(`and(inicio.gte.${desde},inicio.lt.${hasta}),and(inicio.is.null,estado.eq.escalada)`)
      .order("inicio", { ascending: true, nullsFirst: true });
    setReservas(data ?? []);
  }, [id, dias, setReservas]);

  useEffect(() => {
    cargar();
    const canal = supabase.channel(`reservas-${dias}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas",
        filter: `restaurante_id=eq.${id}` }, cargar)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [cargar, id, dias]);

  async function cambiar(reservaId: string, estado: string) {
    setReservas((rs) => rs.map((r) => (r.id === reservaId ? { ...r, estado } : r)));
    await supabase.from("reservas").update({ estado }).eq("id", reservaId);
  }

  return { reservas, cambiar };
}

export function useReglas() {
  const { id } = useRestaurante();
  const [reglas, setReglas] = useState<Reglas | null>(() => (cache.get(`reglas-${id}`) as Reglas) ?? null);
  useEffect(() => {
    supabase.from("reglas").select("*").eq("restaurante_id", id).single().then(({ data }) => {
      cache.set(`reglas-${id}`, data);
      setReglas(data);
    });
  }, [id]);
  return [reglas, setReglas] as const;
}

export function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`tarjeta rounded-[1.75rem] border border-white/80 p-6 shadow-[0_8px_30px_rgba(61,16,21,.06)] ${className}`}>{children}</section>;
}

export function Accion({ children, onClick, principal }: { children: React.ReactNode; onClick: () => void; principal?: boolean }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${principal ? "bg-rojo text-white hover:bg-granate" : "bg-ink/5 hover:bg-ink/10"}`}>
      {children}
    </button>
  );
}

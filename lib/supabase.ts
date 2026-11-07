"use client";
import { createClient } from "@supabase/supabase-js";

// Llave publishable: segura en el navegador; la seguridad la da RLS (tabla miembros).
// Los valores de respaldo solo evitan que falle el build si aún no hay .env.local.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://falta-configurar.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "falta-configurar",
);

export const TZ = "America/Mexico_City";

export type Reserva = {
  id: string; nombre: string; telefono: string; personas: number;
  inicio: string | null; estado: string; canal: string;
  notas: string; motivo_escalada: string; creado_en: string;
};

export type Reglas = {
  restaurante_id: string; horario: Record<string, [string, string][]>;
  duracion_min: number; intervalo_min: number; cupo_personas: number; max_personas: number;
  anticipacion_min: number; dias_max_adelanto: number; auto_aprobar_hasta: number;
  minutos_alerta: number; tolerancia_min: number; max_faltas: number;
};

export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-MX", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

/** Inicio y fin del día `desplazamiento` (0 = hoy) en hora de México, como ISO. */
export function rangoDia(desplazamiento = 0, dias = 1) {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ }); // AAAA-MM-DD
  const inicio = new Date(`${hoy}T00:00:00-06:00`);
  inicio.setUTCDate(inicio.getUTCDate() + desplazamiento);
  const fin = new Date(inicio);
  fin.setUTCDate(fin.getUTCDate() + dias);
  return [inicio.toISOString(), fin.toISOString()] as const;
}

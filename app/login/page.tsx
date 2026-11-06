"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogo, PhoneCall, CalendarCheck, ShieldCheck } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

const puntos = [
  { Icono: PhoneCall, texto: "Tu agente contesta las llamadas que tu equipo no alcanza" },
  { Icono: CalendarCheck, texto: "Las reservas aparecen aquí en vivo" },
  { Icono: ShieldCheck, texto: "Tú decides los casos especiales" },
];

export default function Login() {
  const router = useRouter();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    setCargando(false);
    if (error) return setError("Correo o contraseña incorrectos.");
    router.push("/panel");
  }

  async function conGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/panel` },
    });
  }

  const campo = "w-full rounded-2xl border border-ink/10 bg-white px-5 py-3.5 outline-none transition focus:border-rojo focus:ring-4 focus:ring-rojo/10";

  return (
    <main className="grid min-h-screen p-3 sm:p-5 lg:grid-cols-[1.05fr_1fr]">
      <section className="grain relative hidden overflow-hidden rounded-[2rem] bg-vino p-12 text-crema lg:flex lg:flex-col">
        <div aria-hidden className="blob -left-20 top-10 h-72 w-72 bg-naranja/40" />
        <div aria-hidden className="blob -bottom-24 right-0 h-80 w-80 bg-rojo/50" />
        <a href="/" className="relative text-3xl font-black">Ar<span className="text-naranja">RES</span></a>
        <div className="relative my-auto max-w-md">
          <h1 className="font-serif text-5xl leading-[1.05]">Ninguna reserva sin contestar.</h1>
          <p className="mt-4 text-crema/75">Tu anfitrión de IA atiende el teléfono 24/7 con las reglas de tu restaurante.</p>
          <ul className="mt-10 space-y-4">
            {puntos.map(({ Icono, texto }) => (
              <li key={texto} className="glass-dark flex items-center gap-4 rounded-2xl px-5 py-4">
                <Icono size={24} className="shrink-0 text-naranja" />{texto}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-crema/50">Hecho en Puebla</p>
      </section>

      <section className="flex items-center justify-center px-4 py-12">
        <form onSubmit={entrar} className="aparecer w-full max-w-sm space-y-5">
          <a href="/" className="text-3xl font-black lg:hidden">Ar<span className="text-rojo">RES</span></a>
          <div>
            <h2 className="font-serif text-4xl">Bienvenido</h2>
            <p className="mt-1 text-ink/60">Entra al panel de tu restaurante.</p>
          </div>

          <button type="button" onClick={conGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-ink/10 bg-white py-3.5 font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <GoogleLogo size={20} weight="bold" />Continuar con Google
          </button>

          <div className="flex items-center gap-3 text-sm text-ink/40">
            <span className="h-px flex-1 bg-ink/10" />o con tu correo<span className="h-px flex-1 bg-ink/10" />
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Correo</span>
            <input type="email" required autoComplete="email" placeholder="tu@restaurante.com" value={correo}
              onChange={(e) => setCorreo(e.target.value)} className={campo} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Contraseña</span>
            <input type="password" required autoComplete="current-password" placeholder="••••••••" value={clave}
              onChange={(e) => setClave(e.target.value)} className={campo} />
          </label>
          {error && <p className="rounded-xl bg-rojo/10 px-4 py-2 text-sm font-semibold text-rojo">{error}</p>}
          <button disabled={cargando}
            className="w-full rounded-2xl bg-rojo py-3.5 font-bold text-white shadow-[0_10px_25px_rgba(192,22,26,.25)] transition hover:-translate-y-0.5 hover:bg-granate disabled:opacity-60">
            {cargando ? "Entrando…" : "Entrar"}
          </button>
          <p className="text-center text-sm text-ink/50">¿Aún no usas ArRES? <a href="/" className="font-semibold text-rojo">Agenda tu demo</a></p>
        </form>
      </section>
    </main>
  );
}

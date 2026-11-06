"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  return (
    <main className="relative grid min-h-screen place-items-center bg-[url('/fotos/tenue.jpg')] bg-cover bg-center p-4">
      <div aria-hidden className="absolute inset-0 bg-crema/60" />
      <form onSubmit={entrar} className="glass relative w-full max-w-sm space-y-4 rounded-[2rem] p-8">
        <a href="/" className="text-2xl font-black">Ar<span className="text-rojo">RES</span></a>
        <h1 className="font-serif text-2xl">Entra a tu panel</h1>
        <input type="email" required placeholder="Correo" value={correo} onChange={(e) => setCorreo(e.target.value)}
          className="w-full rounded-full border border-ink/10 bg-white/80 px-5 py-3 outline-none focus:border-rojo" />
        <input type="password" required placeholder="Contraseña" value={clave} onChange={(e) => setClave(e.target.value)}
          className="w-full rounded-full border border-ink/10 bg-white/80 px-5 py-3 outline-none focus:border-rojo" />
        {error && <p className="text-sm font-semibold text-rojo">{error}</p>}
        <button disabled={cargando} className="w-full rounded-full bg-rojo py-3 font-bold text-white transition-colors hover:bg-granate disabled:opacity-60">
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" onClick={conGoogle}
          className="w-full rounded-full border border-ink/15 bg-white py-3 font-bold transition-colors hover:bg-crema">
          Entrar con Google
        </button>
      </form>
    </main>
  );
}

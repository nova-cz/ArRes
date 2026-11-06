import { createClient } from "@supabase/supabase-js";

// Muestra de una voz de Deepgram para elegirla en el panel. Solo con sesión.
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "Inicia sesión" }, { status: 401 });
  const llave = process.env.DEEPGRAM_API_KEY;
  if (!llave) return Response.json({ error: "Falta DEEPGRAM_API_KEY en .env.local" }, { status: 500 });

  const { voz, texto } = await req.json();
  if (!/^aura-2-[a-z]+-es$/.test(voz ?? "")) return Response.json({ error: "Voz no válida" }, { status: 400 });
  const r = await fetch(`https://api.deepgram.com/v1/speak?model=${voz}`, {
    method: "POST",
    headers: { Authorization: `Token ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(texto ?? "").slice(0, 300) || "Hola, gracias por llamar." }),
  });
  if (!r.ok) return Response.json({ error: `Deepgram respondió ${r.status}` }, { status: 502 });
  return new Response(r.body, { headers: { "Content-Type": r.headers.get("Content-Type") ?? "audio/mpeg" } });
}

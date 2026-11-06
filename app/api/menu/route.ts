import { createClient } from "@supabase/supabase-js";

// Convierte un menú pegado como texto en filas para la tabla, con Gemini.
// Solo usuarios con sesión: así nadie gasta la cuota de Gemini desde fuera.
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") ?? "";
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "Inicia sesión" }, { status: 401 });

  const llave = process.env.GEMINI_API_KEY;
  if (!llave) return Response.json({ error: "Falta GEMINI_API_KEY en .env.local" }, { status: 500 });

  const { texto } = await req.json();
  if (!texto || texto.length > 20000) return Response.json({ error: "Pega entre 1 y 20,000 caracteres" }, { status: 400 });

  const modelo = process.env.GEMINI_MODELO || "gemini-3.5-flash-lite";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": llave },
    body: JSON.stringify({
      contents: [{ parts: [{ text:
        "Extrae los platillos de este menú de restaurante. No inventes nada: si un precio no aparece, " +
        "déjalo en null. Marca vegetariano solo si es evidente.\n\nMENÚ:\n" + texto }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              categoria: { type: "STRING" }, nombre: { type: "STRING" }, descripcion: { type: "STRING" },
              precio: { type: "NUMBER", nullable: true }, vegetariano: { type: "BOOLEAN" },
            },
            required: ["nombre"],
          },
        },
      },
    }),
  });
  if (!r.ok) return Response.json({ error: `Gemini respondió ${r.status}. Intenta en un minuto.` }, { status: 502 });
  const datos = await r.json();
  try {
    return Response.json({ platillos: JSON.parse(datos.candidates[0].content.parts[0].text) });
  } catch {
    return Response.json({ error: "No pude leer el menú. Revisa el texto." }, { status: 502 });
  }
}

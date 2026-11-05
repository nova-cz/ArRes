# ArRes

Landing de ArRES (Next.js App Router + Tailwind) y, en `agente/`, el agente de IA que
contesta llamadas y WhatsApp (Python + Pipecat). Ver [agente/README.md](agente/README.md).

## Estructura

```
app/          páginas, layout y estilos globales
components/   componentes de UI reutilizables
public/fotos/ imágenes usadas por el sitio
lib.ts        utilidades compartidas
agente/       agente de voz y WhatsApp (no forma parte del build de Vercel)
```

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

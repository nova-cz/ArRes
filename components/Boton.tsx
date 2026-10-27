import { DEMO_URL } from "@/lib";

export default function Boton({
  children, variante = "naranja", href = DEMO_URL, className = "",
}: { children: React.ReactNode; variante?: "naranja" | "oscuro" | "claro"; href?: string; className?: string }) {
  const v = {
    naranja: "bg-naranja text-ink hover:bg-[#ff7d3d]",
    oscuro: "bg-vino text-crema hover:bg-granate",
    claro: "bg-crema text-ink hover:bg-white",
  }[variante];
  const ext = href.startsWith("http");
  return (
    <a
      href={href}
      {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-colors ${v} ${className}`}
    >
      {children}
    </a>
  );
}

// Coloca la foto en /public/fotos/<nombre>.jpg; si no existe se ve el degradado cálido.
export default function Photo({ name, className = "", label }: { name: string; className?: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`bg-cover bg-center ${className}`}
      style={{
        backgroundImage: `url(/fotos/${name}.jpg), linear-gradient(135deg, #8a2b1a, #F26B2A 60%, #f3b36b)`,
      }}
    />
  );
}

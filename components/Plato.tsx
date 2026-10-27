// Medallón redondo para iconos; sustituible por foto real.
export default function Plato({ children, size = 64, className = "" }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-white text-rojo shadow-[inset_0_0_0_4px_#fff,0_6px_14px_rgba(61,16,21,.14)] ${className}`}
    >
      <span style={{ width: size * 0.5, height: size * 0.5 }} className="grid place-items-center [&>svg]:h-full [&>svg]:w-full">{children}</span>
    </span>
  );
}

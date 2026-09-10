// Sitara OS — Brand mark (star monogram)
export default function SitaraLogo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label="Sitara"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="white" aria-hidden>
        <path d="M12 1.5l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.8l7.1-.7L12 1.5z" />
        <circle cx="12" cy="11" r="2.2" fill="#f59e0b" />
      </svg>
    </div>
  );
}

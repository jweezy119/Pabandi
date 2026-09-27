export function Stat({ icon, value, label, color = 'clay', delay = 0, trend, onClick, className = '' }: {
  icon: string;
  value: string | number;
  label: string;
  color?: 'clay' | 'sage' | 'ochre' | 'sky-wash' | 'dusty-rose' | 'terracotta';
  delay?: number;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    clay: 'var(--clay)',
    sage: 'var(--sage)',
    ochre: 'var(--muted-ochre)',
    'sky-wash': 'var(--sky-wash)',
    'dusty-rose': 'var(--dusty-rose)',
    terracotta: 'var(--terracotta)',
  };

  const trendIcons = {
    up: 'arrow_upward',
    down: 'arrow_downward',
    neutral: 'remove',
  };

  const trendColors = {
    up: 'var(--sage)',
    down: 'var(--dusty-rose)',
    neutral: 'var(--soft-stone)',
  };

  const bgColor = colorMap[color] || colorMap.clay;

  const content = (
    <div
      className={`clay-rise rounded-[24px] bg-white p-5 ${onClick ? 'clay-card--interactive cursor-pointer' : ''} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-label" style={{ color: 'var(--soft-stone)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </p>
          <p className="stat-number text-4xl mt-1" style={{ color: 'var(--warm-ink)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
            {value}
          </p>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-3" style={{ color: trendColors[trend], fontSize: '12px' }}>
            <span className="material-symbols-outlined text-sm" style={{ fontSize: '16px' }}>{trendIcons[trend]}</span>
            <span style={{ fontWeight: 600 }}>{trend === 'neutral' ? 'No change' : 'From last month'}</span>
          </div>
        )}
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${bgColor}30`, boxShadow: `0 4px 12px ${bgColor}40` }}>
          <span className="material-symbols-outlined text-lg" style={{ color: bgColor, fontSize: '22px' }}>{icon}</span>
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }
  return content;
}

export const tokens = {
  color: {
    background: '#020617',
    surface: '#0f172a',
    border: 'rgba(255,255,255,0.08)',
    borderSubtle: 'rgba(255,255,255,0.05)',
    primary: '#818cf8',
    accent: '#c084fc',
    success: '#22c55e',
    warning: '#fbbf24',
    danger: '#ef4444',
    text: '#e2e8f0',
    muted: '#94a3b8',
  },
  radius: {
    sm: '6px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    full: '9999px',
  },
  font: {
    body: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
    mono: "'Fira Code', 'JetBrains Mono', monospace",
  },
};

type Variant = 'default' | 'ghost' | 'outline';

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
};

export function Button({ children, onClick, variant = 'default', className = '', disabled = false }: ButtonProps) {
  const base = [
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer',
    disabled ? 'opacity-50 cursor-not-allowed' : '',
  ].join(' ');

  const variants: Record<Variant, string> = {
    default: 'bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] hover:shadow-[0_0_30px_rgba(99,102,241,0.55)] active:scale-[0.97]',
    ghost: 'bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10',
    outline: 'bg-transparent text-slate-200 border border-white/15 hover:border-indigo-400/60 hover:text-indigo-200',
  };

  return (
    <button onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

type ChipProps = {
  children: React.ReactNode;
  tone?: 'success' | 'info' | 'danger' | 'warning';
  className?: string;
};

const chipTones: Record<NonNullable<ChipProps['tone']>, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  info: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/20',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-400/20',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
};

export function Chip({ children, tone = 'info', className = '' }: ChipProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide ${chipTones[tone]} ${className}`}>
      {children}
    </span>
  );
}

type SurfaceProps = {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Surface({ children, className = '', style }: SurfaceProps) {
  return (
    <div
      className={`rounded-xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl transition-transform duration-200 hover:-translate-y-[2px] hover:border-white/10 ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

type CalloutProps = {
  children: React.ReactNode;
  accent: string;
};

export function Callout({ children, accent }: CalloutProps) {
  return (
    <Surface style={{ borderLeft: `4px solid ${accent}` }}>{children}</Surface>
  );
}

type JsonBlockProps = {
  data: unknown;
};

export function JsonBlock({ data }: JsonBlockProps) {
  const raw = JSON.stringify(data, null, 2);
  const highlighted = raw.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-sky-200';
      if (/^"/.test(match)) {
        cls = /:$/.test(match) ? 'text-indigo-200' : 'text-emerald-200';
      } else if (/true|false/.test(match)) {
        cls = 'text-amber-200';
      } else if (/null/.test(match)) {
        cls = 'text-red-200';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );

  return (
    <pre
      className="overflow-x-auto rounded-lg bg-black/30 p-4 text-[13px] leading-relaxed text-slate-100"
      style={{ fontFamily: tokens.font.mono }}
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

type SectionProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function Section({ title, description, children, className = '' }: SectionProps) {
  return (
    <section className={`mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 ${className}`}>
      <h2 className="text-center text-3xl font-bold tracking-tight text-slate-100">{title}</h2>
      {description ? (
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">{description}</p>
      ) : null}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

type StackProps = {
  children: React.ReactNode;
  className?: string;
};

export function Stack({ children, className = '' }: StackProps) {
  return <div className={`flex flex-col gap-4 ${className}`}>{children}</div>;
}

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language = 'json' }: CodeBlockProps) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 p-4">
      <div className="mb-2 text-xs font-semibold text-slate-400">{language.toUpperCase()}</div>
      <pre
        className="overflow-x-auto text-[13px] leading-relaxed text-slate-100"
        style={{ fontFamily: tokens.font.mono }}
      >
        {code}
      </pre>
    </div>
  );
}

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  style?: React.CSSProperties;
};

const badgeTones: Record<NonNullable<BadgeProps['tone']>, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-400/25',
  danger: 'bg-rose-500/15 text-rose-300 border-rose-400/25',
  info: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/25',
};

export function Badge({ children, tone = 'info', className = '', style }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold tracking-wide ${badgeTones[tone]} ${className}`} style={style}>
      {children}
    </span>
  );
}

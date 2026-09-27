export function ClayTabs({ tabs, activeId, onChange, className = '' }: {
  tabs: { id: string; label: string; icon?: string }[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={`clay-tabs ${className}`} style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(191,179,163,0.2)', marginBottom: '24px' }}>
      {tabs.map(tab => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="clay-tab"
            style={{
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--warm-ink)' : 'var(--soft-stone)',
              background: isActive ? 'rgba(201,123,90,0.08)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--clay)' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 200ms var(--ease-smooth)',
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderRadius: 0,
            }}
          >
            {tab.icon && (
              <span className="material-symbols-outlined text-sm" style={{ fontSize: '16px', color: isActive ? 'var(--clay)' : 'var(--soft-stone)' }}>
                {tab.icon}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

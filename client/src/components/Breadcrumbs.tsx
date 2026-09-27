import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface BreadcrumbsProps {
  items?: { label: string; path?: string }[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  const location = useLocation();

  if (!items || items.length === 0) return null;

  return (
    <nav className="flex items-center gap-2 mb-4 text-sm font-body" aria-label="Breadcrumb">
      <Link to="/dashboard" className="text-[var(--soft-stone)] hover:text-[var(--clay)] transition-colors flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">home</span>
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <React.Fragment key={index}>
            <span className="text-[var(--soft-stone)] opacity-40">›</span>
            {isLast || !item.path ? (
              <span className="font-semibold text-[var(--warm-ink)]" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link to={item.path} className="text-[var(--soft-stone)] hover:text-[var(--clay)] transition-colors">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

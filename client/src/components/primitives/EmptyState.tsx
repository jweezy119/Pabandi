import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  href?: string;
}

export function EmptyState({ icon, title, description, actionText, actionLabel, onAction, href }: any) {
  const btnText = actionText || actionLabel;
  return (
    <Card hover={false} className="clay-scale-in">
      <div className="text-center py-10 flex flex-col items-center justify-center min-h-[280px]">
        <div className="clay-empty-icon">
          <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--clay)' }}>{icon}</span>
        </div>
        <h2 className="text-lg font-bold mb-2 clay-heading">
          {title}
        </h2>
        <p className="mb-6" style={{ color: 'var(--soft-stone)', fontSize: '14px', maxWidth: '360px', lineHeight: 1.6 }}>
          {description}
        </p>
        {(onAction || href) && (
          <Button onClick={onAction} href={href} icon="add">
            {btnText}
          </Button>
        )}
      </div>
    </Card>
  );
}

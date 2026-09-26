import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export function EmptyState({ icon, title, description, actionText, onAction, href }: any) {
  return (
    <Card hover={false} className="text-center p-12 w-full flex flex-col items-center justify-center min-h-[300px]">
      <span className="material-symbols-outlined text-[48px] text-[var(--clay)] mb-4 block">{icon}</span>
      <h2 className="text-xl font-bold text-[var(--warm-ink)] mb-2">{title}</h2>
      <p className="text-[var(--soft-stone)] mb-6 max-w-md mx-auto">{description}</p>
      {(onAction || href) && (
        <Button onClick={onAction} href={href}>{actionText}</Button>
      )}
    </Card>
  );
}

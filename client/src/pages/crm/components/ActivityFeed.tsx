import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { Chip } from '../../../components/primitives/Chip';

export function ActivityFeed({ activities, onToggleTask, onActivityClick }: { activities: any[], onToggleTask: (id: string, completed: boolean) => void, onActivityClick: (id: string) => void }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CALL': return 'call';
      case 'EMAIL': return 'mail';
      case 'MEETING': return 'groups';
      case 'TASK': return 'check_box';
      default: return 'edit_note';
    }
  };

  return (
    <div className="space-y-3">
      {activities.map(act => (
        <Card key={act.id} variant="default" padding="md" hover className="flex items-start gap-4 border border-[var(--warm-sand)]/60 cursor-pointer" onClick={() => onActivityClick(act.id)}>
          {act.type === 'TASK' ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleTask(act.id, act.completed); }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                act.completed
                  ? 'bg-[var(--sage)] text-white'
                  : 'bg-[var(--warm-sand)] text-[var(--soft-stone)] hover:border-[var(--clay)]'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {act.completed ? 'check' : 'check_box_outline_blank'}
              </span>
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl clay-activity-icon flex items-center justify-center shrink-0 bg-[var(--clay)]/10 text-[var(--clay)]">
              <span className="material-symbols-outlined text-[20px]">{getTypeIcon(act.type)}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm text-[var(--warm-ink)] ${act.completed ? 'line-through opacity-60' : ''}`}>
                  {act.title}
                </span>
                <Chip label={act.type} variant="info" />
              </div>

              <span className="text-xs text-[var(--soft-stone)]">
                {new Date(act.createdAt).toLocaleString()}
              </span>
            </div>

            {act.description && (
              <p className={`text-xs text-[var(--soft-stone)] mb-2 whitespace-pre-wrap ${act.completed ? 'opacity-50' : ''}`}>
                {act.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--soft-stone)] pt-2 border-t border-[var(--warm-sand)]/30">
              {act.client && (
                <div className="flex items-center gap-1 font-medium text-[var(--warm-ink)]">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {act.client.name}
                </div>
              )}
              {act.authorName && (
                <div>Logged by: <strong>{act.authorName}</strong></div>
              )}
              {act.dueDate && (
                <div className={`font-medium ${new Date(act.dueDate) < new Date() && !act.completed ? 'text-[var(--rose)]' : ''}`}>
                  Due: {new Date(act.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

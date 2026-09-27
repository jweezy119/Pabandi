import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { Chip } from '../../../components/primitives/Chip';

export function TaskBoard({ tasks, onTaskClick }: { tasks: any[], onTaskClick: (id: string) => void }) {
  const columns = ['TODO', 'IN_PROGRESS', 'DONE'];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[60vh]">
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col || (col === 'DONE' && t.completed) || (col === 'TODO' && !t.status && !t.completed));
        
        return (
          <div key={col} className="w-80 shrink-0 bg-[var(--warm-sand)]/20 p-3 rounded-2xl flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-semibold text-sm text-[var(--warm-ink)]">{col.replace('_', ' ')}</h3>
              <span className="text-xs bg-[var(--warm-sand)] text-[var(--warm-ink)] px-2 py-0.5 rounded-full">{colTasks.length}</span>
            </div>
            {colTasks.map(task => (
              <Card key={task.id} padding="md" hover className="cursor-pointer border border-[var(--warm-sand)]/60 bg-white" onClick={() => onTaskClick(task.id)}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className={`font-medium text-sm text-[var(--warm-ink)] ${task.completed ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </h4>
                  <Chip label={task.priority} variant={task.priority === 'HIGH' ? 'danger' : task.priority === 'MEDIUM' ? 'warning' : 'default'} size="sm" />
                </div>
                {task.client && <div className="text-xs text-[var(--soft-stone)] mb-2">Client: {task.client.name}</div>}
                <div className="flex justify-between items-center text-[11px] text-[var(--soft-stone)]">
                  <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No date'}</span>
                  <span>{task.authorName}</span>
                </div>
              </Card>
            ))}
            {colTasks.length === 0 && (
              <div className="text-center py-6 text-[var(--soft-stone)] text-xs border border-dashed border-[var(--warm-sand)] rounded-xl">
                No tasks
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

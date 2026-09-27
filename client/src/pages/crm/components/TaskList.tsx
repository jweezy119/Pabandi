import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { Chip } from '../../../components/primitives/Chip';

export function TaskList({ tasks, onToggleTask, onTaskClick }: { tasks: any[], onToggleTask: (id: string, completed: boolean) => void, onTaskClick: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-[var(--warm-sand)] text-[var(--soft-stone)]">
            <th className="px-4 py-3 font-medium w-12">Status</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Client / Deal</th>
            <th className="px-4 py-3 font-medium">Due Date</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Assignee</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--warm-sand)]/50">
          {tasks.map(task => (
            <tr key={task.id} className="hover:bg-[var(--warm-sand)]/20 cursor-pointer" onClick={() => onTaskClick(task.id)}>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onToggleTask(task.id, task.completed)}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    task.completed
                      ? 'bg-[var(--sage)] text-white'
                      : 'border border-[var(--soft-stone)] text-transparent hover:border-[var(--clay)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                </button>
              </td>
              <td className={`px-4 py-3 font-medium text-[var(--warm-ink)] ${task.completed ? 'line-through opacity-60' : ''}`}>
                {task.title}
              </td>
              <td className="px-4 py-3 text-[var(--soft-stone)]">
                {task.client?.name || task.deal?.title || '-'}
              </td>
              <td className={`px-4 py-3 ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-[var(--rose)] font-medium' : 'text-[var(--soft-stone)]'}`}>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
              </td>
              <td className="px-4 py-3">
                <Chip label={task.priority} variant={task.priority === 'HIGH' ? 'danger' : task.priority === 'MEDIUM' ? 'warning' : 'default'} size="sm" />
              </td>
              <td className="px-4 py-3 text-[var(--soft-stone)]">
                {task.authorName || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

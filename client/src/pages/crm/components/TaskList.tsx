import { useEffect, useState } from 'react';
import { Card } from '../../../components/primitives/Card';
import { Chip } from '../../../components/primitives/Chip';

const PAGE_SIZE = 25;

export function TaskList({
  tasks, onToggleTask, onTaskClick, onDeleteTask,
}: {
  tasks: any[];
  onToggleTask: (id: string, completed: boolean) => void;
  onTaskClick: (id: string) => void;
  /**
   * Optional. Without it the delete button is not rendered at all, rather than
   * rendered dead — a control that cannot work is worse than an absent one.
   */
  onDeleteTask?: (id: string) => void;
}) {
  // The CRM API returns unbounded task arrays. Rendering hundreds of rows on a
  // phone is the single biggest source of jank on the tasks screen.
  const [visible, setVisible] = useState(PAGE_SIZE);
  useEffect(() => setVisible(PAGE_SIZE), [tasks.length]);
  const shown = tasks.slice(0, visible);

  const toggleButton = (task: any) => (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleTask(task.id, task.completed); }}
      aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}
      className={`w-11 h-11 sm:w-6 sm:h-6 rounded flex items-center justify-center transition-colors touch-target ${
        task.completed
          ? 'bg-[var(--sage)] text-[var(--warm-ink)]'
          : 'border border-[var(--soft-stone)] text-transparent hover:border-[var(--clay)]'
      }`}
    >
      <span className="material-symbols-outlined text-[16px]">check</span>
    </button>
  );

  return (
    <>
      {/* Phone: compact cards. A 6-column table is unreadable at 360px. */}
      <div className="space-y-3 md:hidden">
        {shown.map((task) => (
          <Card
            key={task.id}
            noPadding
            className="cursor-pointer"
            onClick={() => onTaskClick(task.id)}
          >
            <div className="flex items-start gap-3 p-4">
              <div onClick={(e) => e.stopPropagation()}>{toggleButton(task)}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-[var(--warm-ink)] ${task.completed ? 'line-through opacity-60' : ''}`}>
                  {task.title}
                </div>
                <div className="text-sm text-[var(--soft-stone)] mt-1">
                  {task.client?.name || task.deal?.title || '–'}
                  {task.dueDate ? ` · ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Chip label={task.priority} variant={task.priority === 'HIGH' ? 'danger' : task.priority === 'MEDIUM' ? 'warning' : 'neutral'} size="sm" />
                  {task.authorName && <span className="text-xs text-[var(--soft-stone)]">{task.authorName}</span>}
                </div>
              </div>
              {onDeleteTask && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                  aria-label={`Delete task: ${task.title}`}
                  className="w-11 h-11 flex items-center justify-center text-[var(--dusty-rose)] touch-target shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop/tablet: existing table. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="mobile-table w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[var(--warm-sand)] text-[var(--soft-stone)]">
              <th className="px-4 py-3 font-medium w-12">Status</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Client / Deal</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Assignee</th>
              {onDeleteTask && <th className="px-4 py-3 font-medium w-12"><span className="sr-only">Delete</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--warm-sand)]/50">
            {shown.map((task) => (
              <tr key={task.id} className="hover:bg-[var(--warm-sand)]/20 cursor-pointer" onClick={() => onTaskClick(task.id)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {toggleButton(task)}
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
                  <Chip label={task.priority} variant={task.priority === 'HIGH' ? 'danger' : task.priority === 'MEDIUM' ? 'warning' : 'neutral'} size="sm" />
                </td>
                <td className="px-4 py-3 text-[var(--soft-stone)]">
                  {task.authorName || '-'}
                </td>
                {onDeleteTask && (
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                      aria-label={`Delete task: ${task.title}`}
                      title="Delete this task"
                      className="text-[var(--dusty-rose)] hover:opacity-70"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible < tasks.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-4 w-full min-h-[44px] rounded-xl border border-[var(--warm-sand)] text-[var(--soft-stone)] touch-target"
        >
          Load {Math.min(PAGE_SIZE, tasks.length - visible)} more ({tasks.length - visible} remaining)
        </button>
      )}
    </>
  );
}

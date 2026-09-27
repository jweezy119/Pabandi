import React, { useState } from 'react';
import { Card } from '../../../components/primitives/Card';

export function TaskCalendar({ tasks, onTaskClick }: { tasks: any[], onTaskClick: (id: string) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  return (
    <div className="bg-white rounded-2xl border border-[var(--warm-sand)] overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-[var(--warm-sand)]">
        <h3 className="text-lg font-bold text-[var(--warm-ink)]">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <div className="flex gap-2">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded bg-[var(--warm-sand)]/50 hover:bg-[var(--warm-sand)] text-[var(--warm-ink)]">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded bg-[var(--warm-sand)]/50 hover:bg-[var(--warm-sand)] text-[var(--warm-ink)]">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 border-b border-[var(--warm-sand)] text-xs font-semibold text-[var(--soft-stone)] text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 border-r border-[var(--warm-sand)] last:border-0">{day}</div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 auto-rows-[120px] bg-[var(--warm-sand)]/10 gap-[1px]">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="bg-white" />;
          
          const dayTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === day.toDateString());
          const isToday = new Date().toDateString() === day.toDateString();

          return (
            <div key={day.toISOString()} className="bg-white p-1 flex flex-col overflow-hidden">
              <div className={`text-xs p-1 mb-1 font-medium w-6 h-6 flex justify-center items-center rounded-full ${isToday ? 'bg-[var(--clay)] text-white' : 'text-[var(--soft-stone)]'}`}>
                {day.getDate()}
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 mobile-scroll">
                {dayTasks.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className={`text-[10px] px-1.5 py-1 rounded cursor-pointer truncate ${task.completed ? 'bg-[var(--sage)]/20 text-[var(--sage)] line-through' : 'bg-[var(--clay)]/10 text-[var(--clay)] hover:bg-[var(--clay)]/20'}`}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

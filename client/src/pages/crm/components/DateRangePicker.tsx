import React from 'react';
import { Button } from '../../../components/primitives/Button';

export type DateRange = {
  label: string;
  startDate?: string;
  endDate?: string;
};

export function DateRangePicker({ value, onChange }: { value: string, onChange: (val: string, start?: string, end?: string) => void }) {
  const getDates = (preset: string) => {
    const end = new Date();
    const start = new Date();
    switch (preset) {
      case '7d': start.setDate(end.getDate() - 7); break;
      case '30d': start.setDate(end.getDate() - 30); break;
      case '90d': start.setDate(end.getDate() - 90); break;
      case 'ytd': start.setMonth(0, 1); break;
      case 'all': return { start: undefined, end: undefined };
      default: return { start: undefined, end: undefined };
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const handleChange = (preset: string) => {
    const { start, end } = getDates(preset);
    onChange(preset, start, end);
  };

  const presets = [
    { id: '7d', label: '7D' },
    { id: '30d', label: '30D' },
    { id: '90d', label: '90D' },
    { id: 'ytd', label: 'YTD' },
    { id: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex gap-2">
      {presets.map(p => (
        <Button
          key={p.id}
          variant={value === p.id ? 'primary' : 'ghost'}
          onClick={() => handleChange(p.id)}
          className={value === p.id ? '' : 'text-[var(--soft-stone)] hover:text-[var(--warm-ink)]'}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

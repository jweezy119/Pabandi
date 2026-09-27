import React from 'react';
import { Card } from '../../../components/primitives/Card';
import { CSVExportButton } from './CSVExportButton';

export function ExpensesWidget({ data, loading }: { data: any[], loading: boolean }) {
  if (loading) return <Card padding="lg" className="animate-pulse bg-[var(--warm-sand)]/20 h-[300px]" />;

  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const total = data.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <Card padding="lg" className="h-full flex flex-col relative">
      <div className="absolute top-4 right-4">
        <CSVExportButton data={data} filename="expenses-report" label="" />
      </div>
      <h3 className="text-lg font-bold text-[var(--warm-ink)] mb-1">Expenses</h3>
      <p className="text-sm text-[var(--soft-stone)] mb-6">Total: ${total.toLocaleString()}</p>
      
      <div className="flex-1 flex flex-col gap-3 justify-center overflow-y-auto pr-2">
        {data.length === 0 && <div className="text-center text-[var(--soft-stone)]">No expenses found</div>}
        {data.map((d) => (
          <div key={d.category} className="space-y-1">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-[var(--warm-ink)]">{d.category}</span>
              <span className="text-[var(--terracotta)]">${d.amount.toLocaleString()}</span>
            </div>
            <div className="h-2 bg-[var(--warm-sand)] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-1000 bg-[var(--terracotta)]/80" 
                style={{ width: `${(d.amount / maxVal) * 100}%` }} 
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

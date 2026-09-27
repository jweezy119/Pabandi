import React from 'react';
import { Button } from '../../../components/primitives/Button';

export function CSVExportButton({ data, filename, label = 'Export CSV' }: { data: any[], filename: string, label?: string }) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    
    // Simple flatten logic
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let val = row[header];
          if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button variant="ghost" icon="download" onClick={handleExport}>
      {label}
    </Button>
  );
}

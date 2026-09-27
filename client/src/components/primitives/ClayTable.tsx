import React from 'react';

interface ClayTableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface ClayTableProps<T> {
  columns: ClayTableColumn<T>[];
  data: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  onSort?: (column: ClayTableColumn<T>, direction: 'asc' | 'desc') => void;
  sortColumn?: ClayTableColumn<T>;
  sortDirection?: 'asc' | 'desc';
  selectedKeys?: Set<string>;
  onSelect?: (key: string, selected: boolean) => void;
  selectable?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ClayTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  onSort,
  sortColumn,
  sortDirection,
  selectedKeys,
  onSelect,
  selectable,
  emptyMessage = 'No data available',
  className = '',
}: ClayTableProps<T>) {
  const getCellValue = (row: T, col: ClayTableColumn<T>) => {
    if (col.render) return col.render(row);
    const key = col.key as string;
    if (key in row) return row[key as keyof T];
    return '';
  };

  const handleHeaderClick = (col: ClayTableColumn<T>) => {
    if (col.sortable && onSort) {
      onSort(col, sortColumn?.key === col.key ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc');
    }
  };

  const SortIcon = ({ col }: { col: ClayTableColumn<T> }) => {
    if (!col.sortable) return null;
    if (sortColumn?.key !== col.key) {
      return <span className="material-symbols-outlined text-xs opacity-30">unfold_more</span>;
    }
    return (
      <span className="material-symbols-outlined text-xs" style={{ color: 'var(--clay)', fontSize: '14px' }}>
        {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    );
  };

  if (data.length === 0) {
    return (
      <div className={`rounded-[24px] bg-white p-8 text-center ${className}`} style={{ boxShadow: 'var(--shadow-soft)' }}>
        <p style={{ color: 'var(--soft-stone)', fontSize: '14px' }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-[24px] bg-white overflow-hidden ${className}`} style={{ boxShadow: 'var(--shadow-soft)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(191,179,163,0.2)' }}>
            {selectable && (
              <th style={{ padding: '0', width: '40px', borderBottom: '1px solid rgba(191,179,163,0.2)', borderRight: '1px solid rgba(191,179,163,0.2)' }}>
                <input
                  type="checkbox"
                  className="mx-auto clay-checkbox"
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={String(col.key)}
                onClick={() => handleHeaderClick(col)}
                className="clay-table-header"
                style={{
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-label)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--soft-stone)',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  width: col.width || 'auto',
                  borderBottom: '1px solid rgba(191,179,163,0.2)',
                  background: 'rgba(245,239,230,0.5)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <SortIcon col={col} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const key = String(row[keyField]);
            const isSelected = selectedKeys?.has(key) || false;
            return (
              <tr
                key={key}
                onClick={() => onRowClick?.(row)}
                className="clay-table-row-clay"
                style={{
                  borderBottom: '1px solid rgba(191,179,163,0.12)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 150ms ease',
                  animation: `clay-rise 400ms var(--ease-entrance) both`,
                  animationDelay: `${i * 40}ms`,
                }}
              >
                {selectable && (
                  <td style={{ padding: '0 16px', borderBottom: '1px solid rgba(191,179,163,0.12)', borderRight: '1px solid rgba(191,179,163,0.12)' }}>
                    <input
                      type="checkbox"
                      className="mx-auto clay-checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelect?.(key, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td
                    key={String(col.key)}
                    style={{
                      padding: '12px 16px',
                      color: 'var(--warm-ink)',
                      borderBottom: '1px solid rgba(191,179,163,0.12)',
                      borderRight: '1px solid rgba(191,179,163,0.12)',
                      fontSize: '13px',
                    }}
                  >
                    {getCellValue(row, col)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

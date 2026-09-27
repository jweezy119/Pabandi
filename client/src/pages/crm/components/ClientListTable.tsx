import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Chip } from '../../../components/primitives';

export default function ClientListTable({ clients, onEdit, onDelete }: any) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [columns, setColumns] = useState(['name', 'company', 'contact', 'ltv', 'status', 'actions']);
  const [showColPicker, setShowColPicker] = useState(false);
  const itemsPerPage = 10;

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let res = clients.filter((c: any) => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company || '').toLowerCase().includes(search.toLowerCase())
    );
    res.sort((a: any, b: any) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      if (sortCol === 'contact') { aVal = a.email; bVal = b.email; }
      if (sortCol === 'ltv') { aVal = a.totalSpent || 0; bVal = b.totalSpent || 0; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return res;
  }, [clients, search, sortCol, sortDir]);

  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length) setSelectedIds([]);
    else setSelectedIds(paginated.map((c: any) => c.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleCol = (col: string) => {
    setColumns(prev => prev.includes(col) ? prev.filter(x => x !== col) : [...prev, col]);
  };

  const allCols = [
    { id: 'name', label: 'Name' },
    { id: 'company', label: 'Company' },
    { id: 'contact', label: 'Contact' },
    { id: 'ltv', label: 'Lifetime Value' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: 'Actions' }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[rgba(191,179,163,0.3)] overflow-hidden">
      <div className="p-4 border-b border-[rgba(191,179,163,0.3)] flex justify-between items-center bg-[var(--warm-sand)]/30">
        <div className="flex gap-4 items-center w-full max-w-md">
          <Input 
            placeholder="Search clients..." 
            value={search} 
            onChange={(e: any) => { setSearch(e.target.value); setPage(1); }} 
          />
        </div>
        <div className="flex gap-2 items-center relative">
          {selectedIds.length > 0 && (
            <div className="flex gap-2 mr-4">
              <span className="text-sm text-[var(--soft-stone)] self-center">{selectedIds.length} selected</span>
              <Button variant="secondary" size="sm">Bulk Email</Button>
              <Button variant="danger" size="sm" onClick={() => { /* Bulk Delete */ }}>Delete</Button>
            </div>
          )}
          <Button variant="ghost" size="sm" icon="view_column" onClick={() => setShowColPicker(!showColPicker)}>
            Columns
          </Button>
          {showColPicker && (
            <div className="absolute top-12 right-0 bg-white border shadow-lg rounded-xl p-3 z-10 w-48">
              <h4 className="font-bold text-sm mb-2 text-[var(--warm-ink)]">Columns</h4>
              {allCols.map(c => (
                <label key={c.id} className="flex items-center gap-2 mb-2 text-sm text-[var(--soft-stone)] cursor-pointer">
                  <input type="checkbox" checked={columns.includes(c.id)} onChange={() => toggleCol(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--warm-sand)]">
              <th className="p-4 w-10">
                <input type="checkbox" checked={selectedIds.length === paginated.length && paginated.length > 0} onChange={toggleSelectAll} />
              </th>
              {columns.includes('name') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] cursor-pointer" onClick={() => toggleSort('name')}>Name {sortCol === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>}
              {columns.includes('company') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] cursor-pointer" onClick={() => toggleSort('company')}>Company {sortCol === 'company' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>}
              {columns.includes('contact') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] cursor-pointer" onClick={() => toggleSort('contact')}>Contact {sortCol === 'contact' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>}
              {columns.includes('status') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)]">Status</th>}
              {columns.includes('ltv') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] text-right cursor-pointer" onClick={() => toggleSort('ltv')}>LTV {sortCol === 'ltv' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>}
              {columns.includes('actions') && <th className="p-4 text-sm font-semibold text-[var(--warm-ink)] text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginated.map((client: any) => (
              <tr key={client.id} className="border-t border-[rgba(191,179,163,0.2)] hover:bg-[var(--warm-sand)]/20">
                <td className="p-4">
                  <input type="checkbox" checked={selectedIds.includes(client.id)} onChange={() => toggleSelect(client.id)} />
                </td>
                {columns.includes('name') && (
                  <td className="p-4 font-medium text-[var(--warm-ink)]">
                    <Link to={`/contact/clients/${client.id}`} className="hover:text-[var(--clay)] transition">
                      {client.name}
                    </Link>
                  </td>
                )}
                {columns.includes('company') && <td className="p-4 text-[var(--soft-stone)] text-sm">{client.company || '—'}</td>}
                {columns.includes('contact') && (
                  <td className="p-4 text-[var(--soft-stone)] text-sm">
                    <div>{client.email || '—'}</div>
                    <div className="text-xs">{client.phone || '—'}</div>
                  </td>
                )}
                {columns.includes('status') && (
                  <td className="p-4">
                    <Chip label={client.status || 'ACTIVE'} variant="neutral" />
                  </td>
                )}
                {columns.includes('ltv') && (
                  <td className="p-4 text-right font-medium text-[var(--terracotta)]">
                    ${(client.totalSpent || 0).toLocaleString()}
                  </td>
                )}
                {columns.includes('actions') && (
                  <td className="p-4 text-right">
                    <button onClick={() => onEdit(client)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--clay)] transition">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button onClick={() => onDelete(client.id)} className="p-2 text-[var(--soft-stone)] hover:text-[var(--terracotta)] transition">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[rgba(191,179,163,0.3)] flex justify-between items-center bg-[var(--warm-sand)]/10">
        <span className="text-sm text-[var(--soft-stone)]">
          Showing {(page - 1) * itemsPerPage + 1} to Math.min(page * itemsPerPage, filtered.length) of {filtered.length} entries
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Chip } from '../../../components/primitives';

/**
 * onBulkDelete is optional so a caller that cannot delete reports that
 * honestly. When it is absent the button is not rendered at all — a visible
 * destructive button that quietly does nothing is worse than no button, because
 * the user believes the delete happened.
 */
export interface ClientListTableRow {
  id: string;
  name: string;
  email?: string;
  company?: string;
  status?: string;
  totalSpent?: number;
}

export interface ClientListTableProps {
  clients: ClientListTableRow[];
  onEdit?: (client: ClientListTableRow) => void;
  /** Takes the id, not the row: the confirm dialog is keyed by id. */
  onDelete?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;

  /**
   * Search, sort and page are the SERVER's job now.
   *
   * They used to be applied here, in the browser, over the complete client list —
   * which meant the whole list had to be downloaded to search it, and the search could
   * only ever see the rows already on screen. With a paged result that becomes a
   * search of the current page, which returns nothing whenever the match is on
   * page 4, silently.
   *
   * These props are optional: without them the table still renders, and still sorts
   * and pages whatever array it was given. That keeps every other caller working and
   * makes the server path an opt-in upgrade rather than a breaking change.
   */
  query?: { page: number; limit: number; search: string; sortBy: string; sortOrder: string };
  pagination?: { page: number; limit: number; total: number; totalPages: number } | null;
  onQueryChange?: (patch: Partial<NonNullable<ClientListTableProps['query']>>) => void;
}

export default function ClientListTable({
  clients, onEdit, onDelete, onBulkDelete, query, pagination, onQueryChange,
}: ClientListTableProps) {
  const serverDriven = Boolean(onQueryChange);
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [columns, setColumns] = useState(['name', 'company', 'contact', 'ltv', 'status', 'actions']);
  const [showColPicker, setShowColPicker] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const itemsPerPage = 10;

  /**
   * Sorting asks the server for the column's order rather than reordering the page.
   * Reordering the page locally would produce a table that looks sorted for one screen
   * and is not sorted at all once you page on.
   */
  const toggleSort = (col: string) => {
    const nextDir = sortCol === col && sortDir === 'asc' ? 'desc' : 'asc';
    if (serverDriven) {
      const serverCol = col === 'contact' ? 'email' : col === 'ltv' ? 'totalSpent' : col;
      onQueryChange?.({ sortBy: serverCol, sortOrder: nextDir, page: 1 });
      return;
    }
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    // The server already filtered, sorted and paged this array. Touching it here
    // would only re-break the order it established.
    if (serverDriven) return clients as any[];


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
  }, [clients, search, sortCol, sortDir, serverDriven]);

  const paginated = serverDriven
    ? (filtered as any[])
    : filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = serverDriven
    ? (pagination?.totalPages ?? 1)
    : Math.ceil(filtered.length / itemsPerPage);
  const currentPage = serverDriven ? (query?.page ?? 1) : page;
  const totalRows = serverDriven ? (pagination?.total ?? filtered.length) : filtered.length;

  const toggleSelectAll = () => {
    if (selectedIds.length === paginated.length) setSelectedIds([]);
    else setSelectedIds(paginated.map((c) => c.id));
  };

  const runBulkDelete = async () => {
    if (!onBulkDelete) return;
    setBulkBusy(true);
    setBulkError(null);
    try {
      await onBulkDelete(selectedIds);
      setSelectedIds([]);
      setConfirmingDelete(false);
    } catch (err) {
      // Report the failure rather than clearing the selection: the user needs
      // to know the clients are still there.
      setBulkError(err instanceof Error ? err.message : 'Delete failed. Please try again.');
    } finally {
      setBulkBusy(false);
    }
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
            value={serverDriven ? (query?.search ?? '') : search} 
            onChange={(e: any) => {
              setSearch(e.target.value);
              if (serverDriven) { onQueryChange?.({ search: e.target.value, page: 1 }); return; }
              setPage(1);
            }} 
          />
        </div>
        <div className="flex gap-2 items-center relative">
          {selectedIds.length > 0 && (
            <div className="flex gap-2 mr-4 items-center">
              <span className="text-sm text-[var(--soft-stone)] self-center">{selectedIds.length} selected</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedIds([])}
                title="Clear selection"
              >
                Clear
              </Button>
              {onBulkDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={bulkBusy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete
                </Button>
              )}
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
                    {/* Each action renders only when the caller supplied it, so
                        the table never shows a control that cannot act. */}
                    {onEdit && (
                      <button
                        onClick={() => onEdit(client)}
                        title={`Edit ${client.name}`}
                        aria-label={`Edit ${client.name}`}
                        className="p-2 text-[var(--soft-stone)] hover:text-[var(--clay)] transition"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => onDelete(client.id)}
                        title={`Delete ${client.name}`}
                        aria-label={`Delete ${client.name}`}
                        className="p-2 text-[var(--soft-stone)] hover:text-[var(--terracotta)] transition"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-[rgba(191,179,163,0.3)] flex justify-between items-center bg-[var(--warm-sand)]/10">
        <span className="text-sm text-[var(--soft-stone)]">
          {filtered.length === 0
            ? 'No entries'
            : totalRows === 0
              ? 'No entries'
              : `Showing ${(currentPage - 1) * (serverDriven ? (pagination?.limit ?? 25) : itemsPerPage) + 1} to ${
                  Math.min(currentPage * (serverDriven ? (pagination?.limit ?? 25) : itemsPerPage), totalRows)
                } of ${totalRows} entries`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const prev = Math.max(1, currentPage - 1);
              if (serverDriven) { onQueryChange?.({ page: prev }); setSelectedIds([]); return; }
              setPage(prev);
            }}
            disabled={currentPage === 1}
          >Prev</Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const next = Math.min(totalPages, currentPage + 1);
              if (serverDriven) { onQueryChange?.({ page: next }); setSelectedIds([]); return; }
              setPage(next);
            }}
            disabled={currentPage === totalPages}
          >Next</Button>
        </div>
      </div>

      {/* Destructive confirmation. Deleting clients is not undoable from this
          screen, and the selection can span a full page, so the count is
          stated explicitly rather than "are you sure?" */}
      {confirmingDelete && onBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirmingDelete(false)}>
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-[rgba(191,179,163,0.3)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
          >
            <h3 id="bulk-delete-title" className="text-lg font-bold mb-2" style={{ color: 'var(--warm-ink)' }}>
              Delete {selectedIds.length} client{selectedIds.length === 1 ? '' : 's'}?
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--soft-stone)' }}>
              Their jobs, invoices and history go with them. This cannot be undone.
            </p>

            {bulkError && (
              <div className="clay-alert clay-alert--critical mb-4">
                <p className="text-sm" style={{ color: 'var(--warm-ink)' }}>{bulkError}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={bulkBusy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={runBulkDelete} loading={bulkBusy}>
                {bulkBusy ? 'Deleting…' : `Delete ${selectedIds.length}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

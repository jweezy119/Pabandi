import React, { useState, useCallback, useRef } from 'react';
import { Button, Modal } from '../../../components/primitives';
import { Upload, FileText, X, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvData: string) => Promise<{ imported: number; skipped: number; errors: string[] }>;
  title?: string;
  expectedFields?: string[];
  templateHeaders?: string[];
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += char; }
    } else {
      if (char === '"') { inQuotes = true; }
      else if (char === ',') { current.push(field); field = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        current.push(field); field = '';
        if (current.some(c => c.trim() !== '')) rows.push(current);
        current = [];
      } else { field += char; }
    }
  }
  current.push(field);
  if (current.some(c => c.trim() !== '')) rows.push(current);
  return rows;
}

export default function CSVImportModal({
  isOpen,
  onClose,
  onImport,
  title = 'Import from CSV',
  expectedFields = [],
  templateHeaders = [],
}: CSVImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvData, setCsvData] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setCsvData('');
    setHeaders([]);
    setRows([]);
    setColumnMap({});
    setResult(null);
    setDragOver(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = useCallback((text: string) => {
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast.error('CSV must have a header row and at least one data row');
      return;
    }
    setCsvData(text);
    setHeaders(parsed[0].map(h => h.trim()));
    setRows(parsed.slice(1));
    setStep('mapping');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a CSV file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => processFile(reader.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = () => processFile(reader.result as string);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const res = await onImport(csvData);
      setResult(res);
      setStep('done');
      // The import is all-or-nothing, so `imported: 0` with a non-empty `errors` list is a
      // REJECTED file, not a successful no-op. Showing a green "Imported 0 records" toast
      // for it tells the user their data went in when nothing did — and the row errors,
      // which are the only useful thing on screen at that point, arrive under a success
      // notification. The done step still lists every failing row either way.
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} records`);
      } else {
        toast.error(
          res.errors?.length
            ? `Nothing imported — ${res.errors.length} problem${res.errors.length === 1 ? '' : 's'} to fix`
            : 'Nothing was imported',
        );
      }
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Import failed');
      setStep('mapping');
    }
  };

  const downloadTemplate = () => {
    const headers = templateHeaders.length > 0 ? templateHeaders : expectedFields;
    const csv = headers.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} wide>
      <div className="space-y-4">
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-[var(--clay)] bg-[var(--clay)]/5' : 'border-[rgba(191,179,163,0.3)] hover:border-[var(--clay)]/50'
              }`}
            >
              <Upload size={32} className="mx-auto text-[var(--soft-stone)] mb-3" />
              <p className="text-sm font-medium text-[var(--warm-ink)]">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-[var(--soft-stone)] mt-1">Max 5MB, .csv files only</p>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
            </div>

            {expectedFields.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--warm-sand)]/30">
                <p className="text-xs font-semibold text-[var(--warm-ink)] mb-2">Expected columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {expectedFields.map(f => (
                    <span key={f} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/60 text-[var(--soft-stone)]">{f}</span>
                  ))}
                </div>
                <button onClick={downloadTemplate} className="mt-3 text-xs font-medium text-[var(--clay)] hover:underline">
                  Download template CSV
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--soft-stone)]">Map your CSV columns to fields. Unmapped columns will be ignored.</p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/40">
                  <span className="text-sm font-medium text-[var(--warm-ink)] w-40 truncate">{header}</span>
                  <span className="text-[var(--soft-stone)]">→</span>
                  <select
                    value={columnMap[header] || ''}
                    onChange={e => setColumnMap(prev => ({ ...prev, [header]: e.target.value }))}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[rgba(191,179,163,0.3)] bg-white/50 text-sm"
                  >
                    <option value="">Skip</option>
                    {expectedFields.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('preview')}>Preview</Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--soft-stone)]">Preview of first 5 rows:</p>
            <div className="overflow-x-auto rounded-xl border border-[rgba(191,179,163,0.2)]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--warm-sand)]/30">
                    {headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-semibold text-[var(--warm-ink)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-[rgba(191,179,163,0.1)]">
                      {headers.map((_, j) => (
                        <td key={j} className="px-3 py-2 text-[var(--soft-stone)] whitespace-nowrap">{row[j] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--soft-stone)]">{rows.length} rows total</p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="ghost" onClick={() => setStep('mapping')}>Back</Button>
              <Button onClick={handleImport}>Import {rows.length} rows</Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 text-center">
            <div className="w-10 h-10 border-4 border-[var(--clay)]/20 border-t-[var(--clay)] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-[var(--soft-stone)]">Importing...</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--sage)]/20 flex items-center justify-center">
                <Check size={20} className="text-[var(--sage)]" />
              </div>
              <div>
                <p className="font-semibold text-[var(--warm-ink)]">Import complete</p>
                <p className="text-sm text-[var(--soft-stone)]">{result.imported} imported, {result.skipped} skipped</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="p-3 rounded-xl bg-[var(--dusty-rose)]/10 border border-[var(--dusty-rose)]/20 max-h-[200px] overflow-y-auto">
                <p className="text-xs font-semibold text-[var(--warm-ink)] mb-1">Issues:</p>
                {result.errors.slice(0, 10).map((err, i) => (
                  <p key={i} className="text-xs text-[var(--soft-stone)]">{err}</p>
                ))}
                {result.errors.length > 10 && <p className="text-xs text-[var(--soft-stone)]">...and {result.errors.length - 10} more</p>}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

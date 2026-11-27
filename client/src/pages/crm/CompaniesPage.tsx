import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { Button, Card, Input } from '../../components/primitives';
import { getAuthToken } from '../../utils/authToken';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken() || ''}` });

interface Company {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
}

/** Company/account directory — the first-class account object the CRM lacked. */
export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/companies?q=${encodeURIComponent(search)}`, { headers: headers() });
      if (res.ok) setCompanies((await res.json()).data || []);
    } catch {
      setError('Could not load companies.');
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/crm/companies`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: name.trim(), domain: domain.trim() || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setName('');
      setDomain('');
      await load();
    } catch {
      setError('Could not create company.');
    }
  };

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--warm-ink)]">Companies</h1>
          <p className="text-sm text-[var(--soft-stone)]">Accounts linked to your clients and deals by name.</p>
        </div>
        {error && <p className="text-sm text-[var(--dusty-rose)]">{error}</p>}
        <Card className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Input label="Company name" value={name} onChange={(e: any) => setName(e.target.value)} />
          <Input label="Domain" value={domain} onChange={(e: any) => setDomain(e.target.value)} />
          <Button variant="primary" onClick={create} disabled={!name.trim()}>Add company</Button>
        </Card>
        <Input label="Search" value={search} onChange={(e: any) => setSearch(e.target.value)} placeholder="Search companies…" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {companies.length === 0 && <p className="text-sm text-[var(--soft-stone)]">No companies yet.</p>}
          {companies.map((c) => (
            <Card key={c.id} className="p-4">
              <p className="font-semibold text-[var(--warm-ink)]">{c.name}</p>
              <p className="text-sm text-[var(--soft-stone)]">{c.domain || c.industry || '—'}</p>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

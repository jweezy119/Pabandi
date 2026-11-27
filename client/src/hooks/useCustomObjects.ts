import { useEffect, useState } from 'react';
import { getAuthToken } from '../utils/authToken';

export interface CustomObject {
  id: string;
  name: string;
  pluralName?: string | null;
  icon: string;
  color: string;
  fields?: Array<{ id: string; name: string; label: string; type: string; options?: unknown }>;
  _count?: { records: number };
}

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.pabandi.com';

// One shared cache: DashboardLayout mounts on every CRM screen, and a fetch on
// each mount would add a request to every navigation.
let cached: { objects: CustomObject[]; at: number } | null = null;

export function useCustomObjects() {
  const [objects, setObjects] = useState<CustomObject[]>(cached?.objects ?? []);

  useEffect(() => {
    if (cached && Date.now() - cached.at < 30_000) {
      setObjects(cached.objects);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/api/v1/crm/builder/objects`, {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const next: CustomObject[] = body?.data || [];
        cached = { objects: next, at: Date.now() };
        if (!cancelled) setObjects(next);
      })
      .catch(() => { /* navigation simply omits custom objects while offline */ });
    return () => { cancelled = true; };
  }, []);

  return objects;
}

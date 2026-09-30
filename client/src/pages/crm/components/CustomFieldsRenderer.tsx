import React from 'react';
import { Input } from '../../../components/primitives';
import ClaySelect from './ClaySelect';

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  showInList?: boolean;
  options?: string[];
}

interface CustomFieldsRendererProps {
  fields: CustomField[];
  values: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  compact?: boolean;
}

export default function CustomFieldsRenderer({ fields, values, onChange, compact = false }: CustomFieldsRendererProps) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {fields.map(field => {
        const value = values[field.id] || '';

        if (field.type === 'boolean') {
          return (
            <label key={field.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={e => onChange(field.id, e.target.checked)}
                className="w-4 h-4 rounded border-[rgba(191,179,163,0.3)] text-[var(--clay)] focus:ring-[var(--clay)]/30"
              />
              <span className="text-sm text-[var(--warm-ink)]">{field.name}</span>
              {field.required && <span className="text-red-400">*</span>}
            </label>
          );
        }

        if (field.type === 'select' && field.options) {
          return (
            <ClaySelect
              key={field.id}
              label={field.name}
              value={String(value)}
              onChange={v => onChange(field.id, v)}
              options={field.options.map(o => ({ value: o, label: o }))}
            />
          );
        }

        return (
          <Input
            key={field.id}
            label={field.name}
            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            value={String(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(field.id, e.target.value)}
            required={field.required}
          />
        );
      })}
    </div>
  );
}

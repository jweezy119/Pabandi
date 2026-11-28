import { UserRole } from '@prisma/client';

/**
 * Field-level access for non-manager CRM users. Owners/admins keep full records;
 * everyone else loses contact details and money figures. This is deliberately
 * a small allowlist rather than a general policy engine — the dangerous default
 * is returning everything to a role that should not see it.
 */
const RESTRICTED: Record<string, string[]> = {
  client: ['email', 'phone', 'notes', 'customData'],
  deal: ['value', 'probability', 'notes', 'customData'],
  task: ['customData'],
};

export function canSeeAllFields(role?: string, isOwner?: boolean): boolean {
  return Boolean(isOwner) || role === UserRole.ADMIN || role === UserRole.BUSINESS_OWNER;
}

export function redactFields<T extends Record<string, any>>(
  role: string | undefined,
  isOwner: boolean | undefined,
  object: string,
  data: T,
): T {
  if (canSeeAllFields(role, isOwner) || !data || typeof data !== 'object') return data;
  const hidden = RESTRICTED[object] || [];
  if (hidden.length === 0) return data;
  const copy: Record<string, any> = { ...data };
  for (const field of hidden) delete copy[field];
  return copy as T;
}

import React, { useState } from 'react';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';

export function TeamMemberForm({ member, onUpdate, onRemove }: any) {
  const [role, setRole] = useState(member.role);

  return (
    <Card padding="lg" className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-[var(--warm-ink)]">Role & Access</h3>
          <p className="text-sm text-[var(--soft-stone)]">Manage what this user can do</p>
        </div>
      </div>

      <div className="space-y-2 max-w-sm">
        <label className="text-sm font-semibold text-[var(--warm-ink)]">Current Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)]"
        >
          <option value="VIEWER">Viewer (Read-only)</option>
          <option value="MEMBER">Member (Standard access)</option>
          <option value="ADMIN">Admin (Manage team & settings)</option>
          <option value="OWNER">Owner (Full access)</option>
        </select>
        {role !== member.role && (
          <div className="pt-2">
            <Button variant="primary" onClick={() => onUpdate({ role })}>Save Role</Button>
          </div>
        )}
      </div>

      <hr className="border-[var(--warm-sand)]/50" />

      <div>
        <h3 className="text-lg font-bold text-[var(--warm-ink)]">Status</h3>
        <p className="text-sm text-[var(--soft-stone)] mb-4">Deactivate or reactivate user</p>
        
        {member.isActive ? (
          <div className="bg-[var(--rose)]/10 border border-[var(--rose)] p-4 rounded-xl flex justify-between items-center">
            <div>
              <div className="font-semibold text-[var(--rose)]">Deactivate Member</div>
              <div className="text-sm text-[var(--rose)]/80">They will no longer be able to log in.</div>
            </div>
            <Button variant="danger" onClick={() => onRemove(member.id)}>Deactivate</Button>
          </div>
        ) : (
          <div className="bg-[var(--sage)]/10 border border-[var(--sage)] p-4 rounded-xl flex justify-between items-center">
            <div>
              <div className="font-semibold text-[var(--sage)]">Reactivate Member</div>
              <div className="text-sm text-[var(--sage)]/80">Restore their access to the system.</div>
            </div>
            <Button variant="primary" onClick={() => onUpdate({ isActive: true })}>Reactivate</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

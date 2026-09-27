import React from 'react';
import { Chip } from '../../../components/primitives/Chip';

export function TeamList({ members, onMemberClick }: { members: any[], onMemberClick: (id: string) => void }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-[var(--warm-sand)]">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead>
          <tr className="border-b border-[var(--warm-sand)] bg-[var(--warm-sand)]/20 text-[var(--soft-stone)]">
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Reliability</th>
            <th className="px-4 py-3 font-semibold">Delivery Score</th>
            <th className="px-4 py-3 font-semibold">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--warm-sand)]/50">
          {members.map((member) => (
            <tr key={member.id} onClick={() => onMemberClick(member.id)} className="hover:bg-[var(--warm-sand)]/10 cursor-pointer transition-colors">
              <td className="px-4 py-3">
                <div className="font-semibold text-[var(--warm-ink)]">{member.name}</div>
                <div className="text-xs text-[var(--soft-stone)]">{member.email}</div>
              </td>
              <td className="px-4 py-3">
                <Chip label={member.role} variant={member.role === 'OWNER' ? 'danger' : member.role === 'ADMIN' ? 'warning' : 'default'} size="sm" />
              </td>
              <td className="px-4 py-3">
                {member.isActive ? (
                  <Chip label={member.inviteStatus === 'PENDING' ? 'Pending Invite' : 'Active'} variant={member.inviteStatus === 'PENDING' ? 'warning' : 'success'} size="sm" />
                ) : (
                  <Chip label="Deactivated" variant="stone" size="sm" />
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-[var(--warm-sand)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--sage)]" style={{ width: `${member.reliabilityScore}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[var(--warm-ink)]">{member.reliabilityScore}%</span>
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-[var(--warm-ink)]">
                {member.deliveryScore}%
              </td>
              <td className="px-4 py-3 text-[var(--soft-stone)] text-xs">
                {new Date(member.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {members.length === 0 && (
        <div className="text-center py-12 text-[var(--soft-stone)]">
          No team members found.
        </div>
      )}
    </div>
  );
}

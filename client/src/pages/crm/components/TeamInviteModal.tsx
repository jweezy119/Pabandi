import React, { useState } from 'react';
import { Modal } from '../../../components/primitives/Modal';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';

export function TeamInviteModal({ isOpen, onClose, onInvite }: any) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'MEMBER'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInvite(formData);
    setFormData({ name: '', email: '', role: 'MEMBER' }); // Reset
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Jane Doe"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="e.g. jane@company.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
        
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--warm-ink)]">Role</label>
          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--warm-sand)] focus:outline-none focus:border-[var(--clay)] text-sm"
          >
            <option value="VIEWER">Viewer (Read-only)</option>
            <option value="MEMBER">Member (Standard access)</option>
            <option value="ADMIN">Admin (Manage team & settings)</option>
            <option value="OWNER">Owner (Full access)</option>
          </select>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit">Send Invite</Button>
        </div>
      </form>
    </Modal>
  );
}

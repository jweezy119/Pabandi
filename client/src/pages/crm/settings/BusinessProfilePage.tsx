import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Card } from '../../../components/primitives/Card';
import { Button } from '../../../components/primitives/Button';
import { Input } from '../../../components/primitives/Input';



const API_BASE = import.meta.env.VITE_API_URL || 'https://pabandi.onrender.com';
const getHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

export function BusinessProfilePage() {
  const businessId = localStorage.getItem('businessId') || '';
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) loadProfile();
  }, [businessId]);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/settings/profile?businessId=${businessId}`, { headers: getHeaders() });
      if (res.ok) setProfile(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/settings/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ businessId, data: profile })
      });
      alert('Profile saved!');
    } catch (err) {
      console.error(err);
      alert('Error saving profile');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <DashboardLayout osName="Contact OS" osIcon="C" osColor="clay" >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between clay-heading pb-2">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--warm-ink)' }}>Business Profile</h1>
            <p className="text-sm text-[var(--soft-stone)] mt-0.5">Core business details</p>
          </div>
          <Button variant="primary" onClick={saveProfile}>Save Changes</Button>
        </div>

        <Card padding="lg" className="space-y-4">
          <Input 
            label="Business Name" 
            value={profile.businessName || ''} 
            onChange={(e) => setProfile({ ...profile, businessName: e.target.value })} 
          />
          <Input 
            label="Owner Name" 
            value={profile.ownerName || ''} 
            onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })} 
          />
          <Input 
            label="Contact Email" 
            type="email"
            value={profile.ownerEmail || ''} 
            onChange={(e) => setProfile({ ...profile, ownerEmail: e.target.value })} 
          />
          <Input 
            label="Phone Number" 
            value={profile.phone || ''} 
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })} 
          />
          <Input 
            label="Address" 
            value={profile.address || ''} 
            onChange={(e) => setProfile({ ...profile, address: e.target.value })} 
          />
          <Input 
            label="Service Type / Vertical" 
            value={profile.serviceType || ''} 
            onChange={(e) => setProfile({ ...profile, serviceType: e.target.value })} 
          />
        </Card>
      </div>
    </DashboardLayout>
  );
}

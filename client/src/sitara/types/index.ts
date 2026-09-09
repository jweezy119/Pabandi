// Sitara OS — Types

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'consumer' | 'operator' | 'tenant' | 'admin';
  starPower: number;
  starTier: 'tara' | 'sitara-e-noor' | 'sitara-e-roshan' | 'sitara-e-darakshan' | 'sitara-e-izzat';
  verifiedCheckIns: number;
  reliabilityScore: number;
}

export interface Booking {
  id: string;
  businessId: string;
  businessName: string;
  businessType: 'restaurant' | 'salon' | 'spa' | 'nightlife' | 'apartment' | 'hotel';
  scheduledAt: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';
  depositAmount: number;
  depositHeld: boolean;
  reviewSubmitted: boolean;
  escrowTxId?: string;
}

export interface Unit {
  id: string;
  buildingId: string;
  buildingName: string;
  unitNumber: string;
  beds: number;
  baths: number;
  sqft: number;
  rentAmount: number;
  depositAmount: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  currentTenantId?: string;
  leaseStart?: string;
  leaseEnd?: string;
}

export interface Lease {
  id: string;
  tenantId: string;
  unitId: string;
  buildingId: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  depositAmount: number;
  status: 'draft' | 'active' | 'expiring' | 'expired' | 'terminated';
  documentUrl?: string;
}

export interface Tenant {
  id: string;
  userId: string;
  unitId?: string;
  leaseId?: string;
  screeningScore: number;
  reliabilityScore: number;
  status: 'applicant' | 'active' | 'former' | 'evicted';
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  unitId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'assigned' | 'in_progress' | 'completed';
  vendorId?: string;
  cost?: number;
  createdAt: string;
}

export interface Promo {
  id: string;
  businessId: string;
  title: string;
  description: string;
  discountPercent?: number;
  discountAmount?: number;
  validUntil: string;
  maxRedemptions?: number;
  currentRedemptions: number;
  status: 'draft' | 'active' | 'expired' | 'paused';
}

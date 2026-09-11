// Sitara OS — Central Store (Zustand)
// Manages user auth, app context, and star power state.
// Bookings persist on-device: a dead battery must never eat a reservation.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** Real platform reservation id, when booked against a real business. */
  reservationId?: string;
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

export interface SitaraState {
  user: User | null;
  bookings: Booking[];
  units: Unit[];
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  updateStarPower: (amount: number) => void;
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, updates: Partial<Unit>) => void;
}

const calculateTier = (starPower: number): User['starTier'] => {
  if (starPower >= 10000) return 'sitara-e-izzat';
  if (starPower >= 2000) return 'sitara-e-darakshan';
  if (starPower >= 500) return 'sitara-e-roshan';
  if (starPower >= 100) return 'sitara-e-noor';
  return 'tara';
};

export const useSitaraStore = create<SitaraState>()(
  persist(
    (set, get) => ({
  user: null,
  bookings: [],
  units: [],
  isLoading: false,

  setUser: (user) => set({ user }),
  
  updateStarPower: (amount) => {
    const { user } = get();
    if (!user) return;
    const newStarPower = user.starPower + amount;
    set({
      user: {
        ...user,
        starPower: newStarPower,
        starTier: calculateTier(newStarPower),
      },
    });
  },

  addBooking: (booking) => {
    set((state) => ({ bookings: [...state.bookings, booking] }));
  },

  updateBooking: (id, updates) => {
    set((state) => ({
      bookings: state.bookings.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    }));
  },

  addUnit: (unit) => {
    set((state) => ({ units: [...state.units, unit] }));
  },

  updateUnit: (id, updates) => {
    set((state) => ({
      units: state.units.map((u) =>
        u.id === id ? { ...u, ...updates } : u
      ),
    }));
  },
}),
    {
      name: 'sitara:bookings:v1',
      // Only bookings survive reloads. The session belongs to the auth
      // store; units live on the backend now.
      partialize: (s) => ({ bookings: s.bookings }),
    }
  )
);

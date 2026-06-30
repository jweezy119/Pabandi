import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, cryptoService } from '../services/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  profilePictureUrl?: string;
  reliabilityScore?: number;
}

interface WalletState {
  address: string | null;
  type: 'phantom' | 'metamask' | null;
  pabBalance: number;
  totalEarned: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  wallet: WalletState;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setAuth: (user: User, token: string) => void;
  connectWallet: (address: string, type: 'phantom' | 'metamask') => void;
  disconnectWallet: () => void;
  setPabBalance: (balance: number, totalEarned?: number) => void;
  fetchWalletData: () => Promise<void>;
  updateProfile: (updatedUser: Partial<User>) => void;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const defaultWallet: WalletState = {
  address: null,
  type: null,
  pabBalance: 0,
  totalEarned: 0,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      wallet: { ...defaultWallet },
      login: async (email: string, password: string) => {
        const response = await authService.login(email, password);
        const payload = response.data?.data ?? response.data; // support both shapes
        set({
          user: payload.user,
          token: payload.token,
          isAuthenticated: true,
        });
      },
      register: async (data: RegisterData) => {
        const response = await authService.register(data);
        const payload = response.data?.data ?? response.data; // support both shapes
        set({
          user: payload.user,
          token: payload.token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          wallet: { ...defaultWallet },
        });
      },
      setUser: (user: User) => set({ user }),
      setToken: (token: string) => set({ token, isAuthenticated: true }),
      setAuth: (user: User, token: string) =>
        set({ user, token, isAuthenticated: true }),
      connectWallet: (address: string, type: 'phantom' | 'metamask') =>
        set((state) => ({
          wallet: { ...state.wallet, address, type },
        })),
      disconnectWallet: () =>
        set((state) => ({
          wallet: { ...state.wallet, address: null, type: null },
        })),
      setPabBalance: (balance: number, totalEarned?: number) =>
        set((state) => ({
          wallet: {
            ...state.wallet,
            pabBalance: balance,
            ...(totalEarned !== undefined ? { totalEarned } : {}),
          },
        })),
      fetchWalletData: async () => {
        try {
          if (!get().isAuthenticated) return;
          const res = await cryptoService.getWallet();
          const data = res.data?.data ?? res.data;
          if (data?.wallet) {
            set((state) => ({
              wallet: {
                ...state.wallet,
                pabBalance: data.wallet.balance || 0,
                totalEarned: data.wallet.totalEarned || 0,
                address: data.wallet.solanaAddress || state.wallet.address,
                type: data.wallet.solanaAddress ? 'phantom' : state.wallet.type,
              },
            }));
          }
        } catch {
          // Wallet data fetch failed silently — non-critical
        }
      },
      updateProfile: (updatedUser: Partial<User>) => 
        set((state) => ({ user: state.user ? { ...state.user, ...updatedUser } : null })),
    }),
    {
      name: 'auth-storage',
    }
  )
);

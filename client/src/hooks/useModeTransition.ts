import { create } from 'zustand';

interface ModeTransitionState {
  isTransitioning: boolean;
  phase: 'idle' | 'obscuring' | 'revealing';
  startTransition: (callback: () => Promise<void> | void) => Promise<void>;
}

export const useModeTransition = create<ModeTransitionState>((set) => ({
  isTransitioning: false,
  phase: 'idle',
  startTransition: async (callback) => {
    set({ isTransitioning: true, phase: 'obscuring' });
    
    // Allow the canvas to obscure the screen
    await new Promise(r => setTimeout(r, 600)); 

    try {
      await callback();
    } finally {
      // DOM has switched, now evaporate
      set({ phase: 'revealing' });
      
      // Wait for evaporation
      await new Promise(r => setTimeout(r, 1200)); 
      
      set({ isTransitioning: false, phase: 'idle' });
    }
  }
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The account's business settings, persisted.
 *
 * THIS STORE MUST STAY PERSISTED
 * ------------------------------
 * `vertical` and `hasCompletedSetup` are what answer "has this account been
 * through setup?". As a plain store they reset to null/false on every page
 * load, and ContactOSPage redirected to /contact/setup on exactly that
 * condition — so every load of /contact, for an account that had already
 * enrolled, was sent to the setup wizard. Because the redirect was `replace`,
 * the requested URL was destroyed too, so Back landed on whatever came before:
 * usually the marketing homepage.
 *
 * DashboardLayout also gates the sidebar on `enabledFeatures`, so a reset store
 * silently disagreed with the menus about which features the account has.
 *
 * If persistence is ever removed, ContactOSPage must not fall back to reading
 * these flags on their own — see the comment there.
 */
interface BusinessSettings {
  vertical: string | null;
  enabledModules: string[];
  enabledFeatures: Record<string, string[]>;
  customFields: Record<string, any>;
  pipelineStages: any[];
  dashboardLayout: any[];
  hideAdvancedByDefault: boolean;
  hasCompletedSetup: boolean;
}

interface SettingsStore {
  settings: BusinessSettings;
  setSettings: (settings: BusinessSettings) => void;
  setVertical: (vertical: string) => void;
  toggleModule: (moduleId: string) => void;
  toggleFeature: (moduleId: string, featureId: string) => void;
  applyPreset: (vertical: string) => void;
  markSetupComplete: () => void;
}

export const VERTICAL_PRESETS: Record<string, {
  label: string;
  modules: string[];
  features: Record<string, string[]>;
  pipelineStages: string[];
}> = {
  salon: {
    label: 'Salon / Beauty',
    modules: ['contact', 'booking'],
    features: {
      contact: ['clients', 'invoices', 'activities', 'reliability'],
    },
    pipelineStages: ['Inquiry', 'Booked', 'Completed', 'Repeat VIP'],
  },
  consulting: {
    label: 'Consulting / Coaching',
    modules: ['contact', 'booking'],
    features: {
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks', 'reliability'],
    },
    pipelineStages: ['Lead', 'Discovery Call', 'Proposal', 'Active', 'Closed Won', 'Closed Lost'],
  },
  trades: {
    label: 'Trades / Contractors',
    modules: ['contact'],
    features: {
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'reliability'],
    },
    pipelineStages: ['Enquiry', 'Quote Sent', 'Job Scheduled', 'In Progress', 'Invoiced', 'Paid'],
  },
  real_estate: {
    label: 'Real Estate',
    modules: ['contact', 'property'],
    features: {
      // 'companies' removed: no Company model, no route, no page.
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks'],
    },
    pipelineStages: ['Prospect', 'Showing', 'Offer', 'Under Contract', 'Closed'],
  },
  logistics: {
    label: 'Logistics / Freight',
    modules: ['contact', 'freight'],
    features: {
      contact: ['clients', 'invoices', 'activities'],
    },
    pipelineStages: ['Quote', 'Accepted', 'In Transit', 'Delivered', 'Invoiced'],
  },
  general: {
    label: 'General Business',
    modules: ['contact'],
    features: {
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks', 'reliability'],
    },
    pipelineStages: ['Lead', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
  },
};

export const useBusinessSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: {
    vertical: null,
    enabledModules: ['contact'],
    enabledFeatures: {
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks', 'reliability'],
    },
    customFields: {},
    pipelineStages: [],
    dashboardLayout: [],
    hideAdvancedByDefault: true,
    hasCompletedSetup: false,
  },
  setSettings: (settings) => set({ settings }),
  setVertical: (vertical) => set((state) => ({
    settings: { ...state.settings, vertical },
  })),
  applyPreset: (vertical) => set((state) => {
    const preset = VERTICAL_PRESETS[vertical];
    if (!preset) return state;
    return {
      settings: {
        ...state.settings,
        vertical,
        enabledModules: preset.modules,
        enabledFeatures: preset.features,
        pipelineStages: preset.pipelineStages.map((name, i) => ({ id: `stage-${i}`, name, order: i })),
        hasCompletedSetup: false,
      },
    };
  }),
  markSetupComplete: () => set((state) => ({
    settings: { ...state.settings, hasCompletedSetup: true },
  })),
  toggleModule: (moduleId) => set((state) => {
    const modules = [...state.settings.enabledModules];
    const index = modules.indexOf(moduleId);
    if (index > -1) {
      modules.splice(index, 1);
    } else {
      modules.push(moduleId);
    }
    return { settings: { ...state.settings, enabledModules: modules } };
  }),
  toggleFeature: (moduleId, featureId) => set((state) => {
    const features = { ...state.settings.enabledFeatures };
    if (!features[moduleId]) {
      features[moduleId] = [];
    }
    const modFeatures = [...features[moduleId]];
    const index = modFeatures.indexOf(featureId);
    if (index > -1) {
      modFeatures.splice(index, 1);
    } else {
      modFeatures.push(featureId);
    }
    features[moduleId] = modFeatures;
    return { settings: { ...state.settings, enabledFeatures: features } };
  }),
}), { name: 'business-settings-storage' }));

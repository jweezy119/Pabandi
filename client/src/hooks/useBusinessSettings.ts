import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Which features each kind of business gets.
 *
 * WHY THESE CHANGED
 * The presets were missing the feature each vertical exists to use. A salon could
 * not book an appointment, because jobs were not enabled — and jobs are how a salon
 * delivers a service. Logistics had no jobs either, which is the one thing a
 * logistics business does; FreightOS lists them from /crm/jobs, so its primary
 * screen was gated off in the CRM that owns the data.
 *
 * Nothing announced this. FeatureGate silently redirects a disabled route to
 * /contact, and the sidebar filters the same list, so both agreed the feature did
 * not exist. There was no "deals are off for your business type" anywhere.
 *
 * The rule applied below: every preset keeps the core set — clients, deals,
 * invoices, activities — because those are true of any business. Anything that
 * delivers a booked service also gets jobs and tasks, because a job without a task
 * list is half a workflow. `reliability` stays where it was: it is a trust feature,
 * and a business that has not opted into reputation scoring should not have a
 * score shown about its customers.
 *
 * A preset should still be a choice. If someone genuinely does not want deals, the
 * Modules settings screen is where that is decided — not silently at signup.
 */
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
      // 'jobs' added: a booked appointment IS a job. Without it this preset gave a
      // salon owner no way to schedule the thing they sell, and /contact/jobs
      // redirected to /contact with no explanation.
      // 'team' added: /contact/team and /contact/team/:id are FeatureGate'd on it
      // and no preset enabled it, so the staff roster was unreachable for every
      // account — including the people jobs get assigned to.
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks', 'team', 'reliability'],
    },
    pipelineStages: ['Inquiry', 'Booked', 'Completed', 'Repeat VIP'],
  },
  consulting: {
    label: 'Consulting / Coaching',
    modules: ['contact', 'booking'],
    features: {
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks', 'team', 'reliability'],
    },
    pipelineStages: ['Lead', 'Discovery Call', 'Proposal', 'Active', 'Closed Won', 'Closed Lost'],
  },
  trades: {
    label: 'Trades / Contractors',
    modules: ['contact'],
    features: {
      // 'team' added: /contact/team and /contact/team/:id are FeatureGate'd on it
      // and no preset enabled it, so the staff roster was unreachable for every
      // account — including the people jobs get assigned to.
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks', 'team', 'reliability'],
    },
    pipelineStages: ['Enquiry', 'Quote Sent', 'Job Scheduled', 'In Progress', 'Invoiced', 'Paid'],
  },
  real_estate: {
    label: 'Real Estate',
    modules: ['contact', 'property'],
    features: {
      // 'companies' removed: no Company model, no route, no page.
      // 'jobs' added: a letting is a tracked unit with a tenant and a rent schedule.
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks', 'team'],
    },
    pipelineStages: ['Prospect', 'Showing', 'Offer', 'Under Contract', 'Closed'],
  },
  logistics: {
    label: 'Logistics / Freight',
    modules: ['contact', 'freight'],
    features: {
      // 'jobs' added, and it is not optional for this vertical: a logistics business
      // exists to move things, FreightOS lists them straight out of /crm/jobs, and
      // this preset had the feature switched off in the CRM that owns the records.
      // 'team' added: /contact/team and /contact/team/:id are FeatureGate'd on it
      // and no preset enabled it, so the staff roster was unreachable for every
      // account — including the people jobs get assigned to.
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks', 'team', 'reliability'],
    },
    pipelineStages: ['Quote', 'Accepted', 'In Transit', 'Delivered', 'Invoiced'],
  },
  general: {
    label: 'General Business',
    modules: ['contact'],
    features: {
      contact: ['clients', 'deals', 'invoices', 'activities', 'tasks', 'team', 'reliability'],
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
      // 'jobs' added. An account that has not run the wizard has no vertical, so it
      // gets the default — and the default had no jobs, so /contact/jobs bounced
      // anyone who had not been through setup.
      // 'team' added: /contact/team and /contact/team/:id are FeatureGate'd on it
      // and no preset enabled it, so the staff roster was unreachable for every
      // account — including the people jobs get assigned to.
      contact: ['clients', 'deals', 'invoices', 'jobs', 'activities', 'tasks', 'team', 'reliability'],
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

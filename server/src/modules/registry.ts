export interface ModuleDefinition {
  id: string;                    // "contact", "booking", "freight", "property", "ledger"
  name: string;                  // "ContactOS"
  description: string;
  icon: string;                  // icon name
  accentColor: string;           // for module switcher
  route: string;                 // "/contact"
  isDefault: boolean;            // enabled on new signups?
  verticals: string[];           // which business types this fits
  requiresModules?: string[];    // dependencies
  subFeatures: SubFeature[];
}

export interface SubFeature {
  id: string;                    // "jobs", "recurring", "deposits"
  name: string;
  description: string;
  defaultOn: boolean;            // for this vertical?
}

export const MODULES: ModuleDefinition[] = [
  {
    id: 'contact',
    name: 'ContactOS',
    description: 'Your CRM — track clients, deals, invoices',
    icon: 'contacts',
    accentColor: 'clay',
    route: '/contact',
    isDefault: true,
    verticals: ['all'],
    subFeatures: [
      { id: 'clients', name: 'Clients', description: 'Manage your customers', defaultOn: true },
      { id: 'deals', name: 'Deals', description: 'Track sales pipeline', defaultOn: true },
      { id: 'invoices', name: 'Invoices', description: 'Bill your clients', defaultOn: true },
      { id: 'activities', name: 'Activities', description: 'Log calls and notes', defaultOn: true },
      { id: 'tasks', name: 'Tasks', description: 'Manage to-dos', defaultOn: true },
      { id: 'companies', name: 'Companies', description: 'B2B Accounts', defaultOn: false },
      { id: 'jobs', name: 'Jobs & Scheduling', description: 'Service orders', defaultOn: false },
      { id: 'escrow', name: 'Escrow', description: 'Secure payments', defaultOn: false },
      { id: 'reliability', name: 'Reliability Reports', description: 'Trust scores', defaultOn: true },
    ],
  },
  {
    id: 'booking',
    name: 'BookingOS',
    description: 'Booking & discovery platform',
    icon: 'calendar_today',
    accentColor: 'sage',
    route: '/booking',
    isDefault: false,
    verticals: ['salon', 'consulting'],
    subFeatures: []
  },
  {
    id: 'freight',
    name: 'FreightOS',
    description: 'Freight & logistics platform',
    icon: 'local_shipping',
    accentColor: 'sky-wash',
    route: '/freight',
    isDefault: false,
    verticals: ['logistics'],
    subFeatures: []
  },
  {
    id: 'property',
    name: 'PropertyOS',
    description: 'Property management platform',
    icon: 'apartment',
    accentColor: 'ochre',
    route: '/property',
    isDefault: false,
    verticals: ['real_estate'],
    subFeatures: []
  },
  {
    id: 'ledger',
    name: 'LedgerOS',
    description: 'Finance & accounting',
    icon: 'account_balance',
    accentColor: 'dusty-rose',
    route: '/ledger',
    isDefault: false,
    verticals: ['all'],
    subFeatures: []
  }
];

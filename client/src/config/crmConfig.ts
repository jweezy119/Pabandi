// CRM Configuration — adapts terminology, tabs, and workflows based on business type.
// Any business can use this CRM: property management, sales, services, freelance, or general.

export type BusinessType = 'PROPERTY_MANAGEMENT' | 'SALES' | 'SERVICE' | 'FREELANCE' | 'GENERAL';

export interface EntityConfig {
  label: string;       // human-readable name (e.g. "Properties", "Clients", "Products")
  singular: string;    // singular form (e.g. "Property", "Client", "Product")
  icon: string;        // emoji icon
  tabId: string;       // tab identifier
  description: string; // short description for the tab
}

export interface BusinessTypeConfig {
  label: string;           // human-readable business type name
  description: string;     // what this business type is for
  icon: string;            // emoji icon
  // Which tabs are visible for this business type
  tabs: string[];
  // Entity configs for this business type
  entities: Record<string, EntityConfig>;
  // Default values for new records
  defaults: Record<string, string>;
  // Status options for key workflows
  statuses: Record<string, string[]>;
}

export const CRM_CONFIG: Record<BusinessType, BusinessTypeConfig> = {
  PROPERTY_MANAGEMENT: {
    label: '🏠 Property Management',
    description: 'Manage rental properties, tenants, leases, and maintenance',
    icon: '🏠',
    tabs: ['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'applications', 'portal', 'webhooks', 'activity'],
    entities: {
      properties: { label: 'Properties', singular: 'Property', icon: '🏘️', tabId: 'properties', description: 'Your rental portfolio' },
      tenants: { label: 'Tenants', singular: 'Tenant', icon: '👥', tabId: 'tenants', description: 'Tenant history & contacts' },
      screen: { label: 'Screening', singular: 'Screening', icon: '🔍', tabId: 'screen', description: 'Background & court checks' },
      appointments: { label: 'Showings', singular: 'Showing', icon: '📅', tabId: 'appointments', description: 'Property showings' },
      leases: { label: 'Leases', singular: 'Lease', icon: '📄', tabId: 'leases', description: 'Lease agreements' },
      maintenance: { label: 'Maintenance', singular: 'Request', icon: '🔧', tabId: 'maintenance', description: 'Maintenance requests' },
      applications: { label: 'Applications', singular: 'Application', icon: '📨', tabId: 'applications', description: 'Tenant applications' },
    },
    defaults: { tenantStatus: 'PROSPECT', propertyStatus: 'VACANT', leaseStatus: 'DRAFT' },
    statuses: { tenant: ['PROSPECT', 'APPLIED', 'APPROVED', 'ACTIVE', 'PAST', 'DENIED'], property: ['VACANT', 'OCCUPIED', 'MAINTENANCE'], lease: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  },
  SALES: {
    label: '💼 Sales',
    description: 'Manage products, clients, leads, meetings, and deals',
    icon: '💼',
    tabs: ['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'applications', 'portal', 'webhooks', 'activity'],
    entities: {
      properties: { label: 'Products', singular: 'Product', icon: '📦', tabId: 'properties', description: 'Your products or services' },
      tenants: { label: 'Clients', singular: 'Client', icon: '👥', tabId: 'tenants', description: 'Client contacts' },
      screen: { label: 'Vetting', singular: 'Check', icon: '🔍', tabId: 'screen', description: 'Client background checks' },
      appointments: { label: 'Meetings', singular: 'Meeting', icon: '📅', tabId: 'appointments', description: 'Client meetings' },
      leases: { label: 'Deals', singular: 'Deal', icon: '🤝', tabId: 'leases', description: 'Sales deals & contracts' },
      maintenance: { label: 'Tasks', singular: 'Task', icon: '✅', tabId: 'maintenance', description: 'Follow-ups & tasks' },
      applications: { label: 'Leads', singular: 'Lead', icon: '📨', tabId: 'applications', description: 'Incoming leads' },
    },
    defaults: { tenantStatus: 'PROSPECT', propertyStatus: 'VACANT', leaseStatus: 'DRAFT' },
    statuses: { tenant: ['PROSPECT', 'APPLIED', 'APPROVED', 'ACTIVE', 'PAST', 'DENIED'], property: ['VACANT', 'OCCUPIED', 'MAINTENANCE'], lease: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  },
  SERVICE: {
    label: '🔧 Service Business',
    description: 'Manage services, customers, appointments, and service tickets',
    icon: '🔧',
    tabs: ['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'applications', 'portal', 'webhooks', 'activity'],
    entities: {
      properties: { label: 'Services', singular: 'Service', icon: '⚙️', tabId: 'properties', description: 'Your service offerings' },
      tenants: { label: 'Customers', singular: 'Customer', icon: '👥', tabId: 'tenants', description: 'Customer contacts' },
      screen: { label: 'Vetting', singular: 'Check', icon: '🔍', tabId: 'screen', description: 'Customer verification' },
      appointments: { label: 'Appointments', singular: 'Appointment', icon: '📅', tabId: 'appointments', description: 'Booked appointments' },
      leases: { label: 'Contracts', singular: 'Contract', icon: '📄', tabId: 'leases', description: 'Service contracts' },
      maintenance: { label: 'Tickets', singular: 'Ticket', icon: '🎫', tabId: 'maintenance', description: 'Service tickets' },
      applications: { label: 'Inquiries', singular: 'Inquiry', icon: '📨', tabId: 'applications', description: 'Customer inquiries' },
    },
    defaults: { tenantStatus: 'PROSPECT', propertyStatus: 'VACANT', leaseStatus: 'DRAFT' },
    statuses: { tenant: ['PROSPECT', 'APPLIED', 'APPROVED', 'ACTIVE', 'PAST', 'DENIED'], property: ['VACANT', 'OCCUPIED', 'MAINTENANCE'], lease: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  },
  FREELANCE: {
    label: '💻 Freelance',
    description: 'Manage gigs, clients, proposals, contracts, and deliverables',
    icon: '💻',
    tabs: ['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'applications', 'portal', 'webhooks', 'activity'],
    entities: {
      properties: { label: 'Gigs', singular: 'Gig', icon: '💼', tabId: 'properties', description: 'Your gigs or projects' },
      tenants: { label: 'Clients', singular: 'Client', icon: '👥', tabId: 'tenants', description: 'Client contacts' },
      screen: { label: 'Vetting', singular: 'Check', icon: '🔍', tabId: 'screen', description: 'Client verification' },
      appointments: { label: 'Calls', singular: 'Call', icon: '📅', tabId: 'appointments', description: 'Client calls & meetings' },
      leases: { label: 'Contracts', singular: 'Contract', icon: '📄', tabId: 'leases', description: 'Freelance contracts' },
      maintenance: { label: 'Deliverables', singular: 'Deliverable', icon: '📦', tabId: 'maintenance', description: 'Project deliverables' },
      applications: { label: 'Proposals', singular: 'Proposal', icon: '📨', tabId: 'applications', description: 'Sent proposals' },
    },
    defaults: { tenantStatus: 'PROSPECT', propertyStatus: 'VACANT', leaseStatus: 'DRAFT' },
    statuses: { tenant: ['PROSPECT', 'APPLIED', 'APPROVED', 'ACTIVE', 'PAST', 'DENIED'], property: ['VACANT', 'OCCUPIED', 'MAINTENANCE'], lease: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  },
  GENERAL: {
    label: '📋 General Business',
    description: 'Manage items, contacts, interactions, and agreements',
    icon: '📋',
    tabs: ['overview', 'properties', 'tenants', 'screen', 'appointments', 'leases', 'maintenance', 'applications', 'portal', 'webhooks', 'activity'],
    entities: {
      properties: { label: 'Items', singular: 'Item', icon: '📦', tabId: 'properties', description: 'Your items or offerings' },
      tenants: { label: 'Contacts', singular: 'Contact', icon: '👥', tabId: 'tenants', description: 'Business contacts' },
      screen: { label: 'Checks', singular: 'Check', icon: '🔍', tabId: 'screen', description: 'Background checks' },
      appointments: { label: 'Meetings', singular: 'Meeting', icon: '📅', tabId: 'appointments', description: 'Scheduled meetings' },
      leases: { label: 'Agreements', singular: 'Agreement', icon: '📄', tabId: 'leases', description: 'Contracts & agreements' },
      maintenance: { label: 'Tasks', singular: 'Task', icon: '✅', tabId: 'maintenance', description: 'Tasks & to-dos' },
      applications: { label: 'Inquiries', singular: 'Inquiry', icon: '📨', tabId: 'applications', description: 'Incoming inquiries' },
    },
    defaults: { tenantStatus: 'PROSPECT', propertyStatus: 'VACANT', leaseStatus: 'DRAFT' },
    statuses: { tenant: ['PROSPECT', 'APPLIED', 'APPROVED', 'ACTIVE', 'PAST', 'DENIED'], property: ['VACANT', 'OCCUPIED', 'MAINTENANCE'], lease: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'] },
  },
};

// Business type options for enrollment
export const BUSINESS_TYPES: { value: BusinessType; label: string; description: string }[] = [
  { value: 'PROPERTY_MANAGEMENT', label: '🏠 Property Management', description: 'Rentals, tenants, leases, maintenance' },
  { value: 'SALES', label: '💼 Sales', description: 'Products, clients, leads, deals' },
  { value: 'SERVICE', label: '🔧 Service Business', description: 'Services, customers, appointments, tickets' },
  { value: 'FREELANCE', label: '💻 Freelance', description: 'Gigs, clients, proposals, contracts' },
  { value: 'GENERAL', label: '📋 General Business', description: 'Items, contacts, interactions, agreements' },
];

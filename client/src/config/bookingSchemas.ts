export interface BookingSchema {
  showPartySize: boolean;
  partySizeLabel?: string;
  showSpecialRequests: boolean;
  specialRequestsLabel?: string;
  specialRequestsPlaceholder?: string;
  showServiceAddress: boolean;
  serviceAddressLabel?: string;
  serviceAddressPlaceholder?: string;
  showProjectDescription: boolean;
  projectDescriptionLabel?: string;
  projectDescriptionPlaceholder?: string;
  showContractAmount: boolean;
  contractAmountLabel?: string;
  contractAmountPlaceholder?: string;
  showLienDossier: boolean;
  heroEmoji?: string;
  bookingSummaryLabel?: string;
}

export type VerticalType = 'RESTAURANT' | 'SERVICE_BUSINESS' | 'SOLO_BUILDER';

export const BOOKING_SCHEMAS: Record<VerticalType, BookingSchema> = {
  RESTAURANT: {
    showPartySize: true,
    partySizeLabel: 'Number of Guests',
    showSpecialRequests: true,
    specialRequestsLabel: 'Special Requests & Seating Preferences',
    specialRequestsPlaceholder: 'Allergies, celebrations, seating preferences...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '🍽️',
    bookingSummaryLabel: 'Dining Reservation',
  },
  SERVICE_BUSINESS: {
    showPartySize: false,
    showSpecialRequests: true, // "Access Notes"
    specialRequestsLabel: 'Site Access & Entry Notes',
    specialRequestsPlaceholder: 'Gate code, parking instructions, pet on premises, etc.',
    showServiceAddress: true,
    serviceAddressLabel: 'Service / Job Site Address',
    serviceAddressPlaceholder: 'e.g. 123 Main St, Karachi or job site location',
    showProjectDescription: true,
    projectDescriptionLabel: 'What needs fixing? (Project Scope)',
    projectDescriptionPlaceholder: 'e.g. Roof inspection, pipe replacement, AC unit repair',
    showContractAmount: true,
    contractAmountLabel: 'Contract / Estimate Quote (USD / USDC)',
    contractAmountPlaceholder: 'e.g. 1500',
    showLienDossier: true,
    heroEmoji: '🔨',
    bookingSummaryLabel: 'Service Contract',
  },
  SOLO_BUILDER: {
    showPartySize: false,
    showSpecialRequests: false,
    showServiceAddress: false,
    showProjectDescription: true,
    projectDescriptionLabel: 'Project Scope & Deliverables',
    projectDescriptionPlaceholder: 'e.g. Full-stack React app, Smart contract audit, UI overhaul',
    showContractAmount: true,
    contractAmountLabel: 'Milestone / Invoice Amount (USD / USDC)',
    contractAmountPlaceholder: 'e.g. 500',
    showLienDossier: false,
    heroEmoji: '💻',
    bookingSummaryLabel: 'Freelance Milestone',
  },
};

/**
 * Resolves the dynamic schema from a business's category or vertical.
 */
export function getBookingSchema(categoryOrVertical?: string | null): BookingSchema {
  if (!categoryOrVertical) return BOOKING_SCHEMAS.RESTAURANT;

  const normalized = categoryOrVertical.trim().toUpperCase().replace(/[\s-]+/g, '_');

  // Service Businesses (Trades, Home Services, Maintenance)
  if (
    [
      'SERVICE_BUSINESS',
      'ROOFING',
      'HVAC',
      'PLUMBING',
      'ELECTRICIAN',
      'CONTRACTOR',
      'CLEANING',
      'HOME_SERVICE',
      'CONSTRUCTION',
      'MAINTENANCE',
      'AUTOMOTIVE',
      'MECHANIC',
      'PEST_CONTROL',
      'PAINTING',
      'LANDSCAPING',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.SERVICE_BUSINESS;
  }

  // Solo Builders (Freelancers, Developers, Tech, Consulting)
  if (
    [
      'SOLO_BUILDER',
      'FREELANCE',
      'FREELANCER',
      'DEVELOPER',
      'CONSULTANT',
      'CONSULTING',
      'DESIGNER',
      'MARKETING',
      'LEGAL',
      'AI_AGENT',
      'WRITER',
      'CREATIVE',
      'TRANSLATOR',
      'AUDITOR',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.SOLO_BUILDER;
  }

  // Default: Dining, Hospitality & Appointments
  return BOOKING_SCHEMAS.RESTAURANT;
}

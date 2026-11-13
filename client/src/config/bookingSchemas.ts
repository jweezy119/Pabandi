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
  buttonText?: string;
}

export type VerticalType =
  | 'RESTAURANT'
  | 'SALON'
  | 'SPA'
  | 'CLINIC'
  | 'FITNESS'
  | 'SERVICE_BUSINESS'
  | 'SOLO_BUILDER';

export const BOOKING_SCHEMAS: Record<VerticalType, BookingSchema> = {
  RESTAURANT: {
    showPartySize: true,
    partySizeLabel: 'Number of Guests',
    showSpecialRequests: true,
    specialRequestsLabel: 'Special Requests & Seating Preferences',
    specialRequestsPlaceholder: 'Allergies, celebrations, booth vs outdoor seating...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '🍽️',
    bookingSummaryLabel: 'Dining Reservation',
    buttonText: 'Reserve Table',
  },
  SALON: {
    showPartySize: false,
    partySizeLabel: 'Number of Clients',
    showSpecialRequests: true,
    specialRequestsLabel: 'Styling & Preference Notes',
    specialRequestsPlaceholder: 'Stylist preference, hair/skin type, inspiration links...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '✂️',
    bookingSummaryLabel: 'Salon Appointment',
    buttonText: 'Book Salon Appointment',
  },
  SPA: {
    showPartySize: false,
    partySizeLabel: 'Number of Guests',
    showSpecialRequests: true,
    specialRequestsLabel: 'Health & Treatment Preferences',
    specialRequestsPlaceholder: 'Pressure preference, skin sensitivities, injuries, pregnancy...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '💆‍♀️',
    bookingSummaryLabel: 'Spa & Wellness Treatment',
    buttonText: 'Reserve Spa Session',
  },
  CLINIC: {
    showPartySize: false,
    partySizeLabel: 'Number of Patients',
    showSpecialRequests: true,
    specialRequestsLabel: 'Reason for Visit / Symptoms',
    specialRequestsPlaceholder: 'Brief description of symptoms, routine checkup, or consultation goals...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '🩺',
    bookingSummaryLabel: 'Clinical Consultation',
    buttonText: 'Book Consultation',
  },
  FITNESS: {
    showPartySize: false,
    partySizeLabel: 'Participants',
    showSpecialRequests: true,
    specialRequestsLabel: 'Fitness Goals & Notes',
    specialRequestsPlaceholder: 'Strength training, cardio, injuries or physical limitations...',
    showServiceAddress: false,
    showProjectDescription: false,
    showContractAmount: false,
    showLienDossier: false,
    heroEmoji: '🏋️',
    bookingSummaryLabel: 'Training Session',
    buttonText: 'Book Training Session',
  },
  SERVICE_BUSINESS: {
    showPartySize: false,
    showSpecialRequests: true,
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
    buttonText: 'Secure Booking & Escrow',
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
    buttonText: 'Fund Milestone Escrow',
  },
};

/**
 * Resolves the dynamic schema from a business's category or vertical.
 */
export function getBookingSchema(categoryOrVertical?: string | null): BookingSchema {
  if (!categoryOrVertical) return BOOKING_SCHEMAS.RESTAURANT;

  const normalized = categoryOrVertical.trim().toUpperCase().replace(/[\s-]+/g, '_');

  // Spas, Massages & Wellness
  if (
    [
      'SPA',
      'MASSAGE',
      'WELLNESS',
      'SKINCARE',
      'FACIAL',
      'SAUNA',
      'AROMATHERAPY',
      'HAMMAM',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.SPA;
  }

  // Salons, Barbershops & Beauty
  if (
    [
      'SALON',
      'HAIR_SALON',
      'BARBER',
      'BARBERSHOP',
      'BEAUTY_SALON',
      'NAILS',
      'NAIL_SALON',
      'MAKEUP',
      'ESTHETICIAN',
      'HAIRSTYLIST',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.SALON;
  }

  // Healthcare, Clinics & Medical
  if (
    [
      'CLINIC',
      'HOSPITAL',
      'DENTAL',
      'DENTIST',
      'PHYSIOTHERAPY',
      'CHIROPRACTIC',
      'THERAPY',
      'PSYCHOLOGY',
      'DOCTOR',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.CLINIC;
  }

  // Fitness, Gyms & Studios
  if (
    [
      'FITNESS_CENTER',
      'FITNESS',
      'GYM',
      'YOGA',
      'PILATES',
      'PERSONAL_TRAINER',
      'CROSSFIT',
      'MARTIAL_ARTS',
    ].includes(normalized)
  ) {
    return BOOKING_SCHEMAS.FITNESS;
  }

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

  // Default: Dining, Restaurants & Hospitality
  return BOOKING_SCHEMAS.RESTAURANT;
}

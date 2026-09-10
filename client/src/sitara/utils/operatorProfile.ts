// Sitara OS — operator profile by business type
// One operator shell, vocabulary + nav + dashboard keyed off the real
// Business.category from the backend — a salon never sees "Units" and
// a landlord never sees "Appointments".

export interface OperatorNavItem {
  path: string;
  label: string;
  icon: string;
}

export interface OperatorProfile {
  key: string;
  /** Sidebar subtitle, e.g. "Restaurant Dashboard" */
  title: string;
  /** Singular booking noun: Reservation | Appointment | Booking | Stay */
  bookingNoun: string;
  bookingNounPlural: string;
  /** Who books: Guest | Client | Tenant */
  clientNoun: string;
  clientNounPlural: string;
  nav: OperatorNavItem[];
  /** Show the rental (units/tenants/leases) dashboard instead of bookings. */
  rentalStyle: boolean;
}

const SERVICE_NAV: OperatorNavItem[] = [
  { path: '/sitara/operator', label: 'Dashboard', icon: '📊' },
  { path: '/sitara/operator/reservations', label: 'Reservations', icon: '📅' },
  { path: '/sitara/operator/customers', label: 'Customers', icon: '💛' },
  { path: '/sitara/operator/reviews', label: 'Reviews', icon: '⭐' },
  { path: '/sitara/operator/promos', label: 'Promos', icon: '🎁' },
  { path: '/sitara/operator/star-finder', label: 'Star Finder', icon: '✨' },
];

const DINING: OperatorProfile = {
  key: 'dining',
  title: 'Restaurant Dashboard',
  bookingNoun: 'Reservation',
  bookingNounPlural: 'Reservations',
  clientNoun: 'Guest',
  clientNounPlural: 'Guests',
  rentalStyle: false,
  nav: [
    { path: '/sitara/operator', label: 'Dashboard', icon: '📊' },
    { path: '/sitara/operator/reservations', label: 'Reservations', icon: '🍽️' },
    { path: '/sitara/operator/customers', label: 'Guests', icon: '💛' },
    { path: '/sitara/operator/reviews', label: 'Reviews', icon: '⭐' },
    { path: '/sitara/operator/promos', label: 'Promos', icon: '🎁' },
    { path: '/sitara/operator/star-finder', label: 'Star Finder', icon: '✨' },
  ],
};

const SERVICE: OperatorProfile = {
  key: 'service',
  title: 'Business Dashboard',
  bookingNoun: 'Appointment',
  bookingNounPlural: 'Appointments',
  clientNoun: 'Client',
  clientNounPlural: 'Clients',
  rentalStyle: false,
  nav: SERVICE_NAV.map((n) =>
    n.path.endsWith('/reservations') ? { ...n, label: 'Appointments', icon: '💈' } : n
  ),
};

const STAY: OperatorProfile = {
  key: 'stay',
  title: 'Hotel Dashboard',
  bookingNoun: 'Booking',
  bookingNounPlural: 'Bookings',
  clientNoun: 'Guest',
  clientNounPlural: 'Guests',
  rentalStyle: false,
  nav: SERVICE_NAV,
};

const VENUE: OperatorProfile = {
  key: 'venue',
  title: 'Venue Dashboard',
  bookingNoun: 'Event booking',
  bookingNounPlural: 'Event bookings',
  clientNoun: 'Client',
  clientNounPlural: 'Clients',
  rentalStyle: false,
  nav: SERVICE_NAV,
};

const RENTAL: OperatorProfile = {
  key: 'rental',
  title: 'Property Dashboard',
  bookingNoun: 'Viewing',
  bookingNounPlural: 'Viewings',
  clientNoun: 'Tenant',
  clientNounPlural: 'Tenants',
  rentalStyle: true,
  nav: [
    { path: '/sitara/operator', label: 'Dashboard', icon: '📊' },
    { path: '/sitara/operator/units', label: 'Units', icon: '🏢' },
    { path: '/sitara/operator/tenants', label: 'Tenants', icon: '👥' },
    { path: '/sitara/operator/leases', label: 'Leases', icon: '📄' },
    { path: '/sitara/operator/reservations', label: 'Viewings', icon: '📅' },
    { path: '/sitara/operator/promos', label: 'Promos', icon: '🎁' },
    { path: '/sitara/operator/star-finder', label: 'Star Finder', icon: '✨' },
    { path: '/sitara/operator/customers', label: 'Customers', icon: '💛' },
  ],
};

const COMMERCE: OperatorProfile = {
  key: 'commerce',
  title: 'Business Dashboard',
  bookingNoun: 'Booking',
  bookingNounPlural: 'Bookings',
  clientNoun: 'Customer',
  clientNounPlural: 'Customers',
  rentalStyle: false,
  nav: SERVICE_NAV,
};

/** Map a backend BusinessCategory (or discovery slug) to an operator profile. */
export function profileForCategory(category?: string | null): OperatorProfile {
  const c = (category || '').toUpperCase();
  switch (c) {
    case 'RESTAURANT':
    case 'NIGHTLIFE':
      return DINING;
    case 'SALON':
    case 'SPA':
    case 'CLINIC':
    case 'FITNESS_CENTER':
    case 'HOSPITAL':
      return { ...SERVICE, title: c === 'SALON' ? 'Salon Dashboard' : c === 'SPA' ? 'Spa Dashboard' : c === 'FITNESS_CENTER' ? 'Studio Dashboard' : 'Clinic Dashboard' };
    case 'HOTEL':
    case 'APARTMENT':
      return STAY;
    case 'PROPERTY_RENTAL':
      return RENTAL;
    case 'EVENT_VENUE':
      return VENUE;
    default:
      return COMMERCE;
  }
}

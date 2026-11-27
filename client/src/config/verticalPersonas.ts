import { useBusinessSettings } from '../hooks/useBusinessSettings';

export type VerticalId =
  | 'auto_repair'
  | 'salon'
  | 'trades'
  | 'cleaning'
  | 'consulting'
  | 'real_estate'
  | 'wellness'
  | 'general';

export interface StarterServiceTemplate {
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  locationType: 'on-site' | 'in-home' | 'remote' | 'both';
}

export interface OutreachTemplate {
  id: 'reminder' | 'deposit' | 'thank_you' | 'checkin';
  label: string;
  emoji: string;
  subject: string;
  body: string;
}

export interface ChecklistCopy {
  clients: { title: string; detail: string; cta: string };
  jobs: { title: string; detail: string; cta: string };
  sentInvoices: { title: string; detail: string; cta: string };
  deals: { title: string; detail: string; cta: string };
  openTasks: { title: string; detail: string; cta: string };
}

export interface VerticalPersona {
  id: VerticalId;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
  exampleBusiness: string;
  accentColor: string;
  bgLight: string;
  highlights: string[];
  navLabels: {
    clients: string;
    deals: string;
    jobs: string;
    activities: string;
    tasks: string;
    invoices: string;
    team: string;
  };
  singular: {
    client: string;
    deal: string;
    job: string;
    member: string;
  };
  dashboardGreeting: string;
  quickActions: {
    addClient: string;
    scheduleWork: string;
    sendInvoice: string;
  };
  notePlaceholder: string;
  checklist: ChecklistCopy;
  starterServices: StarterServiceTemplate[];
  outreachTemplates: OutreachTemplate[];
}

export const VERTICAL_PERSONAS: Record<VerticalId, VerticalPersona> = {
  auto_repair: {
    id: 'auto_repair',
    label: 'Auto Repair & Mechanic Shop',
    shortLabel: 'Auto Repair',
    emoji: '🔧',
    description: 'Independent auto repair shops, brake & tire centers, diagnostics, and mobile mechanics',
    exampleBusiness: 'Precision Auto Care (Chicago)',
    accentColor: '#E08A63',
    bgLight: '#FDF2EC',
    highlights: [
      'VIN decoding & vehicle service history',
      'Digital Vehicle Inspection (DVI) photos',
      'AI Fair-Price Verified estimates',
      '1-tap SMS Magic Link deposit approval',
    ],
    navLabels: {
      clients: 'Vehicle Owners',
      deals: 'Estimates',
      jobs: 'Repair Orders',
      activities: 'Shop Log & SMS',
      tasks: 'Bay Follow-ups',
      invoices: 'Escrow & Deposits',
      team: 'Technicians & Bays',
    },
    singular: { client: 'vehicle owner', deal: 'estimate', job: 'repair order', member: 'technician' },
    dashboardGreeting: 'Your bays, VIN-decoded repair orders, fair-price estimates, and protected deposits — all in one place.',
    quickActions: {
      addClient: 'Add Vehicle Owner',
      scheduleWork: 'New Repair Order',
      sendInvoice: 'Send SMS Approval Link',
    },
    notePlaceholder: 'Log OBD-II codes, technician findings, parts ETA, or customer call notes...',
    checklist: {
      clients: { title: 'Add your first vehicle owner', detail: 'Save a customer with their VIN so every repair order tracks mileage and history.', cta: 'Add Vehicle Owner' },
      jobs: { title: 'Open a repair order', detail: 'Check a vehicle into a bay, snap DVI photos, and track progress.', cta: 'New Repair Order' },
      sentInvoices: { title: 'Send an SMS Magic Link estimate', detail: 'Let the car owner review DVI photos and approve the deposit in 1 tap.', cta: 'Send Approval Link' },
      deals: { title: 'Create a Fair-Price Verified estimate', detail: 'Itemize parts & labor — Pabandi stamps fair quotes automatically.', cta: 'New Estimate' },
      openTasks: { title: 'Set a parts or pickup reminder', detail: 'Keep bays moving and notify customers before pickup.', cta: 'Add Follow-up' },
    },
    starterServices: [
      { name: 'Brake Pad & Rotor Service', description: 'Front or rear pad & rotor replacement with DVI before/after photo proof.', price: 380, duration: 90, category: 'auto_repair', locationType: 'on-site' },
      { name: 'Check Engine OBD-II Diagnostic', description: 'Full computer scan, live sensor check, and plain-English inspection report.', price: 115, duration: 60, category: 'auto_repair', locationType: 'on-site' },
      { name: 'Full Synthetic Oil & Multi-Point DVI', description: 'Up to 5 qts full synthetic oil, OEM filter, fluid top-off, and 25-point photo inspection.', price: 95, duration: 45, category: 'auto_repair', locationType: 'on-site' },
      { name: 'Alternator & Battery Replacement', description: 'Charging system load test and OEM-grade replacement with warranty.', price: 420, duration: 120, category: 'auto_repair', locationType: 'on-site' },
      { name: 'A/C Evacuation & Recharge', description: 'Leak dye test, vacuum check, and R-134a / R-1234yf recharge.', price: 185, duration: 75, category: 'auto_repair', locationType: 'on-site' },
    ],
    outreachTemplates: [
      {
        id: 'deposit',
        label: 'SMS Estimate & Deposit Magic Link',
        emoji: '🔧',
        subject: 'Your Fair-Price Verified estimate from {businessName}',
        body: "Hi {clientName}, {businessName} finished inspecting your vehicle. Tap your secure Pabandi Magic Link to view inspection photos, see our Fair-Price Verified estimate, and approve your deposit via Apple Pay or Card (held safely in escrow until pickup).",
      },
      {
        id: 'reminder',
        label: 'Bay Drop-Off Reminder (SMS)',
        emoji: '🚗',
        subject: 'Reminder: Your service bay at {businessName} tomorrow',
        body: "Hi {clientName}, friendly reminder that your bay is reserved at {businessName} tomorrow. Reply 'Y' to confirm drop-off or tap your Magic Link if you need to reschedule.",
      },
      {
        id: 'thank_you',
        label: 'Vehicle Ready for Pickup (SMS)',
        emoji: '✅',
        subject: 'Your vehicle is ready at {businessName}!',
        body: "Great news {clientName} — your vehicle is ready for pickup at {businessName}! View your Before & After proof photos and complete checkout on your Pabandi Magic Link.",
      },
      {
        id: 'checkin',
        label: '30-Day Service Check-In',
        emoji: '🛡️',
        subject: 'How is your car running? — {businessName}',
        body: "Hey {clientName}, checking in from {businessName} to make sure your vehicle is running smoothly after your recent repair. Everything stays logged on your Pabandi Vehicle Passport!",
      },
    ],
  },
  salon: {
    id: 'salon',
    label: 'Salon & Beauty',
    shortLabel: 'Salon',
    emoji: '💅',
    description: 'Hair stylists, barbers, nail studios, and spas',
    exampleBusiness: 'Glow Beauty Studio',
    accentColor: '#D4A5A5',
    bgLight: '#FDF0EF',
    highlights: ['Guest profiles & style notes', 'Appointments & rebooking', 'No-show protection', 'Stylist roster'],
    navLabels: {
      clients: 'Guests',
      deals: 'Bookings',
      jobs: 'Appointments',
      activities: 'Notes & Calls',
      tasks: 'Follow-ups',
      invoices: 'Deposits & Payments',
      team: 'Stylists',
    },
    singular: { client: 'guest', deal: 'booking', job: 'appointment', member: 'stylist' },
    dashboardGreeting: 'Your chair schedule, regulars, and protected deposits — all in one calm place.',
    quickActions: {
      addClient: 'Add Guest',
      scheduleWork: 'Book Appointment',
      sendInvoice: 'Send Deposit Link',
    },
    notePlaceholder: 'Favorite stylist, color formula, sensitivities, coffee order...',
    checklist: {
      clients: {
        title: 'Add your first regular guest',
        detail: 'Keep their style notes, preferences, and visit history right at your fingertips.',
        cta: 'Add a guest',
      },
      jobs: {
        title: 'Book your first appointment',
        detail: 'Completed appointments build each guest’s reliability score automatically.',
        cta: 'Book appointment',
      },
      sentInvoices: {
        title: 'Send a deposit or receipt',
        detail: 'Protect your chair time from last-minute no-shows with a quick payment link.',
        cta: 'Create payment link',
      },
      deals: {
        title: 'Log a bridal or package inquiry',
        detail: 'Keep track of group bookings or custom packages before they lock in.',
        cta: 'Add booking inquiry',
      },
      openTasks: {
        title: 'Add a quick follow-up',
        detail: 'Remind yourself to check in for a 6-week touch-up or order color stock.',
        cta: 'Add follow-up',
      },
    },
    starterServices: [
      { name: 'Signature Haircut & Blowout', description: 'Wash, tailored cut, and smooth blowout finish.', price: 65, duration: 60, category: 'hair', locationType: 'on-site' },
      { name: 'Full Color & Gloss', description: 'Custom color refresh with conditioning gloss treatment.', price: 145, duration: 120, category: 'hair', locationType: 'on-site' },
      { name: 'Gel Manicure', description: 'Cuticle care, shaping, and long-wear gel polish.', price: 45, duration: 45, category: 'nails', locationType: 'on-site' },
      { name: 'Express Glow Facial', description: 'Gentle cleanse, exfoliation, and hydrating mask.', price: 85, duration: 45, category: 'facial', locationType: 'on-site' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Tomorrow Reminder',
        emoji: '📅',
        subject: 'Quick reminder for tomorrow at {businessName}',
        body: "Hi {clientName}, just a quick reminder about your appointment at {businessName} tomorrow. Reply 'Y' to confirm or let us know if you need to reschedule!",
      },
      {
        id: 'deposit',
        label: 'Friendly Deposit Note',
        emoji: '💛',
        subject: 'Holding your spot at {businessName}',
        body: "Hey {clientName}! We've got your spot penciled in at {businessName}. Whenever you have a second, go ahead and tap the quick deposit link to lock it in — it stays protected until your visit!",
      },
      {
        id: 'thank_you',
        label: 'Thank You & Rebook',
        emoji: '✨',
        subject: 'So great seeing you at {businessName}!',
        body: "So great seeing you today, {clientName}! Hope you're loving how everything turned out. Whenever you're ready for your next visit at {businessName}, just text us back right here.",
      },
      {
        id: 'checkin',
        label: '6-Week Touch-Up',
        emoji: '👋',
        subject: 'Checking in from {businessName}',
        body: "Hey {clientName}, hope your week's going great! Just checking in from {businessName} — let us know if you want to grab a spot on the calendar soon before the weekend fills up.",
      },
    ],
  },

  trades: {
    id: 'trades',
    label: 'Trades & Home Repair',
    shortLabel: 'Trades',
    emoji: '🔧',
    description: 'Plumbers, electricians, HVAC, handyman & contractors',
    exampleBusiness: 'Bright Spark Electric',
    accentColor: '#C97B5A',
    bgLight: '#FDF5F1',
    highlights: ['Homeowner details & access notes', 'Quotes & estimates', 'Jobs & crew dispatch', 'Protected job deposits'],
    navLabels: {
      clients: 'Customers',
      deals: 'Quotes & Estimates',
      jobs: 'Jobs & Dispatch',
      activities: 'Site Notes',
      tasks: 'To-Dos',
      invoices: 'Deposits & Invoices',
      team: 'Crew',
    },
    singular: { client: 'customer', deal: 'quote', job: 'job', member: 'tech' },
    dashboardGreeting: 'Today’s site visits, open quotes, and protected job deposits — ready before you hit the road.',
    quickActions: {
      addClient: 'Add Customer',
      scheduleWork: 'Schedule Job',
      sendInvoice: 'Send Invoice',
    },
    notePlaceholder: 'Gate code, parking tip, breaker panel location, dog in yard...',
    checklist: {
      clients: {
        title: 'Add your first customer',
        detail: 'Save their address, phone, and property notes so you never hunt through old texts.',
        cta: 'Add a customer',
      },
      jobs: {
        title: 'Schedule your first job',
        detail: 'Track visits from scheduled to done so nothing slips through the cracks.',
        cta: 'Schedule a job',
      },
      sentInvoices: {
        title: 'Send a quote deposit or invoice',
        detail: 'Lock in materials up front and get paid fast as soon as the job wraps.',
        cta: 'Create an invoice',
      },
      deals: {
        title: 'Track an open estimate',
        detail: 'Keep every quoted job in one list so you remember to follow up.',
        cta: 'Add a quote',
      },
      openTasks: {
        title: 'Add a parts or callback reminder',
        detail: 'Order parts, call back a homeowner, or schedule a permit check.',
        cta: 'Add to-do',
      },
    },
    starterServices: [
      { name: 'Diagnostic & Service Call', description: 'On-site inspection, troubleshooting, and upfront repair quote.', price: 95, duration: 60, category: 'repair', locationType: 'in-home' },
      { name: 'Standard Repair Visit', description: 'Parts-ready repair visit covering common residential fixes.', price: 175, duration: 90, category: 'repair', locationType: 'in-home' },
      { name: 'Seasonal Tune-Up & Safety Check', description: 'Full system inspection, cleaning, and preventative maintenance.', price: 135, duration: 75, category: 'repair', locationType: 'in-home' },
      { name: 'Emergency Same-Day Dispatch', description: 'Priority arrival for urgent leaks, outages, or heating/cooling issues.', price: 225, duration: 90, category: 'repair', locationType: 'in-home' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Arrival Window Reminder',
        emoji: '🚐',
        subject: 'Quick reminder for tomorrow’s visit from {businessName}',
        body: "Hi {clientName}, just a quick reminder that {businessName} is scheduled to stop by tomorrow. Reply 'Y' to confirm we're still good, or text us if you need to shift the window!",
      },
      {
        id: 'deposit',
        label: 'Materials / Job Deposit',
        emoji: '🛠️',
        subject: 'Locking in your job with {businessName}',
        body: "Hey {clientName}, thanks for giving us the green light! Here's the quick deposit link for {businessName} so we can grab materials and lock your spot on the schedule.",
      },
      {
        id: 'thank_you',
        label: 'Job Wrapped & Check-In',
        emoji: '✅',
        subject: 'Thanks from {businessName}!',
        body: "Thanks for having {businessName} out today, {clientName}! Let us know right away if anything looks off or you have questions — always happy to help.",
      },
      {
        id: 'checkin',
        label: 'Quote Follow-Up',
        emoji: '👋',
        subject: 'Quick check-in on your quote from {businessName}',
        body: "Hey {clientName}, just circling back on the estimate we sent over from {businessName}. No rush at all — reply here if you have any questions or want to get it on the calendar!",
      },
    ],
  },

  cleaning: {
    id: 'cleaning',
    label: 'Cleaning & Home Care',
    shortLabel: 'Cleaning',
    emoji: '✨',
    description: 'Home cleaning, deep cleans, move-out & office care',
    exampleBusiness: 'Fresh Nest Cleaning',
    accentColor: '#7FA99B',
    bgLight: '#EFF7F4',
    highlights: ['Household preferences & entry notes', 'Recurring visits', 'Cleaner dispatch', 'Fast deposit protection'],
    navLabels: {
      clients: 'Households',
      deals: 'Recurring Plans',
      jobs: 'Cleanings',
      activities: 'Home Notes',
      tasks: 'Checklists',
      invoices: 'Payments & Deposits',
      team: 'Cleaners',
    },
    singular: { client: 'household', deal: 'plan', job: 'cleaning', member: 'cleaner' },
    dashboardGreeting: 'Today’s cleanings, happy regulars, and worry-free payments — organized for your crew.',
    quickActions: {
      addClient: 'Add Household',
      scheduleWork: 'Book Cleaning',
      sendInvoice: 'Send Invoice',
    },
    notePlaceholder: 'Lockbox code, pets at home, eco-friendly products only, focus rooms...',
    checklist: {
      clients: {
        title: 'Add your first household',
        detail: 'Save entry instructions, pet notes, and cleaning preferences in one spot.',
        cta: 'Add a household',
      },
      jobs: {
        title: 'Schedule your first cleaning',
        detail: 'Log each visit so your team knows where to go and regulars build trust.',
        cta: 'Book a cleaning',
      },
      sentInvoices: {
        title: 'Send your first payment link',
        detail: 'Skip awkward cash chasing — send a simple link right after booking or completion.',
        cta: 'Create payment link',
      },
      deals: {
        title: 'Track a recurring plan quote',
        detail: 'Keep track of bi-weekly or move-out estimates until they confirm.',
        cta: 'Add a plan',
      },
      openTasks: {
        title: 'Create a supply or prep task',
        detail: 'Restock supplies, confirm a key pickup, or follow up after a first clean.',
        cta: 'Add checklist item',
      },
    },
    starterServices: [
      { name: 'Standard Home Clean (2–3 Bed)', description: 'Kitchen, bathrooms, dusting, vacuuming, and mopping.', price: 140, duration: 120, category: 'cleaning', locationType: 'in-home' },
      { name: 'Deep Refresh Clean', description: 'Baseboards, inside appliances, detailed scrubbing, and full reset.', price: 240, duration: 210, category: 'cleaning', locationType: 'in-home' },
      { name: 'Move-In / Move-Out Clean', description: 'Empty-home top-to-bottom clean ready for handover.', price: 320, duration: 240, category: 'cleaning', locationType: 'in-home' },
      { name: 'Small Office Refresh', description: 'Desks, breakroom, restrooms, and trash haul-out.', price: 160, duration: 120, category: 'cleaning', locationType: 'on-site' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Cleaning Day Reminder',
        emoji: '🧹',
        subject: 'Quick reminder for tomorrow’s cleaning with {businessName}',
        body: "Hi {clientName}, just a quick reminder that {businessName} is coming by tomorrow for your cleaning! Reply 'Y' to confirm or let us know if anything changed with entry/pets.",
      },
      {
        id: 'deposit',
        label: 'Booking Deposit Note',
        emoji: '✨',
        subject: 'Confirming your cleaning with {businessName}',
        body: "Hey {clientName}! We'd love to get your home sparkling. Here's a quick link to confirm your deposit with {businessName} — it stays held safely until the clean is done.",
      },
      {
        id: 'thank_you',
        label: 'Sparkle Check-In',
        emoji: '💚',
        subject: 'All done at your place — {businessName}',
        body: "Hey {clientName}, we just wrapped up your cleaning and locked up! Hope you love walking into a fresh home. Let {businessName} know if we missed a spot or if you'd like to set up a regular rhythm.",
      },
      {
        id: 'checkin',
        label: 'Recurring Refresh Note',
        emoji: '👋',
        subject: 'Ready for your next clean? — {businessName}',
        body: "Hi {clientName}, hope everything's been great! Just checking in from {businessName} to see if you'd like to grab your usual slot next week.",
      },
    ],
  },

  consulting: {
    id: 'consulting',
    label: 'Consulting & Coaching',
    shortLabel: 'Consulting',
    emoji: '🎯',
    description: 'Advisors, coaches, freelancers & creative studios',
    exampleBusiness: 'Peak Advisory Co.',
    accentColor: '#8A9A7B',
    bgLight: '#F3F6F0',
    highlights: ['Client briefs & goals', 'Proposals & retainers', 'Session tracking', 'Milestone payments'],
    navLabels: {
      clients: 'Clients',
      deals: 'Proposals',
      jobs: 'Sessions',
      activities: 'Call Notes',
      tasks: 'Action Items',
      invoices: 'Retainers & Invoices',
      team: 'Advisors',
    },
    singular: { client: 'client', deal: 'proposal', job: 'session', member: 'advisor' },
    dashboardGreeting: 'Active clients, open proposals, and protected retainers — without spreadsheet chaos.',
    quickActions: {
      addClient: 'Add Client',
      scheduleWork: 'Book Session',
      sendInvoice: 'Send Retainer',
    },
    notePlaceholder: 'Key goals, preferred meeting time, current bottleneck, billing rhythm...',
    checklist: {
      clients: {
        title: 'Add your first client',
        detail: 'Keep their goals, call notes, and agreements together in one clean timeline.',
        cta: 'Add a client',
      },
      jobs: {
        title: 'Schedule a client session',
        detail: 'Track coaching calls or project milestones cleanly.',
        cta: 'Book a session',
      },
      sentInvoices: {
        title: 'Send your first retainer or invoice',
        detail: 'Get paid smoothly with protected deposits and zero awkward reminders.',
        cta: 'Create an invoice',
      },
      deals: {
        title: 'Track an open proposal',
        detail: 'See every discovery call and proposal in one simple pipeline.',
        cta: 'Add a proposal',
      },
      openTasks: {
        title: 'Add a follow-up action item',
        detail: 'Never forget to send a deck, recap, or check-in after a great call.',
        cta: 'Add action item',
      },
    },
    starterServices: [
      { name: '1:1 Strategy Session', description: 'Focused 60-minute working call with clear next steps.', price: 175, duration: 60, category: 'consulting', locationType: 'remote' },
      { name: 'Monthly Coaching Retainer', description: 'Four weekly check-ins plus direct async support.', price: 650, duration: 60, category: 'consulting', locationType: 'remote' },
      { name: 'Deep-Dive Audit & Roadmap', description: 'Full review and written 90-day action plan.', price: 450, duration: 120, category: 'consulting', locationType: 'remote' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Session Reminder',
        emoji: '🎯',
        subject: 'Looking forward to our session tomorrow — {businessName}',
        body: "Hi {clientName}, just a quick reminder about our session with {businessName} tomorrow! Reply 'Y' if we're still all set, or let me know if you want to move it.",
      },
      {
        id: 'deposit',
        label: 'Kickoff Deposit Link',
        emoji: '🤝',
        subject: 'Ready to kick off with {businessName}!',
        body: "Hey {clientName}, excited to get started together! Here's the quick link to lock in your kickoff deposit with {businessName} so we can jump right in.",
      },
      {
        id: 'thank_you',
        label: 'Post-Call Recap',
        emoji: '📝',
        subject: 'Great chatting today, {clientName}!',
        body: "Really enjoyed our session today, {clientName}! Let me know if anything pops up as you work through the next steps — always just a quick reply away here at {businessName}.",
      },
      {
        id: 'checkin',
        label: 'Friendly Check-In',
        emoji: '👋',
        subject: 'Checking in from {businessName}',
        body: "Hey {clientName}, hope things have been moving smoothly this week! Just checking in from {businessName} to see how things are feeling and if you'd like to book our next call.",
      },
    ],
  },

  real_estate: {
    id: 'real_estate',
    label: 'Real Estate & Property',
    shortLabel: 'Real Estate',
    emoji: '🏠',
    description: 'Landlords, property managers, brokers & rentals',
    exampleBusiness: 'Harborview Homes',
    accentColor: '#D9A854',
    bgLight: '#FDF8EE',
    highlights: ['Tenant & buyer profiles', 'Showings & offers', 'Protected rent deposits', 'Maintenance tracking'],
    navLabels: {
      clients: 'Tenants & Buyers',
      deals: 'Showings & Offers',
      jobs: 'Units & Maintenance',
      activities: 'Logs & Calls',
      tasks: 'Tasks',
      invoices: 'Rent & Deposits',
      team: 'Agents',
    },
    singular: { client: 'tenant', deal: 'offer', job: 'showing', member: 'agent' },
    dashboardGreeting: 'Tenants, showings, and protected security deposits — organized without chasing paperwork.',
    quickActions: {
      addClient: 'Add Tenant / Buyer',
      scheduleWork: 'Book Showing',
      sendInvoice: 'Request Rent / Deposit',
    },
    notePlaceholder: 'Preferred neighborhood, move-in date, pet details, pre-approval notes...',
    checklist: {
      clients: {
        title: 'Add your first tenant or buyer',
        detail: 'Keep their contact details, preferences, and reliability history together.',
        cta: 'Add tenant / buyer',
      },
      jobs: {
        title: 'Schedule a showing or inspection',
        detail: 'Track showings and maintenance visits in one simple schedule.',
        cta: 'Schedule showing',
      },
      sentInvoices: {
        title: 'Send a rent or deposit request',
        detail: 'Collect protected security deposits or monthly rent with clear receipts.',
        cta: 'Create payment request',
      },
      deals: {
        title: 'Track an active offer or lease',
        detail: 'Follow every prospect from showing to signed lease.',
        cta: 'Add offer / lease',
      },
      openTasks: {
        title: 'Add a follow-up task',
        detail: 'Reminders for lease renewals, inspections, or owner updates.',
        cta: 'Add task',
      },
    },
    starterServices: [
      { name: 'Property Showing & Walkthrough', description: 'Guided in-person or video tour with Q&A.', price: 0, duration: 45, category: 'other', locationType: 'on-site' },
      { name: 'Move-In Inspection & Handover', description: 'Room-by-room condition report and key handover.', price: 120, duration: 60, category: 'other', locationType: 'on-site' },
      { name: 'Tenant Placement & Screening', description: 'Listing, tours, reference checks, and lease prep.', price: 500, duration: 120, category: 'consulting', locationType: 'both' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Showing Reminder',
        emoji: '🏠',
        subject: 'Quick reminder for your showing tomorrow — {businessName}',
        body: "Hi {clientName}, just a quick reminder about your showing with {businessName} tomorrow! Reply 'Y' to confirm or let us know if you need to adjust the time.",
      },
      {
        id: 'deposit',
        label: 'Holding Deposit Note',
        emoji: '🔑',
        subject: 'Holding the unit for you — {businessName}',
        body: "Hey {clientName}, great news — we're ready to hold the place for you! Here's your protected deposit link from {businessName} to lock it in cleanly.",
      },
      {
        id: 'thank_you',
        label: 'After Showing Follow-Up',
        emoji: '😊',
        subject: 'Great meeting you today — {businessName}',
        body: "So nice meeting you today, {clientName}! Let me know what you thought of the space — happy to answer any questions or send over next steps from {businessName}.",
      },
      {
        id: 'checkin',
        label: 'Friendly Tenant Check-In',
        emoji: '👋',
        subject: 'Checking in from {businessName}',
        body: "Hi {clientName}, hope you're settling in great! Just checking in from {businessName} to make sure everything at the property is running smoothly.",
      },
    ],
  },

  wellness: {
    id: 'wellness',
    label: 'Wellness, Fitness & Clinic',
    shortLabel: 'Wellness',
    emoji: '🧘',
    description: 'Trainers, massage therapists, nutritionists & clinics',
    exampleBusiness: 'Calm Studio Wellness',
    accentColor: '#90A8C3',
    bgLight: '#F0F4F8',
    highlights: ['Member care notes', '1:1 sessions & packages', 'No-show protection', 'Practitioner team'],
    navLabels: {
      clients: 'Members',
      deals: 'Care Plans',
      jobs: 'Sessions',
      activities: 'Care Notes',
      tasks: 'Follow-ups',
      invoices: 'Payments & Deposits',
      team: 'Practitioners',
    },
    singular: { client: 'member', deal: 'care plan', job: 'session', member: 'practitioner' },
    dashboardGreeting: 'Your sessions, member notes, and calm no-show protection — so you can focus on care.',
    quickActions: {
      addClient: 'Add Member',
      scheduleWork: 'Book Session',
      sendInvoice: 'Send Session Link',
    },
    notePlaceholder: 'Goals, focus areas, injuries/sensitivities, preferred intensity...',
    checklist: {
      clients: {
        title: 'Add your first member',
        detail: 'Keep their goals, preferences, and visit notes private and handy.',
        cta: 'Add a member',
      },
      jobs: {
        title: 'Schedule your first session',
        detail: 'Track upcoming sessions and reward regulars who show up on time.',
        cta: 'Book a session',
      },
      sentInvoices: {
        title: 'Send a session deposit or pack',
        detail: 'Collect session payments upfront with zero awkwardness.',
        cta: 'Create payment link',
      },
      deals: {
        title: 'Track a multi-session package',
        detail: 'Keep track of 5-pack or monthly wellness inquiries.',
        cta: 'Add care plan',
      },
      openTasks: {
        title: 'Add a check-in reminder',
        detail: 'Follow up after a first session or send a recovery tip.',
        cta: 'Add follow-up',
      },
    },
    starterServices: [
      { name: '60-Min Therapeutic Massage', description: 'Tailored full-body tension relief and relaxation.', price: 110, duration: 60, category: 'massage', locationType: 'on-site' },
      { name: '1:1 Personal Training Session', description: 'Custom workout, form coaching, and progress tracking.', price: 80, duration: 60, category: 'other', locationType: 'both' },
      { name: 'New Member Intake & Plan', description: 'Goal assessment plus personalized 4-week plan.', price: 95, duration: 60, category: 'spa', locationType: 'both' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Session Reminder',
        emoji: '🧘',
        subject: 'Quick reminder for tomorrow at {businessName}',
        body: "Hi {clientName}, just a quick reminder about your session at {businessName} tomorrow. Reply 'Y' to confirm or let us know if you need to reschedule!",
      },
      {
        id: 'deposit',
        label: 'Friendly Deposit Note',
        emoji: '🌿',
        subject: 'Holding your session at {businessName}',
        body: "Hey {clientName}! We've got your time held at {businessName}. Tap this quick link whenever you're ready to confirm your small deposit — it stays safely protected until we meet.",
      },
      {
        id: 'thank_you',
        label: 'Post-Session Check-In',
        emoji: '💚',
        subject: 'Hope you’re feeling great! — {businessName}',
        body: "So good seeing you today, {clientName}! Remember to hydrate and take it easy tonight. Text {businessName} back anytime when you want to book your next session.",
      },
      {
        id: 'checkin',
        label: 'Warm Check-In',
        emoji: '👋',
        subject: 'Checking in from {businessName}',
        body: "Hey {clientName}, hope you're feeling good this week! Just a friendly check-in from {businessName} — let us know if you'd like to grab a spot next week.",
      },
    ],
  },

  general: {
    id: 'general',
    label: 'General Small Business',
    shortLabel: 'Business',
    emoji: '🏢',
    description: 'Any local shop, studio, or service business',
    exampleBusiness: 'My Local Business',
    accentColor: '#9B8EA0',
    bgLight: '#F5F2F7',
    highlights: ['Client relationships', 'Bookings & quotes', 'Protected payments', 'Team & tasks'],
    navLabels: {
      clients: 'Clients',
      deals: 'Bookings & Deals',
      jobs: 'Jobs',
      activities: 'Notes & Calls',
      tasks: 'Tasks',
      invoices: 'Escrow & Payments',
      team: 'Team',
    },
    singular: { client: 'client', deal: 'booking', job: 'job', member: 'team member' },
    dashboardGreeting: 'Your clients, scheduled work, and protected payments — simple and ready to go.',
    quickActions: {
      addClient: 'Add Client',
      scheduleWork: 'Schedule Job',
      sendInvoice: 'Send Invoice',
    },
    notePlaceholder: 'Preferences, how they found you, important follow-up details...',
    checklist: {
      clients: {
        title: 'Add your first client',
        detail: 'Everyone you do business with, with their details and notes in one place.',
        cta: 'Add a client',
      },
      jobs: {
        title: 'Record a job or booking',
        detail: 'Log work as you do it. Completed work builds trust automatically.',
        cta: 'Schedule a job',
      },
      sentInvoices: {
        title: 'Send your first invoice',
        detail: 'Send a clear payment link once the work is agreed.',
        cta: 'Create an invoice',
      },
      deals: {
        title: 'Track a quote or deal',
        detail: 'Anything you have quoted that has not started yet.',
        cta: 'Add a deal',
      },
      openTasks: {
        title: 'Create a follow-up task',
        detail: 'The quick reminders you would otherwise keep in your head.',
        cta: 'Add a task',
      },
    },
    starterServices: [
      { name: 'Initial Consultation', description: 'Quick intro call or visit to scope what you need.', price: 50, duration: 30, category: 'consulting', locationType: 'both' },
      { name: 'Standard Service Package', description: 'Our core service tailored to your needs.', price: 150, duration: 60, category: 'other', locationType: 'both' },
      { name: 'Full Project / Premium Package', description: 'End-to-end delivery with priority support.', price: 350, duration: 120, category: 'other', locationType: 'both' },
    ],
    outreachTemplates: [
      {
        id: 'reminder',
        label: 'Tomorrow Reminder',
        emoji: '📅',
        subject: 'Quick reminder for tomorrow with {businessName}',
        body: "Hi {clientName}, just a quick reminder about your appointment at {businessName} tomorrow. Reply 'Y' to confirm or let us know if you need to reschedule!",
      },
      {
        id: 'deposit',
        label: 'Friendly Deposit Note',
        emoji: '🤝',
        subject: 'Locking in your booking with {businessName}',
        body: "Hey {clientName}! We've got your spot saved at {businessName}. Whenever you get a chance, tap the link to confirm your deposit — it stays protected until we finish up.",
      },
      {
        id: 'thank_you',
        label: 'Thank You Note',
        emoji: '🙌',
        subject: 'Thanks for choosing {businessName}!',
        body: "Thanks so much for working with {businessName} today, {clientName}! Let us know if you need anything else — always happy to help.",
      },
      {
        id: 'checkin',
        label: 'Friendly Check-In',
        emoji: '👋',
        subject: 'Checking in from {businessName}',
        body: "Hey {clientName}, hope your week's going great! Just checking in from {businessName} to see if there's anything we can help you with soon.",
      },
    ],
  },
};

export const VERTICAL_LIST: VerticalPersona[] = [
  VERTICAL_PERSONAS.auto_repair,
  VERTICAL_PERSONAS.salon,
  VERTICAL_PERSONAS.trades,
  VERTICAL_PERSONAS.cleaning,
  VERTICAL_PERSONAS.consulting,
  VERTICAL_PERSONAS.real_estate,
  VERTICAL_PERSONAS.wellness,
  VERTICAL_PERSONAS.general,
];

/**
 * Resolves any stored vertical string (including legacy values like 'logistics')
 * safely to one of the 7 active SMB personas.
 */
export function getVerticalPersona(vertical?: string | null): VerticalPersona {
  if (vertical && vertical in VERTICAL_PERSONAS) {
    return VERTICAL_PERSONAS[vertical as VerticalId];
  }
  return VERTICAL_PERSONAS.general;
}

/**
 * Substitutes `{clientName}` (first name) and `{businessName}` into a friendly outreach template.
 */
export function formatOutreachMessage(
  template: string,
  params: { clientName?: string | null; businessName?: string | null }
): string {
  const firstName = (params.clientName || '').trim().split(/\s+/)[0] || 'there';
  const biz = (params.businessName || '').trim() || 'our team';
  return template
    .replace(/\{clientName\}/g, firstName)
    .replace(/\{businessName\}/g, biz);
}

/**
 * React hook returning the active business's VerticalPersona from persisted settings.
 */
export function useVerticalPersona(): VerticalPersona {
  const vertical = useBusinessSettings((s) => s.settings.vertical);
  return getVerticalPersona(vertical);
}

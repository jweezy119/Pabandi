/**
 * Outreach templates and audience segments.
 *
 * Server-side on purpose: the copy used to live only in
 * client/src/config/verticalPersonas.ts, which meant the server could not render
 * a message and the client could not be sure what it was previewing. The client
 * now fetches these.
 *
 * The existing copy was written for SMS ("reply 'Y'", "text us back"). These are
 * written for email, which is the only channel wired up today — see
 * services/email.service.ts (Resend). Placeholders are substituted at send time.
 */

export interface OutreachTemplate {
  id: string;
  label: string;
  emoji: string;
  subject: string;
  /** Plain text. Kept as text rather than HTML: it is read in an inbox, not rendered as a landing page. */
  body: string;
}

/**
 * Deliberately vertical-agnostic. The four ideas that make a customer come back
 * do not change between a salon and a repair shop, and a per-vertical copy
 * explosion is how template libraries rot.
 */
export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'reminder',
    label: 'Appointment reminder',
    emoji: '📅',
    subject: 'Reminder: you are booked at {businessName}',
    body: [
      'Hi {clientName},',
      '',
      'A quick reminder about your appointment at {businessName}.',
      '',
      'We are holding the time for you. If something has come up and you need to move it, just reply to this email and we will sort it out — no fuss.',
      '',
      'Thanks,',
      '{businessName}',
    ].join('\n'),
  },
  {
    id: 'win_back',
    label: 'We miss you (lapsed customer)',
    emoji: '👋',
    subject: 'It has been a while, {clientName}',
    body: [
      'Hi {clientName},',
      '',
      'We realised it has been a while since your last visit to {businessName}, and we did not want to let it slip by without saying hello.',
      '',
      'If it is time for a service, we have opened up some times for you. Reply to this email and we will get you booked in.',
      '',
      'Hope to see you soon,',
      '{businessName}',
    ].join('\n'),
  },
  {
    id: 'rebook',
    label: 'Thank you and rebook',
    emoji: '✨',
    subject: 'Great seeing you, {clientName}',
    body: [
      'Hi {clientName},',
      '',
      'Thank you for coming in to {businessName}. We hope you are happy with the work.',
      '',
      'If it is about time for the next one, reply and we will set it up.',
      '',
      'Thanks again,',
      '{businessName}',
    ].join('\n'),
  },
  {
    id: 'seasonal',
    label: 'Seasonal touch',
    emoji: '🗓️',
    subject: 'Checking in from {businessName}',
    body: [
      'Hi {clientName},',
      '',
      'Just checking in from {businessName}.',
      '',
      'If there is anything you have been meaning to get done, now is a good time — reply and we will find a slot that works for you.',
      '',
      'Thanks,',
      '{businessName}',
    ].join('\n'),
  },
  {
    id: 'review',
    label: 'Ask for a review',
    emoji: '⭐',
    subject: 'Did we do a good job, {clientName}?',
    body: [
      'Hi {clientName},',
      '',
      'We hope everything went well at {businessName}.',
      '',
      'If you have a minute, a short note about your experience helps a small business more than you would think. Just reply here and tell us how it went.',
      '',
      'Thank you,',
      '{businessName}',
    ].join('\n'),
  },
];

export interface OutreachSegment {
  id: string;
  label: string;
  /** One sentence, for a business owner with no CRM experience. */
  description: string;
  /** Days since last job. Only meaningful for the lapsed segment. */
  lapsedDays?: number;
}

export const OUTREACH_SEGMENTS: OutreachSegment[] = [
  {
    id: 'all',
    label: 'All customers',
    description: 'Everyone on your client list who has an email address.',
  },
  {
    id: 'lapsed',
    label: 'Haven’t booked in 90 days',
    description:
      'Customers whose last job was more than 90 days ago. Usually the most valuable group — they already trust you, they just forgot.',
    lapsedDays: 90,
  },
  {
    id: 'leads',
    label: 'New leads',
    description: 'People at the LEAD stage who have not booked yet.',
  },
  {
    id: 'active',
    label: 'Active customers',
    description: 'People at the ACTIVE stage.',
  },
  {
    id: 'high_value',
    label: 'Spent over $500',
    description: 'Customers who have spent more than $500 with you in total.',
  },
];

export function getSegment(id: string): OutreachSegment | undefined {
  return OUTREACH_SEGMENTS.find((s) => s.id === id);
}

export function getTemplate(id: string): OutreachTemplate | undefined {
  return OUTREACH_TEMPLATES.find((t) => t.id === id);
}

/** Replace {businessName} / {clientName} without allowing HTML injection. */
export function renderTemplate(
  text: string,
  vars: Record<string, string | undefined>,
): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.split(`{${key}}`).join(value ?? ''),
    text,
  );
}

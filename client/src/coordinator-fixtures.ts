import type { CommandTechnician } from './components/coordinator/commandParser';
import type { WorkOrder } from './components/coordinator/types';
/**
 * Technicians for the standalone harness and the browser tests. Two of them
 * share a first name deliberately — the command bar must ask rather than pick,
 * and "Marcus" resolving to two people is the case that proves it.
 */
export const TECHNICIAN_FIXTURES: CommandTechnician[] = [
  { id: 'tech-001', name: 'Marcus Reed', active: true },
  { id: 'tech-002', name: 'Marcus Chen', active: true },
  { id: 'tech-003', name: 'Dana Whitfield', active: true },
  { id: 'tech-004', name: 'Luis Ortega', active: true },
];

/**
 * Fixture work orders for the standalone harness and the browser tests.
 *
 * These are deliberately realistic rather than minimal: a high-risk job with a
 * full explanation, a low-risk job, a medium-risk job whose estimate is
 * outside the validated range, and a completed job with no prediction at all.
 * The last one matters — it proves the UI does not invent a risk chip where
 * the model has not supplied one.
 */
export const WORK_ORDER_FIXTURES: WorkOrder[] = [
  {
    id: 'wo-1425',
    status: 'EN_ROUTE',
    priority: 'EMERGENCY',
    issueType: 'Active Roof Leak',
    description:
      'Water pouring through the ceiling tiles in the server room during heavy rain. Facilities manager reports the leak is getting worse.',
    address: '1425 Chase Ave, Elk Grove Village, IL 60007',
    accessNotes: 'Roof ladder at the north loading dock. Hard hats and OSHA harness required.',
    scheduledFor: '2026-11-09T13:00:00.000Z',
    createdAt: '2026-11-09T07:15:00.000Z',
    completedAt: null,
    invoiceStatus: 'NOT_READY',
    customer: {
      id: 'cus-001',
      name: 'Chase Bank – Elk Grove Pavilion',
      phoneMasked: '(***) ***-2400',
      addressMasked: '1425 Chase Ave, Elk Grove Village',
    },
    assignments: [
      {
        id: 'asg-001',
        assignedAt: '2026-11-09T08:05:00.000Z',
        acceptedAt: '2026-11-09T08:12:00.000Z',
        declinedAt: null,
        technician: {
          id: 'tech-001',
          name: 'Marcus Reed',
          skills: ['commercial_roofing', 'leak_repair', 'emergency_dispatch'],
          active: true,
        },
      },
    ],
    attachments: [
      {
        id: 'att-001',
        kind: 'photo',
        url: 'https://example.com/evidence/wo-1425/leak.jpg',
        createdAt: '2026-11-09T08:20:00.000Z',
      },
    ],
    auditCount: 6,
    risk: {
      score: 0.71,
      confidence: 0.82,
      p10: 0.62,
      p50: 0.71,
      p90: 0.8,
      outOfRange: false,
      policy: 'HUMAN_MANDATORY',
      calibrated: true,
      factors: [
        {
          factor: 'schedule_density_today',
          impact: 0.32,
          plainLanguage:
            'Your crew already has four jobs booked today, which makes it harder to reach this one on time.',
        },
        {
          factor: 'precipitation_forecast',
          impact: 0.18,
          plainLanguage: 'More rain is expected this afternoon, so the leak is likely to get worse.',
        },
        {
          factor: 'technician_experience_years',
          impact: -0.09,
          plainLanguage: 'Marcus has been doing this work for twelve years, which lowers the chance of a problem.',
        },
      ],
      // Where the what-if sliders start. The real endpoint derives these from
      // the work order; the fixture writes them down.
      features: {
        schedule_density: 4,
        lead_time_days: 1,
        issue_type_complexity: 0.8,
        technician_skill_match: 0.5,
        technician_experience_years: 12,
      },
    },
  },
  {
    id: 'wo-1426',
    status: 'PENDING_ASSIGNMENT',
    priority: 'URGENT',
    issueType: 'Roof Inspection',
    description: 'Annual inspection of the single-ply membrane before the warranty renewal.',
    address: '8800 Industrial Pkwy, Elk Grove Village, IL 60007',
    accessNotes: 'Check in at the front office for a visitor badge.',
    scheduledFor: '2026-11-10T15:00:00.000Z',
    createdAt: '2026-11-08T16:40:00.000Z',
    completedAt: null,
    invoiceStatus: 'NOT_READY',
    customer: {
      id: 'cus-002',
      name: 'Industrial Parkway Associates',
      phoneMasked: '(***) ***-7712',
      addressMasked: '8800 Industrial Pkwy, Elk Grove Village',
    },
    assignments: [],
    attachments: [],
    auditCount: 2,
    risk: {
      score: 0.22,
      confidence: 0.91,
      p10: 0.15,
      p50: 0.22,
      p90: 0.31,
      outOfRange: false,
      policy: 'AUTONOMOUS',
      calibrated: true,
      factors: [
        {
          factor: 'schedule_density_today',
          impact: -0.11,
          plainLanguage: 'The day is still fairly open, so there is room to fit this job in.',
        },
      ],
      features: {
        schedule_density: 1,
        lead_time_days: 5,
        issue_type_complexity: 0.3,
        technician_skill_match: 1,
        technician_experience_years: 8,
      },
    },
  },
  {
    id: 'wo-1427',
    status: 'ASSIGNED',
    priority: 'ROUTINE',
    issueType: 'HVAC Maintenance',
    description: 'Quarterly filter change and belt inspection on two rooftop units.',
    address: '4520 Belle Ln, Bensenville, IL 60106',
    accessNotes: null,
    scheduledFor: '2026-11-12T10:00:00.000Z',
    createdAt: '2026-11-05T11:00:00.000Z',
    completedAt: null,
    invoiceStatus: 'READY',
    customer: {
      id: 'cus-003',
      name: 'Bensenville Logistics Center',
      phoneMasked: '(***) ***-0091',
      addressMasked: '4520 Belle Ln, Bensenville',
    },
    assignments: [
      {
        id: 'asg-002',
        assignedAt: '2026-11-06T09:30:00.000Z',
        acceptedAt: null,
        declinedAt: null,
        technician: {
          id: 'tech-002',
          name: 'Dana Whitfield',
          skills: ['hvac', 'preventive_maintenance'],
          active: true,
        },
      },
    ],
    attachments: [],
    auditCount: 3,
    risk: {
      score: 0.48,
      confidence: 0.63,
      p10: 0.29,
      p50: 0.48,
      p90: 0.91,
      outOfRange: true,
      factors: [
        {
          factor: 'parts_availability',
          impact: 0.21,
          plainLanguage: 'One of the belts is not in stock locally, so it may need to be ordered.',
        },
      ],
    },
  },
  {
    id: 'wo-1428',
    status: 'COMPLETED',
    priority: 'ROUTINE',
    issueType: 'Gutter Cleaning',
    description: 'Clean and flush the perimeter gutters ahead of the winter freeze.',
    address: '1200 Howard St, Des Plaines, IL 60016',
    accessNotes: 'Gate code 4417.',
    scheduledFor: '2026-11-03T09:00:00.000Z',
    createdAt: '2026-10-30T13:20:00.000Z',
    completedAt: '2026-11-03T12:45:00.000Z',
    invoiceStatus: 'PAID',
    customer: {
      id: 'cus-004',
      name: 'Howard Street Self Storage',
      phoneMasked: '(***) ***-3345',
      addressMasked: '1200 Howard St, Des Plaines',
    },
    assignments: [
      {
        id: 'asg-003',
        assignedAt: '2026-11-02T08:00:00.000Z',
        acceptedAt: '2026-11-02T08:10:00.000Z',
        declinedAt: null,
        technician: {
          id: 'tech-003',
          name: 'Luis Ortega',
          skills: ['gutters', 'exterior_maintenance'],
          active: true,
        },
      },
    ],
    attachments: [
      {
        id: 'att-002',
        kind: 'signature',
        url: 'https://example.com/evidence/wo-1428/signature.png',
        createdAt: '2026-11-03T12:50:00.000Z',
      },
    ],
    auditCount: 9,
    // No risk assessment: the model does not score completed work, and the UI
    // must not imply otherwise.
    risk: undefined,
  },
];

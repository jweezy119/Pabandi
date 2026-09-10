# Pabandi Property OS
## Feature Backlog + Technical Architecture

---

## 1. Product Vision

**Pabandi Property OS** is the enterprise operating system for property managers, landlords, and hospitality operators who want to replace fragmented PM software, paper deposits, and manual screening with a single trust-native platform.

It sits on top of the existing Pabandi Booking OS and Trust Engine, but targets a different buyer: the operator, not the guest.

### Positioning

| | Booking OS | Property OS |
|---|---|---|
| **User** | Guests, tenants, customers | Landlords, PMs, hotel ops |
| **Core job** | Discover + book + earn rewards | Manage + screen + collect + maintain |
| **UI** | Consumer mobile/web | Admin dashboard + tenant portal |
| **Revenue** | Booking rake + $PAB utility | SaaS + transaction fees |
| **Analogy** | Airbnb guest app | Buildium + AppFolio + Airbnb host tools |

---

## 2. Feature Backlog (Prioritized)

### P0 — Must-have for MVP beta (Q4 2026)

**Leases & Units**
- Unit inventory: buildings, units, beds/baths, sqft, amenities, photos
- Lease creation + digital signing (PandaDoc / DocuSign integration)
- Lease terms: start/end, rent amount, deposit amount, pet policy, utilities included
- Lease status lifecycle: draft → active → expired → renewed → terminated
- Document storage: lease PDFs, addendums, insurance certs

**Rent + Payments**
- Rent roll: monthly/quarterly/annual schedules per unit
- Automated rent collection with escrow-backed deposit logic
- Late fee automation: configurable grace period + fee schedule
- Pet fee + utility surcharge tracking
- Payment methods: card, ACH, crypto ($PAB + SOL stablecoins)
- Receipts + payment history per tenant

**Tenant Screening**
- Application form: income, employment, references, background
- Pabandi Passport integration: pull tenant reliability score
- AI no-show / risk prediction from booking history
- Manual override + approval workflow

**Maintenance**
- Work order submission from tenant portal
- Vendor assignment + status tracking
- Photo + cost logging

**Communications**
- In-app messaging between PM and tenant
- Announcement broadcasts (maintenance, policies)
- Email/SMS notifications for payment due, lease renewal

**Admin Dashboard**
- Building/unit overview with occupancy status
- Revenue dashboard: collected vs expected, late fees, pet fees
- Tenant directory with Passport scores
- Lease expiry alerts + renewal pipeline

### P1 — Scale-ready (Q1 2027)

**Advanced Property Management**
- Multi-building / portfolio view
- Budget tracking + expense categorization
- Vendor management: quotes, invoices, approvals
- Inspection scheduling + digital checklists (move-in/move-out)
- Pet registry + breed/weight verification
- Utility metering + tenant billing reconciliation

**Hotel Add-ons**
- Channel management: sync inventory to Airbnb, Booking.com, VRBO
- Rate plans: nightly, weekly, monthly, dynamic pricing rules
- Housekeeping: task generation, room status, checklist
- Guest profile merge: booking OS guest → hotel PMS profile
- Group booking blocks + conference/event deposits

**Tenant Portal (White-label)**
- Branded domain/subdomain per property manager
- Logo, colors, custom domain
- Tenant self-service: pay rent, submit maintenance, view lease
- Mobile-responsive PWA

**Integrations**
- Buildium import: CSV bulk migration
- AppFolio API: two-way sync
- Rent Manager / Yardi: CSV + limited API
- Sevenrooms / Resy / OpenTable: reservation import
- QuickBooks / Xero: accounting sync
- Twilio: SMS notifications
- SendGrid: email campaigns

**Financials**
- Rent roll reports: monthly, quarterly, annual
- 1099 generation for vendors
- Deposit accounting: security deposit ledger per lease
- Tax reporting: income by property, expense categories

### P2 — Expansion (Q2–Q3 2027)

**AI & Trust**
- Predictive maintenance: flag units likely to need repair based on age + tenant history
- Tenant churn prediction: alert PM to renew before vacancy
- Dynamic deposit sizing: reliable tenants pay lower deposits via $PAB staking
- Fair housing compliance: audit trail for screening decisions

**Hospitality Intelligence**
- Revenue management: dynamic pricing based on occupancy + demand
- Channel analytics: which OTAs drive highest-value guests
- Review aggregation: pull Google/Booking.com reviews into guest profile
- Loyalty program: $PAB rewards for repeat guests across properties

**Advanced Escrow**
- Security deposit escrow on-chain: automated release/claim on move-out
- Damage assessment: third-party inspection + photo AI → automatic deposit adjustment
- Renters insurance escrow: policy verification + lapse alerts
- Cross-property $PAB settlement: tenant moves buildings, reputation + staking moves with them

**Marketplace**
- Vendor marketplace: pre-vetted maintenance, cleaning, photography vendors
- Tenant referral program: $PAB rewards for referring qualified renters
- Landlord referral: $PAB for referring property managers

---

## 3. Technical Architecture

### System Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Pabandi Platform                          │
├──────────────┬──────────────┬───────────────────────────────┤
│  Booking OS  │ Property OS  │         Trust Engine           │
│  (consumer)  │ (operator)   │   (shared core)                │
├──────────────┼──────────────┼───────────────────────────────┤
│ • Discovery  │ • Dashboard  │ • AI Scoring                   │
│ • Booking    │ • Leases     │ • Escrow contracts             │
│ • $PAB       │ • Payments   │ • Verification                 │
│ • Reviews    │ • Screening  │ • Dispute resolution           │
│ • Maps       │ • Maintenance│ • Webhook triggers             │
└──────────────┴──────────────┴───────────────────────────────┘
         │                │                    │
         ▼                ▼                    ▼
   Firebase Hosting   Admin + Portal      Node/Express API
   (frontend SPA)     (React/Next.js)     (backend services)
         │                │                    │
         └────────────────┼────────────────────┘
                          ▼
                   PostgreSQL + Prisma
                          │
                          ▼
                   Redis (cache/queue)
                          │
                          ▼
              ┌───────────────────────┐
              │   Solana Integration   │
              │  • $PAB token          │
              │  • Escrow contracts    │
              │  • On-chain receipts   │
              └───────────────────────┘
```

### Database Schema (Property OS core tables)

```
buildings
├── id, name, address, city, state, country, type (apartment/hotel/mixed)
├── owner_id, pm_id (property manager)
├── total_units, occupied_units, amenities
├── branding: logo, primary_color, custom_domain
├── settings: late_fee_amount, grace_period_days, pet_policy
└── timestamps

units
├── id, building_id, unit_number, floor, beds, baths, sqft
├── rent_amount, deposit_amount, pet_deposit
├── status: available/occupied/maintenance/reserved
├── photos, amenities, description
└── timestamps

leases
├── id, unit_id, tenant_id, building_id
├── start_date, end_date, rent_amount, deposit_amount
├── status: draft/active/expired/renewed/terminated
├── signed_at, terminated_at, termination_reason
├── document_url (signed PDF)
└── timestamps

payments
├── id, lease_id, tenant_id, amount, type (rent/deposit/late_fee/pet_fee/utility)
├── due_date, paid_at, status: pending/paid/overdue/refunded
├── method: card/ach/crypto/cash
├── escrow_status: held/released/claimed/disputed
└── timestamps

maintenance_requests
├── id, unit_id, tenant_id, building_id
├── title, description, priority, photos
├── status: open/assigned/in_progress/completed
├── vendor_id, estimated_cost, actual_cost
└── timestamps

tenants
├── id, email, phone, name, dob
├── pab_passport_id (link to trust engine)
├── screening_score, reliability_score
├── emergency_contact
└── timestamps

screening_applications
├── id, tenant_id, unit_id, building_id
├── income, employment, references, background_check_status
├── pab_score_snapshot (at time of application)
├── status: submitted/under_review/approved/rejected
└── timestamps

vendors
├── id, name, service_type, contact, email, phone
├── insurance_expiry, license_number
├── rating, total_jobs, active
└── timestamps

channels (hotel add-on)
├── id, building_id, platform (airbnb/booking_com/vrbo)
├── external_property_id, sync_enabled
├── rate_plan_id, availability_rules
└── timestamps
```

### API Design (backend)

```
# Leases
POST   /api/v1/leases                    # Create lease draft
PUT    /api/v1/leases/:id                # Update lease
POST   /api/v1/leases/:id/send-for-sign  # Send to tenant for signature
POST   /api/v1/leases/:id/activate       # Activate after signed
POST   /api/v1/leases/:id/renew          # Renew lease
POST   /api/v1/leases/:id/terminate      # Terminate early

# Units
GET    /api/v1/buildings/:id/units       # List units
POST   /api/v1/units                     # Create unit
PUT    /api/v1/units/:id                 # Update unit
POST   /api/v1/units/:id/status          # Change status

# Payments
POST   /api/v1/payments/rent             # Create rent payment
POST   /api/v1/payments/deposit          # Collect deposit
POST   /api/v1/payments/late-fee         # Assess late fee
POST   /api/v1/payments/refund           # Refund payment
GET    /api/v1/payments/:id/escrow       # Check escrow status
POST   /api/v1/payments/:id/release      # Release escrow

# Screening
POST   /api/v1/applications              # Submit application
GET    /api/v1/applications/:id          # View application
POST   /api/v1/applications/:id/approve  # Approve tenant
POST   /api/v1/applications/:id/reject   # Reject tenant

# Maintenance
POST   /api/v1/maintenance               # Create work order
PUT    /api/v1/maintenance/:id           # Update status
POST   /api/v1/maintenance/:id/assign    # Assign vendor
POST   /api/v1/maintenance/:id/complete  # Mark complete + cost

# Trust Engine (shared)
POST   /api/v1/trust/score               # Get tenant reliability score
POST   /api/v1/trust/escrow/create       # Create escrow for booking
POST   /api/v1/trust/escrow/release      # Release on honored appointment
POST   /api/v1/trust/rewards/calculate   # Calculate $PAB rewards

# Integrations
POST   /api/v1/integrations/buildium/import    # Bulk import from Buildium
POST   /api/v1/integrations/appfolio/sync      # Sync with AppFolio
POST   /api/v1/integrations/channels/sync      # Sync hotel channels
```

### Frontend Architecture

**Operator Dashboard (Property OS)**
- Next.js 14+ App Router
- Role-based access: owner, PM, leasing agent, maintenance
- Features:
  - Building/unit Kanban or list view
  - Financial dashboard (Stripe/Treasury charts)
  - Lease management table with status filters
  - Tenant directory with Passport score badges
  - Maintenance queue with vendor assignment
  - White-label settings panel

**Tenant Portal (White-label)**
- Next.js PWA, deployable as subdomain per client
- Branded with client logo/colors
- Features:
  - Pay rent + view payment history
  - Submit maintenance requests
  - View/download lease documents
  - View Passport score + $PAB balance
  - Request lease renewal

**Shared components**
- Trust Engine SDK (JS/TS)
- Escrow widget (embeddable in dashboard + portal)
- $PAB rewards calculator
- Map component (Leaflet + OpenStreetMap)
- Notification center (in-app + email + SMS)

### Infrastructure

| Component | Service | Notes |
|---|---|---|
| Hosting | Firebase Hosting + Vercel | Booking OS on Firebase, Property OS on Vercel |
| Database | PostgreSQL (Supabase / Railway) | Shared across Booking OS + Property OS |
| ORM | Prisma | Single schema, multi-tenant by `building_id` |
| Cache | Redis (Upstash) | Session, rate limiting, escrow state cache |
| Queue | BullMQ or Supabase Queue | Webhook triggers, payment processing |
| File storage | Firebase Storage / S3 | Lease PDFs, inspection photos, documents |
| Auth | Firebase Auth + custom JWT | Role-based: guest, tenant, operator, admin |
| Monitoring | Sentry + PostHog | Error tracking + product analytics |
| CI/CD | GitHub Actions | Build, test, deploy on push |

### Multi-tenancy

- All Property OS data scoped by `building_id` or `organization_id`
- White-label: `tenant.${brand}.pabandi.com` resolves to branded portal
- Row-level security in database ensures operators only see their data
- Central admin superuser for platform operations

---

## 4. Integration Roadmap

### Phase 1: CSV-first (no API required)
- Buildium: export CSV → import units, tenants, leases
- AppFolio: export CSV → import
- Rent Manager / Yardi: CSV export templates
- Sevenrooms / Resy: reservation export → import as bookings

### Phase 2: API integrations
- AppFolio REST API: two-way sync for units, leases, payments
- QuickBooks / Xero: chart of accounts, sync payment records
- Twilio: SMS reminders for payment due, maintenance updates
- SendGrid: email campaigns, lease delivery
- DocuSign / PandaDoc: embedded signing in lease workflow

### Phase 3: Channel management
- Airbnb API: sync availability, rates, reservations
- Booking.com API: channel manager sync
- VRBO API: inventory + booking sync
- Google Hotel Ads: rate + availability feed

### Phase 4: Advanced
- Plaid / Stripe Connect: ACH + card payments + payouts to PMs
- Checkr / TransUnion: tenant background checks API
- Insurance API: renters insurance verification + lapse alerts
- Accounting: deeper QuickBooks Online + NetSuite integrations

---

## 5. Go-to-Market Strategy

### Target segments (in order)

1. **Chicago property managers (50–500 units)** — local network, high pain, warm intros
2. **Single-unit hosts + Airbnb operators** — easy to onboard, viral referral
3. **Student housing + co-living** — high no-show rate, $PAB rewards resonate
4. **Pakistan corridor landlords** — existing founder network, urgent trust problem
5. **Hotel B&Bs + boutique hotels** — channel management pain, willing to pay

### Pricing model

| Tier | Units | Price | Includes |
|---|---|---|---|
| **Starter** | 1–10 units | $49/mo | Basic PM tools, 1 white-label portal |
| **Growth** | 11–100 units | $149/mo | Advanced screening, maintenance, integrations |
| **Business** | 101–500 units | $399/mo | Multi-building, channel mgmt, API access |
| **Enterprise** | 500+ units | Custom | Dedicated support, custom integrations, SLA |

**Transaction fees**
- 0.5% on rent payments collected through escrow
- 1% on security deposit hold/release
- $PAB rewards funded by platform rake

### Pilot program

- Offer 3 months free to 5 anchor property managers in Chicago
- Require: weekly feedback, testimonial, case study
- Success criteria: 100+ active bookings, <5% no-show rate, NPS > 40

---

## 6. Milestones

| Quarter | Milestone | Success metric |
|---|---|---|
| **Q4 2026** | Property OS beta launch | 5 pilot PMs, 100 units onboarded |
| **Q1 2027** | White-label portal + lease mgmt | 20 PMs, 500 units, $5K MRR |
| **Q2 2027** | Payment escrow + screening live | $20K MRR, 1,000+ active leases |
| **Q3 2027** | Hotel add-ons + channel mgmt | 3 hotel pilots, $50K MRR |
| **Q4 2027** | $PAB staking + deposit escrow on-chain | 5,000+ units, $100K+ MRR |

---

## 7. Competitive Landscape

| Competitor | Focus | Weakness vs Pabandi |
|---|---|---|
| **Buildium** | Full PM SaaS | No escrow, no $PAB, no trust layer |
| **AppFolio** | Enterprise PM | Expensive, no consumer booking, no crypto |
| **Sevenrooms** | Restaurant/hospitality | No leases, no property management |
| **Resy / OpenTable** | Restaurant bookings | No deposits, no escrow, no $PAB |
| **Airbnb** | Hospitality + trust | Not white-label, high rake, no PM tools |
| **Earnest / deposit alternatives** | Deposit insurance | No booking layer, no cross-vertical |
| **Solana Pay / escrow templates** | Crypto-native payments | No CRM, no UI, no operator workflow |

**Pabandi’s unique advantage:** The only platform that unifies **booking discovery + operator CRM + escrow-backed trust + $PAB rewards** across rentals, hospitality, and services.

---

## 8. Open Questions / Decisions

- [ ] Lease signing: DocuSign vs PandaDoc vs custom e-signature?
- [ ] Payments: Stripe only, or add crypto ($PAB + SOL) from day 1?
- [ ] Hotel channel mgmt: build in-house or partner with existing channel manager?
- [ ] Screening: build own AI or partner with Checkr/TransUnion?
- [ ] Accounting: build native or integrate QuickBooks from start?
- [ ] Escrow licensing: operate as money transmitter or partner with licensed escrow agent?

---

*Document version: 2026-09-08*
*Saved to: /home/peesee/Pabandi/property-os-architecture.md*

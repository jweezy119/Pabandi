# Pabandi: The Trust & Payments Protocol for Emerging Markets

![Pabandi Banner](https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=2000&h=600)

**Pabandi** is a decentralized trust, escrow, and payments protocol for emerging markets. It combines AI-powered fraud detection, trust scoring, and mobile money integration to create a seamless payment experience for users in Pakistan and beyond.

The protocol operates through three core OS layers:
- **Sitara** — Booking & discovery for services, hospitality, and rentals
- **Saf OS** — Freight & logistics management for carriers and shippers
- **Haq OS** — Property management for landlords and tenants

Users earn **$PAB rewards** for every transaction, while Jev AI handles all security and decision-making behind the scenes — 400x cheaper than traditional LLMs.

---

## The Pabandi Vision

Pabandi exists because trust is the most expensive thing in the world — especially for people who don't have money to spare.

When a freelancer in Pakistan finishes a job and gets ghosted, it's groceries they can't buy. When a landlord has a no-show, they can't make rent. Current platforms punish the people who are trying the hardest.

Pabandi fixes this with:
- **Escrow smart contracts** — Funds locked until both parties fulfill
- **AI Trust Oracle** — Dynamic trust scoring based on real behavior
- **Mobile money integration** — Raast, JazzCash, EasyPaisa for PKR
- **Frictionless payments** — 1-click checkout, no crypto jargon
- **Jev security** — 400x cheaper than LLMs for fraud detection

---

## The Three OS Layers

### 1. Sitara (Emerald)
Booking, discovery, and hospitality. Find restaurants, hotels, and services. Book with one click. Earn $PAB rewards.

**Key Features:**
- Discovery feed with "Near me" search
- 3-step booking flow
- QR code check-in
- Review and rating system

### 2. Saf OS (Amber)
Freight and logistics management. Post loads, find carriers, track shipments.

**Key Features:**
- Load board with search/filter
- AI-powered carrier matching
- Rate calculator
- Shipment tracking
- Carrier directory with ratings

### 3. Haq OS (Violet)
Property management for landlords. Manage tenants, leases, maintenance, and revenue.

**Key Features:**
- Revenue dashboard (weekly/monthly/yearly)
- Tenant management with risk scores
- Lease management (create/renew/terminate)
- Maintenance request Kanban board
- Financial reporting
- Communication tools

---

## Trust Passport Profiles

Every user gets a public, shareable Trust Passport — their identity in the Pabandi ecosystem.

**Key Features:**
- **Editable by owner** — Full control over bio, tagline, location, avatar, banner
- **Trust-first** — Scores lead, not follows. Users can hide but never fake
- **Social linking** — LinkedIn, X, GitHub, Instagram, YouTube, TikTok with auto-verification
- **Portfolio** — Showcase work with media, links, and featured items
- **Customizable** — Banner colors, accent colors, layout styles (classic/compact/showcase)
- **Live preview** — 375px mobile preview updates instantly as you edit
- **Public view** — `pabandi.com/u/:username` with OG tags and share buttons

---

## CRM Modularity — Shape It Like Clay

The CRM dashboard is fully modular. Users shape and mold their experience with their own hands.

**Key Features:**
- **Widget registry** — 10 widget types (stats, pipeline, revenue, clients, activities, tasks, alerts, calendar, team, goals)
- **Drag-and-drop** — Reorder widgets, toggle visibility, half/full width
- **Theme customization** — Accent colors, density (compact/comfortable/spacious), corner radius
- **Custom fields** — Define fields per entity (Client, Deal, Job, Invoice)
- **CSV import** — Bulk import clients and deals with column mapping and preview
- **Service catalog** — Images, categories, tags, discount pricing, location types
- **Business hours** — 7-day schedule with per-day hours
- **Service area** — Radius, travel fee, max travel time

---

## Fluid Booking with Trust Scoring

Booking is now a unified, trust-gated flow that adapts to each user.

**Key Features:**
- **4-step flow** — Service select → date/time → details → confirmed
- **Real availability** — Per-service slots with capacity management
- **Trust-gated deposits** — Waived for trusted users (80+), adjusted by risk score
- **Slot locking** — 10-minute holds prevent double-booking during checkout
- **Risk-based pricing** — No-show probability computed at booking time
- **Values alignment** — Shows if user and business share values

---

## AI Agent Infrastructure

Pabandi is the trust and settlement layer for AI agents.

**Key Features:**
- **Agent Capability Passport (PTP)** — Portable, offline-verifiable trust attestations with 5 risk bands
- **Agent-to-agent communication** — Messaging, task queues, and collaboration
- **Agent marketplace** — Register, discover, and hire agents
- **Agent analytics** — Task completion, bookings, trust score, earnings
- **Agent consent** — OAuth-like flow for agent-on-behalf-of-user actions
- **MCP server** — JSON-RPC 2.0 with tool registry and access tiers
- **SDKs** — TypeScript, JavaScript, and Python
- **Webhooks** — HMAC-signed event delivery with retries
- **API keys** — Hashed at rest, tiered quotas, scoped permissions

**Agent Discovery:**
- `/.well-known/agents.json` — Agent capabilities and endpoints
- `/.well-known/agent-registry.json` — Dynamic agent registry
- `/.well-known/agent-status` — Platform health for agents
- `/.well-known/oauth-authorization-server` — OAuth discovery
- `llms.txt` — LLM-friendly capability summary

---

## Values & Preferences

Users and businesses can opt into values that matter to them.

**Key Features:**
- **Profit sharing** — Open to fair profit-sharing arrangements
- **Ethical sourcing** — Prefer ethically-sourced businesses
- **Community first** — Support community-focused businesses
- **Environmental care** — Prefer eco-friendly practices
- **Inclusive service** — Welcome all customers
- **Radical transparency** — Open about pricing and policies
- **Custom values** — Add any personal values
- **Values alignment** — Booking shows if user and business share values

---

## Security & Trust

**Security Guard Rails:**
- API keys hashed at rest (SHA-256)
- Audit logging for all mutating operations
- Helmet with strict CSP, frameguard, referrer policy
- Rate limiting on all endpoints including MCP
- PTP signing secret required in production (no hardcoded fallback)
- Input validation and upload security
- CORS allowlist with production filtering

**Trust System:**
- 5 risk bands (A-E) with capability gating
- ZK threshold proofs (prove score >= threshold without revealing score)
- Financial guarantees for Band A/B users
- Onchain attestations for key events
- Trust audit trail with hash chain
- Social trust boost from verified connections

---

## Core Protocol Features

### Jev Decision Engine
All security and AI decisions use Jev — a decision-only model that's 400x cheaper and 200x faster than LLMs.

| Decision | What Jev Does |
|----------|---------------|
| Fraud detection | Flags suspicious transactions |
| Agent risk scoring | Rates carrier/tenant reliability |
| Payment routing | Chooses USDC vs PAB vs PKR |
| Recommendations | Suggests next features to users |
| Anomaly detection | Identifies unusual behavior |

### Pakistan Payments (Raast-First)
Pabandi uses Pakistan's national payment rail — **Raast** — for free, instant transfers. Falls back to JazzCash/EasyPaisa for mobile wallet users.

| Method | Cost | Integration |
|--------|------|-------------|
| Raast | FREE | QR code / phone number |
| JazzCash | 1% | Manual verification |
| EasyPaisa | 1% | Manual verification |

**Frictionless flow:** User clicks "Pay" → Sees Raast QR → Sends payment → Uploads screenshot → Admin verifies → PAB rewarded.

### Frictionless Payment Agent
Users NEVER see crypto. The agent handles all complexity:

| User Sees | Agent Does (Hidden) |
|-----------|---------------------|
| "Pay $25" | Converts USDC → PAB → Lock in escrow |
| "Balance: $500" | Calculates USDC + PAB value at DEX rate |
| "5% PAB discount" | Auto-routes payment through DEX |
| "Trust score: Gold" | Manages staking lock, calculates APY |

### $PAB Token & DEX
- **Token:** SPL token on Solana mainnet (mint: `G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y`)
- **Pool:** PAB/USDC pair on Raydium
- **Staking:** Bronze/Silver/Gold/Platinum tiers with APY
- **Rewards:** Earn $PAB for bookings, check-ins, and referrals
- **Discounts:** 5% off when paying with PAB

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TailwindCSS, TypeScript |
| **Backend** | Node.js, Express, Prisma ORM, PostgreSQL |
| **AI** | Jev (TypeSafe) for decisions, 400x cheaper than LLMs |
| **Blockchain** | Solana, Anchor, Raydium DEX |
| **Payments** | Raast, JazzCash, EasyPaisa, PayLio, Square |
| **Deployment** | Firebase Hosting (client), Render (server) |

---

## Live Platform

- **Production App:** [https://pabandi.com](https://pabandi.com) (or `https://pabandi-42c5b.web.app`)
- **Backend API:** `https://pabandi.onrender.com`

### Deploy (one command)
```bash
./deploy.sh            # build client + deploy SPA to Firebase Hosting
./deploy.sh --push     # also git push origin main (triggers Render API rebuild)
```

Manual equivalent:
```bash
cd client && npm run build
firebase use pabandi-42c5b && firebase deploy --only hosting
```

After deploy, hard-refresh `pabandi.com` (Cmd/Ctrl+Shift+R). The SPA shell is served `no-cache`, so it reflects instantly.

---

## Quick Start (Local Development)

### 1. Clone the Repository
```bash
git clone https://github.com/jweezy119/Pabandi.git
cd Pabandi
```

### 2. Backend Setup
Ensure you have PostgreSQL running locally or update the `DATABASE_URL` in your `.env` file.

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Frontend Setup
In a new terminal window:
```bash
cd client
npm install
npm run dev
```

The application will be available at `http://localhost:5500` or `http://localhost:3000`.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for full terms.

Built with ❤️ for the builders, creators, and service providers of the world.

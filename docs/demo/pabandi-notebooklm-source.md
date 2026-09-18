# Pabandi — Demo Brief & Source Document
## For NotebookLM + Visual Generation

---

## 1. Product Overview

**Pabandi** is a trust-and-commitment layer for the informal economy. It combines discovery, booking, Sharia-compliant profit sharing (Mudarabah), and on-chain escrow payments into one platform.

**Core value proposition:**
- Businesses reduce no-shows with deposit escrow
- Customers earn rewards for showing up
- Investors earn real profit from real business revenue (no interest, no speculation)
- Landlords manage properties without spreadsheets

---

## 2. User Personas & Journeys

### Persona A: Aisha — Restaurant Owner
**Problem:** No-shows cost her $50/seat. She uses Instagram for booking. No deposit system. No CRM.

**Pabandi Journey:**
1. Claims her restaurant on Pabandi (free, instant)
2. Creates a booking page with $25 deposit escrow
3. Customer pays via card (PayLio) or USDC
4. On check-in, funds release to her wallet (USDC on Polygon, visible in Phantom)
5. She earns 1% platform fee from investors who funded her expansion pool
6. Star Power: top reviewers get promos, filling slow nights

**Demo flow:** Claim business → Set deposit → Customer pays → Check-in → Funds released

---

### Persona B: Bilal — Customer
**Problem:** He books tables, sometimes cancels last minute. Wants rewards for loyalty. Wants to invest in local businesses.

**Pabandi Journey:**
1. Discovers restaurants on Sitara (map-based, geo-aware)
2. Books a table, pays $25 deposit via card (PayLio checkout)
3. Checks in at the restaurant → earns Star Power points
4. His deposit is released to the restaurant
5. Invests $500 in a Mudarabah pool for a local cafe
6. Earns 8% APY from real cafe revenue (profit-sharing, not interest)

**Demo flow:** Browse map → Book table → Pay deposit → Check-in → Earn rewards → Invest in pool

---

### Persona C: Sana — Landlord / Property Manager
**Problem:** Manages 12 units. Uses spreadsheets + Zelle. No tenant screening. No maintenance tracking. Late payments.

**Pabandi Journey:**
1. Enrolls as property manager (free CRM)
2. Adds properties, units, tenants
3. Sets up rent collection with late fees and grace periods
4. Screens tenants via free CourtListener background check
5. Tenants pay rent → funds held in escrow
6. On lease completion, deposit released or refunded
7. Maintenance requests with priority routing

**Demo flow:** Enroll → Add property → Add tenant → Screen tenant → Collect rent → Track maintenance

---

### Persona D: Tariq — Investor
**Problem:** Wants Sharia-compliant investments. Tired of "halal" fintech that still uses riba. Wants transparency.

**Pabandi Journey:**
1. Completes investor profile (preferences: risk, APY, location)
2. AI matching engine recommends pools: "Chicago restaurants, 8% APY, 70/30 split"
3. Invests $1,000 in a Mudarabah pool via USDC
4. Sees real revenue → profit → distribution on-chain
5. Pool creator distributes profits monthly
6. Tariq receives his share in USDC to his Phantom wallet

**Demo flow:** Set preferences → AI matches → Invest USDC → Track distributions → Withdraw

---

## 3. Technical Architecture

### Payment Rails (All No-Verification)
| Rail | Provider | Type | Fee |
|------|----------|------|-----|
| Card → USDC | PayLio | Fiat on-ramp | 2.9% + $0.30 |
| USDC on Solana | Solana | Crypto | ~$0.01 |
| Bitcoin/Lightning | BTCPay | Crypto | Network fee |
| Manual | Manual | Cash/Transfer | Free |

### Escrow State Machine
```
PENDING → HELD → RELEASED
              ↘ REFUNDED
              ↘ DISPUTED
```

### On-Chain (Solana Anchor Program)
- 5 instructions: create_escrow, fund_escrow, release_funds, refund_funds, raise_dispute
- PDA-based escrow accounts (self-custodial)
- Reference-based PDA derivation from order/booking ID

---

## 4. Feature Modules

### Sitara OS (Discovery + Booking)
- Map-based business discovery (OpenStreetMap/Nominatim)
- Real-time geo-distance calculation
- Booking flow with deposit escrow
- Check-in verification (GPS + QR)
- Star Power rewards system
- Guest lists with attribution tracking
- Promoter dashboard

### Mudarabah (Profit Sharing)
- Business creates investment pool via 6-step wizard
- AI matches investors to pools
- Profit calculation: revenue → profit → distribution
- All on-chain (USDC) or manual confirmation
- Sharia transparency page (show the math)

### Property Manager CRM
- Properties, units, tenants, leases
- Rent payment tracking
- Maintenance request management
- Tenant screening (CourtListener — free)
- White-label tenant portal

### Admin Dashboard
- Users, businesses, reservations, properties
- Verify businesses, manage roles
- AI matching stats
- Payment/escrow oversight

---

## 5. Key Metrics to Demo

| Metric | Value |
|--------|-------|
| Payment verification | None required |
| Card processing | PayLio (fiat → USDC) |
| Platform fee | 1% creation + 1% release |
| APY range | 5-15% (Mudarabah pools) |
| Transaction cost | $0.01 (Solana) to 2.9% (card) |
| Time to settle | 400ms (Solana) to 3 days (card) |

---

## 6. Visual Prompts for Image Generation

Use these prompts with any AI image generator (Midjourney, DALL-E, Canva AI, etc.):

### Prompt 1: Hero / Landing Page
"Modern dark-themed fintech app landing page, neon green and purple gradients, Middle Eastern and South Asian aesthetic, trust and commitment messaging, mobile-first design, glassmorphism cards, Solana and USDC branding, tagline: Commitment, Secured., professional UI/UX, 2025 design trends"

### Prompt 2: Booking Flow
"Mobile app screens showing restaurant booking flow, dark theme, deposit escrow indicator, USDC and card payment options, check-in QR code, star reward animation, modern fintech UI, emerald accent colors"

### Prompt 3: Mudarabah Dashboard
"Investment dashboard showing profit-sharing pools, 8% APY display, 70/30 split visualization, revenue-to-profit-to-distribution flow chart, Sharia compliance badge, transparent math breakdown, dark theme with gold accents"

### Prompt 4: Map Discovery
"Mobile map interface showing nearby restaurants, OpenStreetMap tiles, distance indicators, Star Power badges, deposit amounts, category filters, location-aware search, modern map UI"

### Prompt 5: Property Manager CRM
"Dashboard for property manager showing 12 units, rent collection status, maintenance requests, tenant risk bands, lease tracking, dark theme, professional SaaS aesthetic, data-dense but clean"

### Prompt 6: AI Matching
"AI matching interface showing investor preferences on left, recommended pools on right, match percentage scores, category/risk/location fit factors, transparent scoring breakdown, modern AI UI aesthetic"

### Prompt 7: Wallet Integration
"Phantom wallet integration screen, USDC on Polygon, payment QR code, transaction history, balance display, escrow status indicators, dark theme with Solana purple and Polygon purple"

### Prompt 8: Admin Dashboard
"Admin dashboard showing platform overview, total users, businesses, reservations, escrow volumes, payment status, AI matching stats, dark theme, enterprise SaaS aesthetic, data visualization"

---

## 7. NotebookLM Query Prompts

After uploading this document to NotebookLM, use these queries:

1. "Explain Pabandi's value proposition to a restaurant owner in 3 sentences"
2. "What are the 3 main user journeys and how do they intersect?"
3. "How does the Mudarabah profit-sharing work step by step?"
4. "Compare Pabandi's payment rails to Stripe — what are the advantages?"
5. "Write a 30-second elevator pitch for an investor"
6. "What makes Pabandi Sharia-compliant vs other fintech?"
7. "Explain the escrow state machine with examples"
8. "What are the top 3 objections a landlord would have and how does Pabandi address them?"

---

## 8. Demo Script (2 minutes)

**[0:00-0:15] Hook**
"Every year, no-shows cost small businesses billions. Customers have no skin in the game. Pabandi fixes that with escrow-backed bookings, crypto payments, and profit-sharing investments."

**[0:15-0:45] Sitara OS Demo**
"Discover restaurants on a map. Book a table. Pay a $25 deposit via card or USDC. Check in at the venue. The deposit releases to the business. You earn Star Power for showing up."

**[0:45-1:15] Mudarabah Demo**
"Businesses create investment pools. AI matches investors to opportunities. $1,000 invested in a local cafe earns 8% from real revenue. Profits distributed on-chain monthly. No interest. No speculation. Real business value."

**[1:15-1:45] CRM Demo**
"Landlords manage properties without spreadsheets. Screen tenants for free. Track rent, maintenance, deposits. White-label portal for tenants."

**[1:45-2:00] Close**
"Pabandi: Commitment, Secured. Launching now. No business verification needed. No Stripe needed. Just Solana + USDC + trust."

---

## 9. Competitive Positioning

| Feature | Pabandi | Jobber | HubSpot | Stripe |
|---------|---------|--------|---------|--------|
| Booking escrow | ✅ | ❌ | ❌ | ❌ |
| Profit-sharing pools | ✅ | ❌ | ❌ | ❌ |
| Property CRM | ✅ | ❌ | ❌ | ❌ |
| On-chain payments | ✅ | ❌ | ❌ | ❌ |
| Sharia compliance | ✅ | ❌ | ❌ | ❌ |
| No business verification | ✅ | ❌ | ❌ | ❌ |
| Price | Free + fees | $35/mo | $45/mo | 2.9%+30¢ |

---

## 10. Call to Action

**For NotebookLM podcast generation:** Upload this document and ask "Create a 5-minute podcast explaining Pabandi to a potential investor"

**For visual demo:** Use the prompts above with Midjourney/DALL-E to generate hero images

**For pitch deck:** Ask NotebookLM to "Generate a 10-slide pitch deck outline from this document"

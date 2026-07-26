# Pabandi: The Decentralized Trust & Escrow Ecosystem

![Pabandi Banner](https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=2000&h=600)

**Pabandi** is an algorithmic, Sharia-compliant Open Finance Agent and Trust Protocol. While traditional exchanges (like Binance P2P or Bybit) force users into slow, manual C2C arbitration for fiat off-ramping, Pabandi provides a Zero-UI, API-first **B2B settlement layer**. By integrating directly with real-time domestic clearing webhooks (like Pakistan's Raast) and employing Agentic AI for fallback vision verification, Pabandi achieves instant 0-second atomic settlements between global stablecoins (USDC/Solana) and local fiat rails.

In markets where digital trust is low, legacy escrow creates too much friction. Pabandi bridges this gap by acting as an impartial, automated, and decentralized middleman. Liquidity Providers (LPs) earn a passive, **Mudarabah-compliant Halal yield** strictly from real trade execution spreads—never interest (Riba).

From deep Shopify integrations to Live Selling widgets and WhatsApp AI concierges, Pabandi is not just a destination app—it is a B2B integration wedge designed to be embedded directly into the checkouts merchants already use every single day.

---

## 🌟 The Pabandi Vision & Architecture

Pabandi operates on three core pillars:
1. **Agentic Escrow & Settlement (0-Second Clearing)**: Securing funds via Multi-chain (BTC, Solana) smart contracts and utilizing Agentic AI to parse real-time Raast/Easypaisa webhooks (or Qwen-VL vision fallbacks) for instant fiat-to-crypto release.
2. **Mudarabah Halal Staking**: A purely Sharia-compliant liquidity pool where LPs earn yield from active B2B trade spreads, completely eliminating Riba (interest).
3. **The Omni-Channel Wedge**: Delivering Pabandi’s functionality directly to where transactions happen (Shopify, WhatsApp, TikTok Live) via frictionless SDKs and embeddable widgets, skipping the need for standalone apps like Binance P2P.

---

## 🚀 Core Features

### 1. Escrow Smart Contract (Multi-chain)
The core of Pabandi is a lightning-fast, gas-efficient escrow mechanism built on multi-chain infrastructure (BTC, Solana, BNB, ETH, Stellar). When a customer books a service or buys a product, their funds are locked securely in an un-upgradable smart contract. Funds are released automatically only upon successful mutual fulfillment. This instantly eliminates no-shows for service providers and eliminates product fraud for e-commerce buyers.

### 2. Multi-Vertical Trust Protocol (Passport V2)
Pabandi assigns every user and business a dynamic Trust Score (Pabandi Passport) based on their historical behavior across the network.
- **Vertical-Specific Scoring:** A user might have a 95 Trust Score in Hospitality but a 40 in E-Commerce. Scores are siloed to reflect contextual reliability.
- **Asymmetric Decay:** Trust takes months of successful transactions to build, but is lost rapidly upon a single dispute or scam attempt. This ensures the Passport remains a highly reliable indicator of consumer and merchant intent.

### 3. Decentralized Peer Jury (Dispute Resolution)
If an escrow transaction goes wrong (e.g., the product was broken, or the buyer is attempting friendly fraud), Pabandi leverages a decentralized Peer Jury system rather than centralized support agents.
- Highly-ranked community members (Jurors) review evidence and vote to resolve disputes.
- Consensus (3 matching votes) slashes the Trust Score of the malicious party and distributes the escrowed funds appropriately, while rewarding the jurors for their time.

### 4. Zero-Config Shopify Native Integration
Pabandi serves as a powerful B2B integration for e-commerce stores, seamlessly wedging into the Shopify ecosystem.
- **Embedded Admin Dashboard:** Merchants manage their Pabandi escrow orders and view their overall Trust Score directly inside their native Shopify Admin panel.
- **Storefront Widget SDK:** A copy-paste Javascript snippet (`shopify-widget.js`) allows merchants to inject the Pabandi Trust Badge and Escrow Checkout button directly onto their Shopify product pages without requiring a complex App Store review.
- **Order Intercept:** Pabandi intercepts the checkout, secures the funds in escrow, and uses webhooks to instantly push a "Paid" order back into the merchant's Shopify dashboard.

### 5. Live Selling Hub & Conversational Commerce
Pabandi transforms high-energy live streams and chat interactions into instant, trusted commerce.
- **Universal Escrow Checkout:** A single, frictionless link (`pabandi.com/s/:id?mode=instant`) that sellers can drop into TikTok Live, YouTube Shopping, Instagram, or Amazon Live.
- **WhatsApp AI Agent:** Built-in LLM integration powers a conversational agent that detects purchase intent via chat and automatically generates secure Escrow checkout links for customers over WhatsApp.
- **Social Proof Receipts:** Upon a successful checkout, the platform generates a beautiful DOM-based receipt card that buyers can one-click share to WhatsApp, creating a viral loop.

### 6. Universal Hospitality APIs
Pabandi offers seamless synchronization for property managers and hotels worldwide, replacing outdated deposit models.
- **PMS Sync:** Connects directly with leading Property Management Systems including Channex, Beds24, Cloudbeds, Lodgify, Hostaway, and Guesty.
- **Escrow-Backed Stays:** Replaces standard credit card holds and hotel deposits with smart, verifiable escrow check-ins, fully integrated with the property's booking calendar.

### 7. AI Concierge & Voicebox Automation
A multimodal, context-aware AI widget designed for custom business websites.
- **Voice & Chat:** Handles inbound customer inquiries 24/7 using advanced, human-like voice synthesis and conversational AI.
- **Direct Booking Routing:** The AI understands the customer's scheduling needs, checks availability, and routes them directly to a secure Pabandi escrow checkout link.

### 8. Collateralized Micro-Loans
Because Pabandi Trust Scores are highly accurate predictors of reliability, the platform offers 0-interest, flat-fee micro-loans.
- Loans are strictly collateralized against locked platform tokens (`$PAB`).
- Loan-to-Value (LTV) limits are dictated dynamically by the user's Pabandi Trust Score (e.g., a 90+ score unlocks an 80% LTV).

### 9. Token Liquidity & DEX Integration
Deep liquidity and seamless off-ramps for the $PAB ecosystem token.
- **Raydium Integration:** Instant swaps between $PAB and SOL/USDC on Solana's leading decentralized exchange.
- **Liquidity Pools:** Transparent, on-chain economics with yield farming rewards for community liquidity providers.

---

## 🛠️ Tech Stack

- **Frontend Ecosystem:** React 18, Vite, TailwindCSS, TypeScript, Zustand, React Query
- **Backend Infrastructure:** Node.js, Express, Prisma ORM, PostgreSQL
- **Blockchain & Web3:** Multi-chain (BTC, Solana, BNB, ETH, Stellar), Ethers.js, Solana Web3.js
- **Integrations:** Shopify Admin API, Twilio/WhatsApp API, Google Maps, Firebase Authentication
- **Cloud & Deployment:** Google Cloud Run (Backend API), Firebase Hosting (Frontend SPA)

---

## 🌐 Live Platform

- **Production App:** [https://pabandi.com](https://pabandi.com) (or `https://pabandi-42c5b.web.app`)
- **Backend API:** `https://pabandi-backend-97129395003.asia-south1.run.app`

---
- **CoCreate 2026 Judge Quick Start**
  - Open `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666`
  - If that business ID isn’t seeded, open any valid `/business/:id` from admin or search.
  - Use **Claim Listing** → WhatsApp claim overlay
  - Use **Pay with Tap** → hosted checkout
  - Use **Payment Link Card** → copy/share checkout on WhatsApp
  - Open **Passport Dashboard** → trust score + category axes
- **Submission Artifacts (on deadline)**
  - README judge summary + quick start + live links
  - Pitch deck + generation scripts in `marketing/`
  - Migration SQL + deploy runbook in `COCREATE_DEPLOY.md`
- **Live Health**
  - Backend health: `https://pabandi-backend-97129395003.asia-south1.run.app/health`
  - Backend docs: `https://pabandi-backend-97129395003.asia-south1.run.app/api/docs`
- **Pre-Submission Checklist**
  - Run locally:
    - `cd server && npm run build`
    - `cd client && npm run build`
  - Live health:
    - `curl -I https://pabandi-backend-97129395003.asia-south1.run.app/health`
    - `curl -I https://pabandi-backend-97129395003.asia-south1.run.app/api/docs`
  - Browser smoke test:
    - Open `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666`
    - Confirm profile, claim CTA, and checkout surfaces load
- **60-Second Judge Verify**
  - Mobile: open `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666`
  - Open `/passport/dashboard` while logged in to review the AI risk score dashboard
  - Tap `Claim Listing` → confirm WhatsApp claim overlay opens
  - Open `JUDGE.md` and `COCREATE_DEPLOY.md` from repo root

## 👨‍💻 Quick Start (Local Development)

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/jweezy119/Pabandi.git
cd Pabandi
\`\`\`

### 2. Backend Setup
Ensure you have PostgreSQL running locally or update the `DATABASE_URL` in your `.env` file.
\`\`\`bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
\`\`\`

### 3. Frontend Setup
In a new terminal window, spin up the Vite development server.
\`\`\`bash
cd client
npm install
npm run dev
\`\`\`
The application will be available at `http://localhost:5500` or `http://localhost:3000`.

---

## 🤝 Contributing & License
Pabandi was built with rapid iteration in mind. Contributions are welcome via pull requests. 
This project is licensed under the MIT License. See [LICENSE](./LICENSE) for full terms.

Public-good modules: see [docs/PUBLIC_GOOD.md](./docs/PUBLIC_GOOD.md).

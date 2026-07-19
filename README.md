

---

## 🚀 Features

### 1. Escrow Smart Contract 
The core of Pabandi is a lightning-fast escrow mechanism. When a customer books a service or buys a product, their funds are locked securely in escrow. Funds are released only upon successful fulfillment, instantly solving no-shows and fraud.

### 2. Multi-Vertical Trust Protocol (V2)
Pabandi assigns every user a dynamic Trust Score based on their on-chain behavior. 
- **Vertical-Specific Scoring:** Scores are tracked separately across E-Commerce, Hospitality, Appointments, and Freelance.
- **Asymmetric Decay:** Trust takes longer to build and is lost faster for bad actors, providing a heavily reliable indicator of consumer intent.

### 3. Decentralized Peer Jury (Dispute Resolution)
If an escrow transaction goes wrong, Pabandi leverages a decentralized Peer Jury system. 
- Highly-ranked community members (Jurors) vote to resolve disputes.
- Consensus (3 votes) slashes the Trust Score of the loser and rewards the jurors.

### 4. Collateralized Micro-Loans
Because Trust Scores are highly accurate, Pabandi offers 0-interest, flat-fee micro-loans. 
- Loans are strictly collateralized against locked tokens (`PAB`).
- Loan-to-Value (LTV) limits are dictated dynamically by the user's Pabandi Trust Score (e.g., 90+ score unlocks 80% LTV).

### 5. Shopify Native Integration Mastery
Pabandi isn't just an app; it's a B2B integration.
- **Embedded Admin Dashboard:** Shopify merchants can manage their Escrow orders and view their Trust Score directly inside Shopify Admin.
- **Storefront Widget SDK:** A native Javascript SDK (`shopify-widget.js`) allows merchants to inject the Pabandi Trust Badge onto their product pages, instantly boosting buyer confidence.
- **Order Intercept:** Pabandi intercepts Shopify Carts, handles the Escrow, and uses Webhooks to officially push the Paid Order back into the merchant's Shopify dashboard.

### 6. Live Selling Hub & Conversational Commerce
Pabandi transforms live streaming and chat into instant, trusted commerce.
- **Universal Escrow Checkout:** A single link (`/s/:id?mode=instant`) that sellers can drop in TikTok, YouTube, Shopify, eBay, Amazon, Instagram, and Custom Web live streams.
- **Platform Ready:** Direct OAuth mapping for all platforms to manage inventory and capture trusted sales through Pabandi Escrow.
- **WhatsApp AI Agent:** Integrated LLMs power a conversational agent that detects purchase intent and automatically generates secure Escrow checkout links for customers over WhatsApp.

### 7. Universal Hospitality APIs
Seamless sync for property managers and hotels worldwide.
- **PMS Sync:** Connects directly with Channex, Beds24, Cloudbeds, Lodgify, Hostaway, and Guesty.
- **Escrow-Backed Stays:** Replaces standard hotel deposits with smart, verifiable escrow check-ins and check-outs.

### 8. AI Concierge & Voicebox Automation
A multimodal, context-aware AI widget for custom websites.
- **Voice & Chat:** Handles inbound inquiries 24/7 with human-like voice or text capabilities.
- **Direct Booking Routing:** Understands customer needs and routes them to secure escrow links instantly.

### 9. Token Liquidity & DEX
Deep liquidity and seamless off-ramps for the $PAB reward token.
- **Raydium Integration:** Instant swaps between $PAB and SOL/USDC on Solana's leading decentralized exchange.
- **Liquidity Pools:** Transparent, on-chain economics with rewards for community liquidity providers.

---

## 🛠️ Tech Stack

- **Frontend:** React + Vite, TailwindCSS, TypeScript, Zustand (Live on Firebase Hosting)
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL (Deployed to GCP Cloud Run)
- **Blockchain:** Solidity ^0.8.20 
- **APIs:** Native Shopify Checkout Webhooks & OAuth

---

## 🌐 Live Demo

- **Main Platform:** [https://pabandi-42c5b.web.app](https://pabandi-42c5b.web.app)
- **Backend API Docs:** `https://pabandi-backend-97129395003.asia-south1.run.app`

---

## 👨‍💻 Quick Start (Local Development)

### 1. Backend Setup
\`\`\`bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
\`\`\`

### 2. Frontend Setup
\`\`\`bash
cd client
npm install
npm run dev
\`\`\`

---

## 📄 License
MIT

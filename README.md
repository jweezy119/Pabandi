# Pabandi: The Decentralized Trust & Escrow Ecosystem

![Pabandi Banner](https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80&w=2000&h=600)

**Pabandi** is a comprehensive, dual-engine agentic Trust Protocol and Smart Contract Escrow platform. Originally designed to eliminate Cash on Delivery (COD) fraud, booking no-shows, and high-friction commerce risks globally—with a strategic initial focus on emerging markets like Pakistan—Pabandi has evolved into a universal trust layer for the modern internet.

In markets where digital trust is low, consumers default to Cash on Delivery, leading to massive return rates, logistical nightmares, and cash flow bottlenecks for merchants. Conversely, in the service industry, no-shows devastate local businesses. Pabandi bridges this gap by acting as an impartial, automated, and decentralized middleman. By locking funds in secure escrow and assigning dynamic, on-chain Trust Scores to all participants, Pabandi guarantees that buyers receive exactly what they paid for, and sellers are guaranteed their money when they deliver.

From deep Shopify integrations to Live Selling widgets and WhatsApp AI concierges, Pabandi is not just an application—it is a B2B integration wedge designed to be embedded directly into the tools merchants already use every single day.

---

## 🌟 The Pabandi Vision & Architecture

Pabandi operates on three core pillars:
1. **The Escrow Engine**: Securing funds via Multi-chain (BTC, Solana, BNB, ETH, Stellar) smart contracts until fulfillment conditions are met.
2. **The Trust Protocol (Passport)**: A dynamic, vertical-specific reputation system that rewards good actors and severely penalizes bad ones.
3. **The Omni-Channel Wedge**: Delivering Pabandi’s functionality directly to where transactions happen (Shopify, WhatsApp, TikTok Live, custom hotel websites) via frictionless SDKs and embeddable widgets.

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
This project is licensed under the MIT License.

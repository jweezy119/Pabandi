# Pabandi - Agentic AI Booking Ecosystem

> **Official Entrant: Alibaba CoCreate 2026 Pitch Competition**
> 
> Pabandi is positioned for the "Agentic Business" track, demonstrating how AI agents can autonomously manage front-desk operations, predict no-shows, and secure revenue for SMEs globally.

Pabandi is an Agentic AI booking ecosystem built for the modern service economy. For businesses, our autonomous AI agent actively protects your bottom line by predicting no-shows and negotiating dynamic, risk-based deposits. For customers, we offer a seamless booking journey powered by a next-generation Web3 loyalty program. Arrive for your appointment, and you earn PAB tokens—digital assets that hold real value, redeemable for future services or transferable to your personal crypto wallet.

## 🎯 Features

- **Translucent Neony Design**: A highly premium, frosted-glass interface featuring a dark slate base, high-blur glass surfaces, and glowing neon accents (cyan, mint, pink) for maximum modern appeal.
- **Solana Web3 Integration**: Native Solana blockchain integration. Users automatically earn **Pabandi Reliability Tokens (PAB)** dropped directly to their Phantom/Solflare wallets for every successful booking and check-in.
- **AI Reliability Score**: Proprietary ML models analyze user booking histories, location context, and time variables to generate a dynamic "no-show risk score." High-risk users are dynamically prompted for upfront deposits.
- **Seamless Maps Integration**: Integrated Google Maps embedded directly into the marketing site and reservation dashboards to discover and visualize real-time local business data.
- **Business Management**: Complete business registration, webhook integrations, and native CRM synchronization (Odoo JSON-RPC and Cal.com).
- **Enterprise API & SDK**: Full Pay-As-You-Go developer API with a native `@pabandi/sdk` for Node.js/TypeScript, allowing drop-in access to the Trust Matrix and Solana Escrow.
- **Customer Experience**: Dedicated portals for customers to track bookings, manage their Pabandi Web3 Wallet, and earn crypto rewards for reliable behavior
- **Payment Integration**: Secure fiat processing via **Stripe** (US cards, Apple Pay, Google Pay) with **Safepay** retained as a secondary gateway, plus native **Web3 Crypto Payments**
- **Automated Reminders**: SMS and email notifications to reduce no-shows
- **Analytics Dashboard**: Real-time insights into booking patterns, revenue, and crypto rewards

## 🏗️ Architecture

- **Backend**: Node.js + Express.js + TypeScript
- **Frontend**: React + TypeScript + TailwindCSS
- **Database**: PostgreSQL with Prisma ORM
- **AI/ML**: TensorFlow.js for no-show prediction models
- **Authentication**: JWT-based authentication & Google/Facebook OAuth
- **Payments**: Safepay (Fiat) & Ethers.js/Solana Web3.js (Crypto)
- **Notifications**: Twilio SMS + SendGrid Email + Outbound Webhooks

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis (for caching and sessions)

### Installation

```bash
# Install all dependencies
npm run install:all

# Set up environment variables
cp server/.env.example server/.env
cp client/.env.example client/.env

# Run database migrations
npm run migrate

# Seed initial data (optional)
npm run seed

# Start development servers
npm run dev
```

The application will be available at:
- **Public site (Firebase)**: [https://pabandi-42c5b.web.app/](https://pabandi-42c5b.web.app/)
- Frontend app (local dev): http://localhost:3000
- Backend API: http://localhost:5000

### Deploy the public marketing site

The live site is hosted on Firebase project **pabandi-42c5b** from the `site/` folder:

```bash
npm run deploy
```

This builds the dashboard app into `site/app/` and deploys the marketing site + app to Firebase.

**Required on Cloud Run** (API server): set `FRONTEND_URL=https://pabandi-42c5b.web.app/app` so Google/Facebook OAuth redirects back correctly.

Preview locally before deploying:

```bash
npm run site
```

## 📁 Project Structure

```
pabandi-booking-platform/
├── server/                 # Backend API
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation, etc.
│   │   ├── utils/          # Helper functions
│   │   └── ai/             # AI/ML models
│   └── prisma/             # Database schema and migrations
├── client/                 # Frontend React app
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services
│   │   └── utils/          # Utilities
└── docs/                   # Documentation
```

## 🔐 Security & Compliance

This application is designed with strict regulatory and religious compliance in mind:
- **Sharia Compliance (Hibah Model)**: The traditional "Staking APY" model has been completely replaced with a Sharia-compliant "Community Loyalty Pool." Users earn fixed *Hibah* (gifts) based on their real-world reliability score, avoiding *Riba* (interest).
- **KYC/AML Compliance**: Strict identity verification (Email & Phone KYC) is required before any user can withdraw $PAB to their decentralized Solana wallet, protecting the ecosystem from bad actors.
- **Data Protection**: Aligned with CCPA (California Consumer Privacy Act) and GDPR-like rights.
- **Payment Security**: PCI-DSS compliant payment processing via Stripe.

## 🪙 $PAB Tokenomics & Blockchain Security

The Pabandi Reliability Token ($PAB) is natively deployed on the **Solana** blockchain with strict, immutable security guarantees to protect our community and investors:

- **100% Non-Mintable**: The Mint Authority has been permanently revoked (`2N8w8D7UQeMiLXTAfMTb15aUAYVHePKqufrvXjL74kdCzjqiBnS3cGeAv9jxutT7RKBGfMLf7TC8R1tNHiVXdSQ8`). The supply is hard-capped at exactly **1 Billion $PAB**.
- **100% Non-Freezable**: The Freeze Authority has been permanently revoked (`5a3AkREb4tc66BKnjhcCP2niVSsWqQy9RcYRBkiDY92YKXEBfYWa2ofCppZJMcDiLR5zUWYLBGoVzgLe8tePTjwR`). No entity can ever lock or seize user wallets.
- **Liquidity Locked Forever**: The initial Liquidity Pool (LP) tokens on Raydium have been **permanently burned** (`48Kc38iyKR6ERUZGcjWqsWrfnj6p8UWYhRzZXxUWk5AfvzJyWYZiVqJEfp7pArpoKX3rvYhAd7hzHEYQT31RtN1R`), ensuring the liquidity can never be drained (Un-ruggable).
- **Token Contract**: `Cc2nwBNc8Zo5e6QwmtV3JQfEi2gTfEYNrDGgxPmGaZLZ`

## 🤖 Agentic AI Features

The platform deploys an autonomous AI agent to:
- Predict no-show probability for each reservation
- Calculate a real-time risk score based on customer reliability, weather, time, and historical data
- Automatically negotiate and enforce dynamic deposit amounts for high-risk bookings
- Identify patterns in booking behavior to optimize table turnover autonomously

## 💰 Payments Ecosystem

Pabandi features a robust payment architecture:
1. **Stripe Integration**: Handles standard fiat transactions for the US market — credit/debit cards, Apple Pay, and Google Pay. 
2. **Safepay Integration**: Retained as a secondary gateway supporting local Pakistani payment methods (Credit/Debit, JazzCash).
3. **Web3 Crypto Integration**: Customers connect their Phantom (Solana) wallets to the platform to track their Hibah rewards and execute high-speed, low-cost crypto withdrawals.

## 📱 API Documentation

API documentation is available at `/api/docs` when the server is running.

## 🤝 Contributing

This is a proprietary application. For inquiries, please contact the development team.

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

For support and inquiries, please contact the development team.

---
**Built for Global SMEs 🌍**

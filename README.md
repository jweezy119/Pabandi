# Pabandi - AI-Powered Reservation System

Pabandi is an AI-powered booking ecosystem built for the modern service economy. For businesses, we actively protect your bottom line by using AI to predict no-shows and secure revenue upfront with dynamic, risk-based deposits. For customers, we offer a seamless booking journey powered by a next-generation Web3 loyalty program. Arrive for your appointment, and you earn PAB tokens—digital assets that hold real value, redeemable for future services or transferable to your personal crypto wallet.

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
karachi-booking-platform/
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

This application is designed with compliance in mind:
- **Data Protection**: Aligned with CCPA (California Consumer Privacy Act) and GDPR-like rights
- **Payment Security**: PCI-DSS compliant payment processing via Stripe
- **GDPR-like Features**: User data rights and privacy controls

## 🤖 AI Features

The platform uses machine learning to:
- Predict no-show probability for each reservation
- Calculate a real-time risk score based on customer reliability, weather, time, and historical data
- Automatically enforce dynamic deposit amounts (via Safepay) for high-risk bookings
- Identify patterns in booking behavior to optimize table turnover

## 💰 Payments & Crypto Ecosystem

Pabandi features a dual-payment architecture:
1. **Stripe Integration**: Handles standard fiat transactions for the US market — credit/debit cards, Apple Pay, and Google Pay. Deposits are captured via Stripe Checkout Sessions.
2. **Safepay Integration** *(Pakistan market)*: Retained as a secondary gateway supporting local Pakistani payment methods (Credit/Debit, JazzCash).
3. **Web3 Crypto Wallet**: Customers can connect their MetaMask (BNB Smart Chain) or Phantom (Solana) wallets to the platform. They earn `$PAB` token rewards for successful check-ins and verified Google reviews, driving loyalty through decentralized incentives.

## 📱 API Documentation

API documentation is available at `/api/docs` when the server is running.

## 🤝 Contributing

This is a proprietary application. For inquiries, please contact the development team.

## 📄 License

MIT License - See LICENSE file for details

## 📞 Support

For support and inquiries, please contact the development team.

---
**Built with ❤️ for businesses across the United States 🇺🇸**

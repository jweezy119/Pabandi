# Pabandi: The Settlement & Trust Layer for the Agent Economy

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-14F195.svg)](https://solana.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Pabandi** is an open-source, programmable settlement layer that enables AI Agents to safely hire humans, and humans to hire AI Agents. We provide the missing trust infrastructure for the machine economy: **non-custodial escrow, Session Abstraction (gasless micro-payments), verifiable data provenance (VCAP), and decentralized dispute resolution (Sulha).**

By bridging the $50B high-ticket human service economy with the rapidly growing A2A (Agent-to-Agent) marketplace, Pabandi ensures that *every* transaction is backed by verifiable reputation and mathematically guaranteed settlement.

---

## 🎯 Who is Pabandi for?

Choose your path:

| | **Path A: I run a service business** | **Path B: I build AI Agents** |
|:---|:---|:---|
| **What you get** | Zero-deposit bookings, no-show protection, CRM with escrow-guaranteed revenue | MCP server, x402 payments, Session budgets for M2M transactions |
| **Go to** | [/contact](/contact) | [/agents](/agents) |
| **Best for** | Service businesses, freelancers, agencies | AI developers, agent builders, M2M marketplace operators |

---

## 🔒 Core Primitives

Pabandi is built with enterprise-grade security: **Autonomy Boundaries** (capped session quotas), **Scoped Identity** (cryptographic agent passports), and **Intent Contracts** (VCAP hash verification before escrow release).

These three primitives ensure that every agent transaction is bounded, verified, and cryptographically attested — no funds move without verified intent, and no agent operates outside its assigned capability envelope.

---

## 🚀 Quickstart

### What is Pabandi?

Pabandi is a trust and settlement infrastructure for the agent economy. It lets AI agents and humans transact safely: funds are held in non-custodial escrow, identity is verified via Trust Passport, and disputes are resolved by Sulha AI arbitration with human escalation.

### 1. Clone and Install

```bash
git clone https://github.com/jweezy119/Pabandi.git
cd Pabandi
npm install
cd client && npm install
cd ../server && npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Set the required variables:

*   `DATABASE_URL` — PostgreSQL connection string
*   `JWT_SECRET` — random 64-character hex string
*   `SOLANA_RPC_URL` — Devnet or Mainnet
*   `SQUARE_ACCESS_TOKEN` — for fiat payments (optional)

### 3. Set Up the Database

```bash
cd server
npx prisma db push
npx prisma generate
```

### 4. Run the Development Servers

Terminal 1 (Backend):

```bash
cd server
npm run dev
```

Terminal 2 (Frontend):

```bash
cd client
npm run dev
```

The app will be available at http://localhost:5173.

---

## 🤖 Making Your First MCP Tool Call

Pabandi exposes an MCP (Model Context Protocol) server so AI agents can interact with the protocol natively.

List available tools:

```bash
curl -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call a tool (e.g., check a Trust Passport):

```bash
curl -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"pabandi_verify_passport","arguments":{"passportId":"your-passport-id"}}}'
```

Available tools include `pabandi_verify_passport`, `pabandi_m2m_post_project`, `pabandi_m2m_submit_bid`, and `pabandi_m2m_verify_delivery`.

---

## 🔒 Locking an Escrow via the API

Create an escrow that holds funds until service is delivered:

```bash
curl -X POST http://localhost:5000/api/v1/escrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-token>" \
  -d '{
    "amount": 500,
    "description": "Website design project",
    "payerId": "<client-user-id>",
    "payeeId": "<provider-user-id>"
  }'
```

Funds are locked in escrow and released only upon verified completion or dispute resolution via Sulha.

---

## 📚 Deep Architecture

For the deep technical architecture — ML efficiency theory, Jevons Paradox, compute energy taxes, the Iron Law, and ERC-7710 delegation — see [**docs/WHITEPAPER.md**](docs/WHITEPAPER.md).

---

## 📦 The PabandiOS Suite

Pabandi is a modular operating system with distinct interfaces:

| Module | Target User | Description |
| :--- | :--- | :--- |
| **ContactOS** | Businesses | CRM, pipeline, invoicing, escrow-guaranteed revenue |
| **BookingOS** | Consumers | Public booking engine, GPS-verified check-in release |
| **Agent Marketplace** | AI Agents & Devs | Bounties, bids, auto-verifiable M2M tasks |
| **TrustOS** | The Protocol | Trust Scores, VCAP, M2M API routing, Session Abstraction |

---

## 🤝 Contributing

We welcome contributions from AI researchers, Solana developers, and UI/UX designers.

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Please ensure your code passes `npm run build` and `npx tsc --noEmit` before submitting.

---

## 📄 License

Distributed under the MIT License. See LICENSE for more information.

Built with 🧱 in the USA and Pakistan.  
*Wada karo, inaam pao.* (Make a promise, earn a reward.)

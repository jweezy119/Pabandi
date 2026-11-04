# Pabandi: The Trust & Settlement Layer for the Agent Economy

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-14F195.svg)](https://solana.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)](https://www.prisma.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Pabandi** is an open-source, programmable settlement layer enabling AI Agents to safely hire humans, and humans to hire AI Agents. We provide the missing infrastructure for the machine economy: **non-custodial escrow, Session Abstraction (gasless micro-payments), verifiable data provenance (VCAP), and decentralized dispute resolution (Sulha).**

---

## 🏛️ Enterprise Security Architecture

Pabandi is built for high-stakes autonomous transactions. Our architecture is designed around three core pillars:

1. **Autonomy Boundaries:** Engineers configure capability envelopes and permission tiers. The harness uses "Session Abstraction" to intercept tool calls exceeding pre-allocated quotas, preventing runaway execution loops and unauthorized infrastructure modifications.
2. **Scoped Identity:** Security teams bind distinct cryptographic identities to agents (Trust Passports). The harness authenticates inter-agent requests and prevents unauthorized privilege escalation across cluster boundaries.
3. **Intent Contracts:** Developers formalize pre-execution schema contracts (via Zod). Before executing destructive operations or releasing escrow, the harness verifies post-condition invariants and matches payload checksums (VCAP hashes) against approved task specifications.

---

## 🧠 Core Primitives

*   **Agentic Escrow:** Programmable USDC escrow for A2A and Human-to-Agent deals.
*   **Yield-Bearing Deposits:** Locked funds earn safe Solana yield (via Kamino), split 50/50 between the client and the business.
*   **MCP Native:** A full Model Context Protocol server allowing agents to book humans, verify trust, and execute bids.
*   **Trust Passport:** A portable, non-transferable SBT on Solana that aggregates verified history and on-chain reputation.

---

## 🏗️ Tech Stack

*   **Frontend:** React (Vite), TailwindCSS, Framer Motion.
*   **Backend:** Node.js, Express, Prisma ORM.
*   **Database:** PostgreSQL.
*   **Blockchain:** Solana (Web3.js).
*   **Payments:** x402, Square, Solana Pay.

---

## 🚀 Getting Started (Local Development)

```bash
git clone https://github.com/jweezy119/Pabandi.git
cd Pabandi
npm install
cd client && npm install
cd ../server && npm install
```

```bash
cd server
cp .env.example .env
```

Set the required variables:

*   `DATABASE_URL` — PostgreSQL connection string
*   `JWT_SECRET` — random 64-character hex string
*   `SOLANA_RPC_URL` — Devnet or Mainnet
*   `SQUARE_ACCESS_TOKEN` — for fiat payments (optional)

```bash
cd server
npx prisma db push
npx prisma generate
```

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

## 🤝 Contributing

We welcome contributions from AI researchers and Solana developers. Please run `npm run build` and `npx tsc --noEmit` before submitting a PR.

1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 👤 About the Founder

Pabandi was founded by [Your Name], an IT specialist with over 8 years of experience solving complex infrastructure and security challenges for lean teams. Frustrated by the broken trust dynamics in the service economy — and the lack of secure infrastructure for autonomous AI agents — he shifted focus to AI/ML and Web3. Pabandi is the result: a platform built with customer obsession at its core, designed to make trust portable, programmable, and profitable for humans and machines alike.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

**Built with 🧱 in the USA and Pakistan.**
*Wada karo, inaam pao.* (Make a promise, earn a reward.)
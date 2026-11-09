# Pabandi (پابندی)
> **The trust and settlement layer for the service economy and autonomous AI agents.**  
> Portable trust passports, booking/deposit escrow, and a 23-tool Model Context Protocol (MCP) server.
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Anchor%20Escrow-9945FF?logo=solana)](https://solana.com)
[![MCP](https://img.shields.io/badge/MCP-23%20Tools-orange)](https://modelcontextprotocol.io)
[![Status](https://img.shields.io/badge/API-Live%20on%20Render-46E3B7)](https://pabandi.onrender.com/health)
---
## Overview
Small service businesses lose revenue every day to no-shows, unverified bookings, and payment disputes. Meanwhile, emerging autonomous AI agents lack neutral identity, reputation, and escrow primitives to transact safely with humans.
**Pabandi solves both:**
1. **Pabandi Trust Protocol (PTP):** Cryptographically signed reputation credentials and portable trust passports.
2. **Non-Custodial Escrow:** Programmable deposit and milestone locking on Solana Anchor (releases on verified completion).
3. **Agent Settlement & MCP:** A 23-tool Model Context Protocol server enabling any LLM or autonomous agent to discover businesses, verify counterparty trust, and settle conditional payments via x402 USDC.
---
## System Architecture
```text
       [ AI Agents / MCP Clients ]              [ Web Clients (SMEs & Consumers) ]
                   │                                             │
                   ▼                                             ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                  Pabandi Core API (Node / Express / Prisma)            │
   │  • PTP Cryptographic Attestations      • Booking & Service Management  │
   │  • x402 USDC Payment Headers           • Sulha Dispute Evidence Engine │
   └──────────────────┬──────────────────────────────────────────┬──────────┘
                      ▼                                          ▼
     ┌───────────────────────────────────┐    ┌──────────────────────────────────┐
     │    Solana Anchor Escrow Program   │    │      PostgreSQL (Prisma ORM)     │
     │   Non-custodial milestone release │    │  Business directory & audit log │
     └───────────────────────────────────┘    └──────────────────────────────────┘
```
---
## Quickstart for Agents (One-Curl Onboarding)
Register an agent and get an API key instantly:
```bash
curl -X POST https://pabandi.onrender.com/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentHandle": "my-service-agent",
    "ownerEmail": "owner@example.com",
    "name": "My Service Agent",
    "capabilities": ["booking", "trust-verification"]
  }'
```
Connect your MCP client to:
* **MCP Streamable HTTP Endpoint:** `https://pabandi.onrender.com/mcp`
* **Discovery & Spec:** `https://pabandi.com/llms.txt`
* **Protocol Manifest:** `https://pabandi.onrender.com/.well-known/ptp.json`
---
## Technology Stack
- **Client:** React 18, Vite, Tailwind CSS (Hosted on Firebase)
- **API & Engine:** Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (Hosted on Render)
- **Smart Contracts:** Solana Anchor Escrow program (Devnet / Mainnet)
- **Agent Integration:** Model Context Protocol (23 tools), x402 HTTP 402 micro-settlement
- **Identity & Trust:** PTP Ed25519 cryptographic attestations
---
## Security & Compliance
- **Non-Custodial:** Pabandi does not hold client funds. Escrows operate on smart contracts where funds are conditionally released upon verified milestone delivery or returned upon dispute resolution.
- **Zero Token Risk:** Pabandi does not issue a speculative token or investment contract. Blockchain usage is strictly limited to non-custodial escrow settlement and verifiable attestations.
- **Auditing & Threat Model:** Escrow contracts and verification logic are open source and undergoing independent security verification.
---
## License
This project is licensed under the [MIT License](LICENSE) - open and self-hostable.

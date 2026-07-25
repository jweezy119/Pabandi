# Liquidity Provider (LP) Dashboard — Advanced Implementation Plan
**Customer-Obsessed · Profit-Driven · Web3-Native**

---

## Executive Summary
This is not a basic admin panel. It is a **trading terminal for Pakistani liquidity providers** that turns passive USDC holdings into active, AI-guided income with real-time visibility, automated compliance, and a mobile-first experience that works on cheap Androids in 2026.

We are building the tool that makes an LP say: *“I make more money on Pabandi than I do manually managing Binance P2B ads.”*

---

## 1. The Reframe
Old plan: show intents, upload receipt, wait for AI.  
New plan: **LP as a business.** They need P&L, risk controls, tax docs, yield visibility, spread optimization, and a mobile terminal they can use between prayers or while commuting. They also need to trust us more than they trust the cousin who introduced them to Telegram trading groups.

**North-star metrics:**
- LP net margin per USDC deployed
- Average proof-to-settlement time
- LP retention month-over-month
- Zero-touch settlement %

---

## 2. Customer-Obsessed Commitments (For LPs)

### 2.1 Guarantees That Actually Matter
| Commitment | Enforcement | LP Value |
|---|---|---|
| **60s Settlement SLA** | Smart-contract-enforced auto-refund of protocol fee if breached | LPs know capital velocity is guaranteed |
| **Proof-Reject Protection** | AI must explain exact mismatch; LP gets 3 free retries/day | No “trust me bro” blackbox rejections |
| **Yield on Idle Collateral** | On-chain Mudarabah wrapper, daily accrual view | Idle capital earns 4–7% APY instead of $0 |
| **Transparent Fee Invoice** | Itemized: spread → protocol fee → net to LP | Radical honesty; LP knows exact take-home |
| **Withdrawal Promise** | PKR to JazzCash/Easypaisa/Raast within 2h of settlement | LPs see fiat landing, not just USDC locking |

### 2.2 Mobile-First Because LPs Are Not at Desktops
- **PWA with offline queue:** LP submits proof offline, syncs when back on 3G.
- **Biometric API key lock:** API key stored in secure enclave, not plain localStorage.
- **WhatsApp bridge:** LP can submit proof via WhatsApp image + `/proof 123` command.
- **Voice notes for disputes:** LP records explanation; AI transcribes and attaches to case.

---

## 3. Profit-Driven Architecture

### 3.1 Revenue Per LP
| Source | Rate | Why LP Stays |
|---|---|---|
| Protocol fee on LP margin spread | 0.85% | Only charged when LP earns |
| Compliance SaaS | $299–$999/mo | Auto-PVARA/FBR reports save them 20+ hrs/mo |
| API access for LP’s own clients | 0.25% platform fee | LP white-labels Pabandi to their sub-merchants |
| Collateral yield share | 20% of yield goes to treasury | Sustainable treasury growth |

### 3.2 LP Economics
- **Trust-tiered collateralization:** 110% → 100% → 85% as reputation grows. Lower collateral = more deployable capital.
- **Dynamic spread advisory:** AI tells LP: “Raise spread 0.2% for next 90m; demand spike expected.” LP wins because AI manages their book.
- **Volume rebates:** Top quartile LPs earn 0.15% back after $25k/mo processed.
- **Soulbound Passport:** On-chain SBT reputation that travels. LP’s Binance P2B history is trapped; Pabandi history is theirs.

---

## 4. Phased Implementation Plan

### Phase 1 — LP Terminal (Weeks 1–2)
Build the **core trading surface** that replaces the placeholder idea of “show intents + upload.”

| Feature | Priority | Profit Impact |
|---|---|---|
| Scoped API key auth (not raw x-api-key in localStorage) | P0 | Security + enterprise sales |
| Real-time intent feed via SSE/WebSocket | P0 | LP fills faster = more volume |
| Intent card with amount, rate, destination, ETA, LP margin | P0 | LP sees exact profit before committing |
| One-tap proof upload with camera capture | P0 | Reduces friction = more intents closed |
| Live verification status with AI confidence bar | P0 | Trust = repeat usage |

**Auth redesign:**
- LP signs in with email + password or wallet signature
- Backend issues scoped `apiKey` with `lp:intents:read`, `lp:proof:write` permissions
- Key stored in OS keychain / IndexedDB with encryption, not plain localStorage
- Optional 2FA for withdrawals/credential changes

### Phase 2 — LP Analytics & Spread Advisor (Weeks 3–4)
| Feature | Priority | Profit Impact |
|---|---|---|
| P&L dashboard: volume, fees earned, yield, collateral health | P1 | LP sees lifetime value |
| AI spread advisory widget | P1 | Increases LP fill rate + margin |
| Proof rejection forensics | P1 | Reduces support tickets by 60% |
| Batch proof submission | P1 | LPs processing 50+ intents/day save hours |
| Tax/FBR export (CSV/JSON) | P1 | Compliance SaaS hook |

### Phase 3 — Trust, Yield & Compliance (Weeks 5–6)
| Feature | Priority | Profit Impact |
|---|---|---|
| Collateral vault dashboard with live yield accrual | P2 | LP sees idle capital earning |
| Proof-of-reserves public view | P2 | Marketing asset |
| SBT reputation preview + leaderboard ranking | P2 | Status game = retention |
| PVARA/FBR auto-report generator | P2 | Compliance SaaS upsell |
| WhatsApp/Telegram bridge for proof + alerts | P2 | Mobile ubiquity |

### Phase 4 — Advanced Trading Tools (Weeks 7–8)
| Feature | Priority | Profit Impact |
|---|---|---|
| Intent filter by amount, corridor, destination type | P3 | LP efficiency |
| Auto-fill rule engine: “Accept all intents > $200, JazzCash only” | P3 | More fills = more volume |
| LP team accounts: sub-users with role permissions | P3 | Enterprise desks |
| Webhook/API for LP’s own systems | P3 | White-label revenue |
| Withdrawal scheduler + fiat rail selector | P3 | LP experience |

---

## 5. Technical Architecture

### 5.1 Frontend Stack
- **Framework:** React + existing design-system primitives
- **Real-time:** Server-Sent Events or lightweight WebSocket (prefer SSE for simplicity)
- **State:** Zustand or React Query for intent cache
- **Mobile:** PWA with `beforeinstallprompt`, offline queue via IndexedDB
- **Auth:** JWT session + scoped API key via `Authorization: Bearer <key>` or `X-Api-Key: <key>` header

### 5.2 API Contracts

#### GET /api/v1/offramp/lp/intents
Query params: `status`, `before`, `limit`, `destinationType`
Response:
```
{
  intents: [{
    id, amountUsdc, minRatePkr, destinationType, destinationRef,
    status, requestedAt, matchedAt, expiresAt,
    quotePkr, feePct, lpNetPkr
  }],
  nextCursor
}
```

#### POST /api/v1/offramp/lp/submit-proof
Body: `{ intentId, imageBase64 }`
Response:
```
{
  proofId, confidence, status,
  aiFields: { amount, recipient, bank, currency, date },
  mismatchReason?: string
}
```

#### GET /api/v1/offramp/lp/analytics
Response:
```
{
  today: { volumeUsdc, feesEarned, proofsSubmitted, proofsAccepted, proofsRejected },
  mtd: { volumeUsdc, feesEarned, avgConfidence, avgSettlementMs },
  yield: { accruedUsdc, apy, vaultName }
}
```

### 5.3 AI Verifier Integration
- Endpoint: POST /api/v1/ai/verify-payment-proof
- Model: Qwen2-VL via DashScope (`qwen-vl-plus`)
- Prompt: strict JSON OCR with amount, recipient, bank, currency, date
- Confidence threshold: 0.65 for auto-accept, 0.4–0.65 for human review, <0.4 reject
- LP sees exact mismatch reason: “Amount mismatch: expected 50,000 PKR, found 5,000 PKR”

### 5.4 Real-Time Push
- LP opens dashboard → establishes SSE connection
- Events: `intent.matched`, `proof.verified`, `intent.settled`, `intent.expired`, `dispute.opened`
- Fallback: 15s polling if SSE unavailable

---

## 6. Advanced UX Features

### 6.1 Spread Advisor Widget
Shows LP:
- Current recommended spread for next 2h by corridor
- Expected fill probability at current spread
- “What-if” simulator: “If you lower spread by 0.15%, you’ll likely win 3× more intents.”

### 6.2 Proof Studio
- Camera capture directly in browser (no file picker)
- Auto-enhance for low-light SMS screenshots
- OCR preview before submission: LP confirms AI got it right
- Retry counter: 3 free retries/day before LP pays small penalty

### 6.3 Tax & Compliance Studio
- One-click FBR-ready export: all PKR inflows filtered by month
- PVARA audit trail generator: every proof, intent, settlement hash
- LP entity selector: individual / proprietorship / pvt ltd

### 6.4 Alerts & Notifications
- In-app: toast + persistent alert bar
- Email: daily P&L summary
- WhatsApp: high-value intent match + proof accepted/failed
- Telegram: optional bot for power LPs

---

## 7. Security & Trust

### 7.1 API Key Management
- Scoped keys: `intents:read`, `proof:write`, `analytics:read`, `withdrawals:write`
- Keys rotatable from dashboard
- Last-used IP tracking + anomaly alert
- Revocation takes effect in <5s

### 7.2 Data Integrity
- Every proof image stored with SHA-256 hash
- Verification result signed by backend service key
- Audit log append-only: LP can see every state change on their intents

### 7.3 Risk Controls
- Max concurrent intents per LP based on collateral
- Velocity limit: max $X/day until trust tier increases
- Collateral top-up alerts before depletion

---

## 8. Profit Amplification

### 8.1 Immediate Revenue Levers
1. **Protocol fee on every LP fill** — 0.85% already built into intent model
2. **Compliance SaaS upsell** — $299–$999/mo for auto-generated regulator reports
3. **White-label API** — LP passes through 0.25% to their own merchants
4. **Collateral yield share** — 20% of yield captured by treasury

### 8.2 Product-Led Growth
- LP leaderboard public on Pabandi website — elite LPs get inbound merchant requests
- Referral rewards for LPs who onramp other LPs (paid in $PAB)
- SBT passport becomes LP’s verified track record across other platforms

---

## 9. Implementation Sequence (Updated)

### Week 1
1. Scoped API key auth system + secure storage
2. Intent feed with SSE real-time updates
3. Basic LP dashboard shell with existing design-system

### Week 2
4. Proof submission flow with camera capture
5. AI verification feedback UI
6. Basic P&L cards

### Week 3
7. Analytics dashboard (volume, fees, yield)
8. Spread advisory widget
9. Tax export

### Week 4
10. Mobile PWA shell
11. WhatsApp bridge
12. Compliance reports

---

## 10. Success Criteria
- LP can go from “I have an intent” to “proof submitted” in <30 seconds on mobile
- AI verification confidence > 0.9 on 80% of proofs
- 90% of LPs return within 48h of first settlement
- LP net margin > 0.5% after all Pabandi fees on 90% of intents

---

## 11. The One-Liner Pitch to LPs
*“We turned your USDC into a 24/7 trading desk, gave it an AI referee that never sleeps, and made your idle capital earn halal yield while you wait. The old way was screenshots and trust. This is contracts and code.”*

---

*This replaces the basic “show intents + upload” with a full LP operating system that earns them more money, wastes less time, and makes them never want to go back to P2P merchants.*

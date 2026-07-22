# Pabandi — Shopify & Live Seller Execution Plan v2
> Status: PLAN ONLY — no implementation will be started until confirmed.

## 0. Guardrail
- **Do not** introduce embedded `<script>` tag onboarding as the merchant path.
- **Do not** start LiveShowRoom, LiveStreamPlayer, LiveChat, WebSocket/SSE, or custom “Shopify Live” OAuth bridging.
- **Do not** let Live Seller block the current CoCreate / revenue-creation path.
- **Only** execute slices that ship merchant value without HTML-paste setup.

## 1. North Star
Make a merchant’s first Pabandi moment on Shopify take **under 5 minutes** and require **no code**.

Measure:
- Time from app install → escrow checkout available
- No required theme edit, no HTML snippet, no dev credentials

## 2. What Already Works (keep, do not rewrite)
- `client/public/shopify-widget.js` — escrow checkout button + badge concept
- `server/src/routes/shopify-integration.routes.ts` — checkout + order callback paths
- `server/src/controllers/shopify.controller.ts` — OAuth start/callback
- `server/src/routes/shopify.routes.ts` — app install + webhook scaffold
- `server/src/services/live-seller.service.ts` — show state / schedule / order primitives
- Frontend pages: `LiveSellerPanel.tsx`, `LiveSellingPage.tsx`, `LiveSellCustomerPage.tsx`, `UniversalCheckoutPage.tsx`
- Client wiring: `liveSellerService` in `api.ts`

## 3. Execution Plan (ordered by money-time value)

### 3.1 Shopify App Install Path (week 1)
**Goal:** Turn the pasted-HTML widget into a real Shopify App install.

- Finish `shopify.routes.ts` OAuth flow:
  - Install route → Shopify auth → callback → save tokens + shop domain
  - Verify webhook endpoint registration
- Admin API order callback:
  - When escrow is funded, annotate order/draftOrder with funding status
  - Keep changes read-only unless merchant explicitly enables writeback
- Seller-facing UI:
  - Business dashboard section: “Pabandi Trust Checkout” with install/uninstall status
  - No HTML snippet given to merchant
- Checkout UX:
  - Escrow button goes under native checkout, or replaces the final action only
  - Customer sees short copy: funds held in escrow until delivery confirmation

**Out of scope:**
- Custom app block/extension with embedded iframe
- Theme auto-inject
- Webhook-triggered UI mutations

**Done criteria:**
- Install from Shopify admin succeeds in < 5 minutes
- Product page shows escrow checkout option
- Buyer flow to Pabandi checkout URL works end-to-end
- Funding callback updates Shopify orders/draft orders

---

### 3.2 Universal Checkout Stability (week 1)
**Goal:** Make checkout feel like a real product, not a prototype.

- Tighten `UniversalCheckoutPage.tsx` states:
  - Loading, escrow pending, funded, expired, failed
- Add exact copy states:
  - “Your payment is held safely with Pabandi.”
  - Seller cannot access funds until you confirm delivery.
- Add WhatsApp + email receipt text for the business owner
- Add retry path for failed web3 deposits or failed checkout session creation

**Done criteria:**
- Checkout page never shows a raw stack trace or backend proxy error
- Buyer can complete via SafePay/PayPal/card without code

---

### 3.3 Business Dashboard Improvements (week 1–2)
**Goal:** One screen to understand trust, orders, and show status.

- Add widget cards:
  - Trust score / AI risk score summary
  - Recent reservations / orders
  - Live show status + next scheduled show
  - Unclaimed listing CTA if `isClaimed === false`
- Keep it mobile-first, one-handed scroll

**Done criteria:**
- Business owner sees actionable state in < 3 seconds
- No extra login flows or context switches

---

### 3.4 Live Seller Module — Separate Branch (week 2+)
**Goal:** Move live-selling forward without touching merchant-critical paths.

- Create branch: `feature/live-selling-hub`
- Work strictly inside:
  - `LiveSellerPanel.tsx`
  - `LiveSellingPage.tsx`
  - `LiveSellCustomerPage.tsx`
  - `UniversalCheckoutPage.tsx` live-aware params
  - `livesell.routes.ts`
  - `live-seller.service.ts`
- Improvement target: non-real-time polish
  - Better show states UI
  - Catalog selection for shows
  - Schedule sharing + local ICS export
  - Viewer count and recent orders display
- **No** new WebSocket/SSE architecture
- **No** custom TikTok Live / YouTube Live OAuth bridging
- If a real-time push is absolutely required later, add a separate proposal with cost/risk

---

### 3.5 LiveCheckout UX Inside Streams (week 2+)
**Goal:** Buyers can purchase during live shows without leaving.

- Reuse `UniversalCheckoutPage` as a modal/side-drawer
- Accept params:
  - `showId`
  - `itemId`
  - `price`
  - `sellerId`
- Keep it session-scoped; do not require custom stream auth yet
- Backend:
  - Accept orders through existing `/livesell/:platform/orders`
  - Store `showId` and `itemId` for later attribution

**Done criteria:**
- Seller can mark an item pinned during show
- Buyer opens checkout from catalog and pays inside Pabandi
- Order synced back to seller’s LiveSellerPanel order list

---

### 3.6 Web3 Integrations Reuse Only (week 1–2)
- Keep existing BSC/Solana deposit utilities
- Use only for buyer checkout, not merchant onboarding
- Do not add new chain support or wallet flows
- If used in live module, treat same as Safepay/PayPal: optional payment method

---

### 3.7 Plugin-Aware Outreach (week 2–3)
**Goal:** Send the right message per seller profile.

- Map known integrations in `liveSellerService` and `shopify` data
- Compute outreach keywords:
  - Shopify store → “trust badge + escrow checkout”
  - TikTok/YouTube live seller → “no-show protection + pinned products”
- Send via existing OpenWA plugin path
- Dry-run only no customer broadcast until reviewed

---

## 4. Explicitly Deferred
These were proposed, but are intentionally deferred because they are not the bottleneck for 0-customer revenue.

| Item | Reason deferred |
|------|-----------------|
| LiveShowRoom unified page | Engineering theater without seller demand |
| LiveStreamPlayer component | Reuse embed iframe later |
| LiveChat | Adds moderation + authenticity risk |
| WebSocket / SSE for show state | 12-second polling is acceptable at current scale |
| Custom Shopify Live OAuth | Shopify Live adoption is low; standard OAuth is enough |
| Embedded `<script>` merchant path | Alienates non-technical sellers |
| Additional chain/wallet support | BSC + Solana already ship |
| Climate/resilience grant framing | Only if it matches core story |

## 5. Milestone Map
| Milestone | Target | Owner | Done Criteria |
|-----------|--------|-------|---------------|
| M1 | Week 1 | Fullstack | Shopify install → escrow checkout → callback in < 5 min |
| M2 | Week 1–2 | Fullstack | Universal checkout stable on all payment paths |
| M3 | Week 2 | Fullstack | Business dashboard trust + order + show widgets live |
| M4 | Week 2+ | Separate branch | Live seller UX polished, show states and orders usable |
| M5 | Week 2–3 | Backend/fullstack | Live checkout modal + order attribution working |
| M6 | Week 3 | Backend | Plugin outreach keywords mapped + dry-run mode |

## 6. Risk Register
- **Merchant install friction:** current biggest blocker → resolved by OAuth-first path
- **Trust copy confusion:** resolved by exact, non-technical checkout language
- **Live module scope creep:** resolved by separate branch + deferred list
- **Frontend instability in large TSX pages:** resolved by new helper components instead of monolith edits

## 7. Execution Rule
- Never edit `BusinessDashboard.tsx` until we have a helper component file to absorb the change.
- Never touch `BusinessProfilePage.tsx` unless absolutely required; prefer new wrapper or overlay.
- Treat `UniversalCheckoutPage.tsx` as the canonical checkout surface; redirect all payment-success logic through it.

## 8. Next Decision
Pick one:
1. Start M1 now and skip everything else
2. Start M1 + M2 only
3. Do M1 + M4 in parallel for CoCreate demo, leave M3/M5/M6 for after

# Pabandi — Proactive Trust & Web3 Experience Plan v3
> Status: PLAN ONLY — no implementation started unless explicitly confirmed.

## 0. North Star Shift
Move from “reactive punishment after no-shows” to **“continuous trust atmosphere + proactive protection.”**

Customer obsession metric:
- **Trust Friction Score:** every checkout should feel clearer, faster, and safer than the last visit.
- **First-visit clarity:** a new buyer should understand protection in under 5 seconds.
- **Recovery speed:** if something goes wrong, refund/rebuy path should be one tap.

Web3 layer:
- Not just “deposit crypto.” Make Web3 feel like **verifiable trust credentials**, faster payouts, and user-controlled evidence.
- Keep non-crypto path first-class; don’t make Web3 mandatory for trust.

## 1. Dynamic AI-Escrow (DAE) — upgraded
Current state: binary deposit required.

New shape:
- **Context-aware escrow curve, not a flat rule.**
  - Low-risk, repeat buyer: friction minimized; deposit reduced or waived.
  - New buyer, high-value booking, platform-flagged peer: friction increased; deposit scaled.
  - Same user can have different friction per category: live-sale vs freelance project vs restaurant reservation.
- **Real-time recalculation:**
  - Score updates before payment form render, not after checkout.
  - If user completes a PayPal/Safepay booking and trust improves, next booking starts with lower deposit.
- **Web3 extension:**
  - If user stakes/locks Pabandi trust tokens or wallet attestations, show lower deposit path.
  - Show explicit “Web3 Verified” badge when wallet age, transaction history, or attestation supports lower escrow.
- **Customer-obsessed UX:**
  - Show deposit range with reason: “High trust: deposit reduced to 0” or “First booking: 5% held for protection.”
  - Show countdown-to-release with merchant behavior rules.
  - Never surprise the user at final step with a new deposit amount.

**Goal:** make escrow feel adaptive and fair, not punitive.

## 2. Proof-of-Presence (PoP) — upgraded
Current state: manual dispute / peer jury.

New shape:
- **Auto-check-in intent detection:**
  - Calendar event accepted → pre-check-in request sent via WhatsApp/OpenWA with one-tap “I’m on my way.”
  - Merchant accepts check-in → both sides have time-stamped intent data before arrival.
  - Missed 15-minute window → soft no-show flag with automatic evidence package assembled.
- **Geolocation attestation (opt-in):**
  - If buyer allows, use coarse location as corroborating signal alongside WhatsApp reply.
  - Never require exact GPS; use “nearby” signal only and make it anonymous/degradable.
- **Merchant side:**
  - Merchant can mark start/end with one tap from notification, not deep menu.
  - If dispute arises, system auto-submits intent timestamps via `DisputeService.ts` without jury wait time.
- **Web3 extension:**
  - One-tap PoP can create a lightweight attestation or receipt hash on-chain for recurring high-value merchants.
  - Optional: viewer/seller can mint a verifiable “attendance record” that stays in their wallet.

**Goal:** reduce manual jury burden and make dispute evidence automatic.

## 3. Category-Specific Passports — upgrade now
Current state: implemented but underused.

New shape:
- Passport shows domain-specific modules, not one generic score.
  - Live seller: video-session reliability, flash-sale fulfillment, viewer-vouch score.
  - Freelancer: milestone completion, revision behavior, payout timing.
  - Hospitality: reservation adherence, cancellation notice time, table turnover ethics.
  - Ecommerce/Shopify: escrow fulfillment rate, COD risk level, refund timing.
- **Web3 extension:**
  - Category attestations can be issued/renewed per category.
  - “Solana-attested freelancer maturity” = verifiable, portable credential.
  - Optional transcoding into a wallet-readable trust object.

## 4. Wallet-First Identity & Attestation Layer
New customer-obsessed + web3 module.

Concept:
- User connects wallet once; it becomes a **trust keyring**, not just login.
- Attestations are stored per category:
  - KYC-light attestation
  -履约 pledge attestation
  - dispute-resolution history attestation
- Show transparent UI: “Your wallet holds 4 trust attestations; 2 are active for this booking type.”

Web3 value:
- Less friction by portability across platforms/markets.
- Composable trust across Shopify, TikTok, freelance gigs.
- Optional token-backed deposit reduction for verified wallets.

Security/UX balance:
- This is opt-in only for skeptical users.
- Default is email/phone login with optional wallet enhancement.

## 5. Shopify Escrow Trust Signals (customer-obsessed visuals)
Current state: script/badge.

New shape:
- Merchant installs via OAuth; storefront shows:
  - “Pabandi Protected” at checkout with live trust score and escrow release timing
  - Buyer-facing copy that shifts by trust tier: low-risk sees confident language; new buyer sees protective language.
- Post-purchase:
  - WhatsApp receipt with one-tap “Confirm delivery” / “Report issue”
  - Auto-release countdown visible to both sides
  - If merchant auto-confirms shipment, buyer sees honored-merchant badge

## 6. Live Seller PoC Upgrade
Keep it branch-scoped but make the demo more impressive with:
- Show catalog pinned item with instant escrow preview
- Viewer count + live trust pulse
- Merchant can mark item as flash-sale and set dynamic deposit for that item only
- Buyer checkout via `UniversalCheckoutPage` shows:
  - Live show context: “You’re buying during live show”
  - Item snapshot + escrow preview before commit
  - Optional wallet checkout if wallet connected

## 7. Proactive Outreach Layer
Make plugin-aware outreach smarter:
- Decision tree per customer lifecycle stage:
  - First visitor → safety/trust education
  - Returning customer → reduced-friction upsell
  - Disputed user → recovery path with compensation offer
- Web3 dimension:
  - Wallet-connected users get faster checkout + cross-platform trust message
  - Attestation holders get “preferred” checkout path

## 8. What to defer
- LiveShowRoom / LiveChat / WebSocket realtime architecture
- Custom TikTok Live / YouTube Live OAuth bridging
- Embedded script-only merchant onboarding
- New chain support beyond existing BSC + Solana

## 9. Execution order recommendation
1. DAE calculator logic + UI in `UniversalCheckoutPage.tsx`
2. PoP intent check-in via WhatsApp/OpenWA + disputed auto-package
3. Wallet trust attestation keyring flow
4. Shopify trusted visual layer
5. Live seller escrow snapshot for pinned items
6. Outreach lifecycle decision tree

## 10. Decision needed
Choose one:
1. Start DAE now
2. Start DAE + PoP together
3. Start wallet attestation layer + DAE together

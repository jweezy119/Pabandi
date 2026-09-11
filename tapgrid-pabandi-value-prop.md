# TapGrid + Pabandi: You Built the Terminal. Keep the Transaction.
### Business value proposition — pilot-ready, no new hardware, no upfront cost

---

## 1. The situation: your terminal, their tax

TapGrid 3D-prints the POS terminal. TapGrid owns the countertop, the tap, the merchant relationship. Then every transaction passes through to Square — ~2.6% + $0.10 per tap — for the privilege of moving money across hardware TapGrid built.

The tap itself doesn't do enough yet: it points, it identifies, it opens pages. The ordering, the payment, and the pickup still happen somewhere else. That gap between the tap and the money is where margin leaks and where we come in.

Pabandi replaces the Square leg — not the terminal, not the relationship, just the toll booth sitting on top of your hardware.

- **Fees leak margin.** ~2.6% + $0.10 on every card tap. A busy counter doing 500 × $8 tickets loses ~$4,600/month to processing.
- **Lines leak sales.** Every abandoned queue is revenue that walked out. Stadiums, coffee rushes, lunch counters — same story.
- **Redirects leak intent.** Today's NFC tap opens a page. The customer still has to figure out ordering, payment, and pickup somewhere else. Most don't finish.
- **Lock-in kills leverage.** The terminal, the software, and the money are one bundle. Leaving means replacing everything, so nobody leaves — and rates never improve.

## 2. What changes: the tap takes the order, not just the attention

Same TapGrid tags and terminals already deployed. New behavior behind them — built around the two moments that actually happen at counters every day:

**The walk-in custom order (the Subway sandwich).** Nobody plans a sandwich three hours ahead — you walk in hungry and want *your* sandwich: exact bread, exact fillings, no onions. Today that's a five-minute verbal relay across a counter. With us: tap the terminal, your saved build is already there (bread, fillings, extras — down to the no-onions), confirm, pay, kitchen sees it. First-timers build it once on the terminal screen; from then on it's theirs. Online ordering solved the planners. This solves everyone else — the 90% who just walked in.

**The morning coffee.** Same customer, same oat-milk latte, 7:40 AM. Tap → "usual, $6.50?" → confirm → it's being made before they reach the register. Visit 1 they pay and leave a phone number. Visit 2 they're recognized. Visit 3+ is pure habit — loyalty no punch card ever produced, because the reward is not having to wait or repeat yourself.

**Under both:** deposits back the order (no-shows stop costing the merchant), every completed visit earns the business a **verified star** on Pabandi (compounding into discovery ranking and free exposure), and there's no app to download and no account to create — the phone number *is* the account until the customer wants more.

## 3. Why this is less intrusive than what merchants use now

Square, Stripe, and Toast see everything: full PANs, item-level baskets, customer identity, and behavioral history — stored centrally, breached regularly, sold opaquely.

Our model inverts it:

| What the merchant needs to know | What we collect |
|---|---|
| This customer can pay | A yes/no funds proof — not the balance, not the wallet, not the history |
| This was a real visit | A check-in signal tied to the tap location — not a device fingerprint dossier |
| What do they usually order | Their own order history, shown back to them, deletable on request |

Zero-knowledge proofs are the mechanism, but the pitch is plain English: **we prove what matters and see nothing else.** No card numbers touch the merchant. No central honeypot of customer finances. For privacy-law purposes, there is simply less data to protect, breach, or subpoena.

## 4. The honest economics

No $0.00 fairy tales. Two rails, stated plainly:

- **Card/Apple Pay taps** still ride card networks (~2.9% interchange). We don't mark it up and we don't hide it — pass-through, visible on every statement.
- **Crypto-rail taps** (SOL/$PAB escrow) settle for fractions of a cent, instantly, on fulfillment — not T+1.

Merchant savings come from three real sources: (a) deposits kill no-show losses, (b) tap ordering recovers abandoned-queue sales, (c) growing crypto share compresses the blended rate every month. The flat platform fee replaces per-transaction rent-seeking — and unlike the incumbents, the merchant keeps their existing processor as a fallback. No rip-and-replace. No hostage hardware.

## 5. The pilot: viable, usable, nearly free

- **Who:** 1–3 TapGrid merchants with counter or table traffic.
- **What:** Existing tags re-encoded to Pabandi pay/verify links. Merchant screen shows orders. Sandbox/test keys — no live money until everyone trusts it.
- **Cost:** ~$0. Tags exist. Software exists. Test transactions cost cents.
- **Duration:** 30 days.
- **Decides everything:** tap-to-paid conversion rate, seconds from tap to order-on-screen, dollars saved vs their current processor statement.

If the numbers win, we scale to resellers with a one-page case study. If they don't, we've spent a month and learned the truth cheaply.

## 6. What each side brings

**TapGrid:** tags in market, merchant relationships, physical distribution, the countertop.
**Pabandi:** escrow settlement, TapPay links, verified check-in/review rails, star reputation, the habitual-order engine.
**Together:** the first NFC touchpoint that completes a sale instead of suggesting one.

## 7. What we're not claiming (on purpose)

- We are not a licensed money transmitter today — card settlement routes through licensed partners; direct settlement follows licensing, not before it.
- We do not eliminate interchange on card taps — we eliminate the markup, the lock-in, and eventually the need for the card at all.
- We do not need the grand multi-chain vision to start — one chain, one merchant, one transaction. Then we earn the right to talk about the rest.

---

**One line:** TapGrid owns the moment of intent. Pabandi closes it. Every tap becomes a sale, every sale becomes a habit, and the merchant keeps the margin.

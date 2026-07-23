# Pabandi Advanced Roadmap

Status: Plan for review
Context: Alibaba CoCreate 2026 preparation; single-repo, live-app-first approach.
Note: `DEMO_MODE` must be explicitly false in production. No secrets in artifacts.

## 1. North Star
Make Pabandi the first reliability-and-trust infrastructure stack where:
- bookings are **escrow-backed** by default,
- reputation is **portable on-chain**,
- hospitality calendars connect in **one click** with live verification, and
- every merchant interaction is **automated** through AI/ML with minimal UI overhead.

## 2. AI / ML Layer
### 2.1 Multi-language WhatsApp concierge
- Detect language from message text; reply in same language.
- Short-form intent training dataset from actual WhatsApp flows.
- STT/TTS fallback when message is voice note.
- Pre-built templates for 3 languages minimum; expansion pattern for others.

### 2.2 Intent memory + proactive NLU
- Keep conversation state per user (`whatsapp.smart.service.ts` partial today).
- Proactive scheduling: send reminders, no-show risk alerts, reschedule prompts.
- After-hours auto-reply with ML-ranked next-best actions for staff.

### 2.3 Lead scoring
- Real-time scoring model: recency, role, city, business type, source channel.
- Output: Pabandi Score 0–100 stored on `waitlist_leads`.
- CRM table shows score + reason (keywords matched, time decay, source weight).

### 2.4 Demand forecasting + dynamic availability
- Per-venue, per-day forecast from reservation + waitlist + seasonality.
- Surge/discount recommendations to merchant.
- Auto-block calendar when predicted no-show risk > threshold.

### 2.5 Support triage copilot
- Auto-classify incoming support messages: billing, technical, booking change, complaint.
- Route to correct internal worker/slack channel; generate draft reply.

## 3. Web3 Layer
### 3.1 On-chain escrow receipts
- Mint booking receipt hash when reservation is CREATED.
- Store tx hash + contract reference on reservation record.
- On cancel: release escrow automatically via backend adapter.

### 3.2 Portable reputation token
- User/business reliability score as tokenized identity.
- Connect address to Pabandi account; verify once; reuse across merchants.
- On-chain attestation for completed bookings, no-show penalties.

### 3.3 Payment rails
- USDC/SOL pay-in for bookings; stablecoin escrow preferred.
- Crypto API buyer sees `/api/v1/crypto` endpoints as part of stable adapter.
- Keep existing card + local methods for mainstream users.

### 3.4 Loyalty staking
- Staked DAE or partner token for merchant discounts or priority booking.
- Rewards auto-compound; slash on repeated no-shows.

## 4. Stable Backend Adapter
Current state: `/api/v1/whatsapp/advanced/capabilities`, `/api/v1/whatsapp/advanced/smart-action`.
Expand toward `/api/v1/ai`, `/api/v1/web3`, `/api/v1/openwa` surfaces.

### 4.1 WhatsApp advanced adapter
- POST `/send-ai`: send templated + AI-personalized WhatsApp message.
- POST `/session/start`, `/session/step`, `/session/end`: stateless CLI for integrators.
- GET `/plugins`: plugin catalog with keyword scoring.
- GET `/plugins/:id/action`: execute open plugin action via single canonical path.

### 4.2 AI adapter
- POST `/ai/nlp/classify`: message → intent + language + sentiment.
- POST `/ai/nlp/generate`: template + context → final WhatsApp/SMS copy.
- GET `/ai/models`: list enabled models and fallback order.

### 4.3 Web3 adapter
- POST `/web3/escrow/create`: create booking escrow on-chain.
- POST `/web3/escrow/release`: release on completion or cancel.
- GET `/web3/reputation/:address`: fetch portable score attestation.
- Requires real env vars: `WEB3_PROVIDER_URL`, `ESCROW_PRIVATE_KEY`, `CHAIN_ID`.

## 5. CRM Automation
### 5.1 Preset workflows
- New lead → follow-up after 15/60/1440 min.
- Demo scheduled → confirmation + calendar + reminder 24h before.
- Onboarded → celebration + onboarding guide + operator handoff.
- Not interested → re-eval after 7 days.

### 5.2 Bulk actions
- Bulk send, bulk status change, bulk tag, bulk export CSV.
- Merge duplicate leads; silent dedupe by phone + businessName + city.

### 5.3 Plugin-aware messaging
- When outreach template is selected, automatically append top plugin capabilities.
- Let CRM operator toggle plugin footer on/off per lead/category.

### 5.4 Smart actions per row
- Book, cancel, reschedule, update, status, pay, human, faq buttons open guided flow.
- Frontend opens modal; state persists to backend via `/lead/:id/smart-action`.

## 6. Hospitality North Star
### 6.1 One-click calendar connect
- OAuth/one-tap flow for Airbnb/Google Calendar/Channex.
- Import listings; map to Pabandi business profile auto-create if missing.
- Show connection status: green/yellow/red with last-sync timestamp.

### 6.2 Verified automatic blocking
- Pull availability every 5–15 min via sync worker.
- Block Pabandi slots on external calendar when reservation moves to CONFIRMED.
- Unblock automatically on CANCELLED or COMPLETED.
- Push sync errors to `business notifications` tab + email.

### 6.3 Live channel test booking
- Add `connection_test_booking` reservation type.
- Uses real calendar slot write + cancel cycle to verify connectivity.
- Surface result in settings tab.

## 7. Live App Hardening
### 7.1 Production demo mode death
- Remove or comments-out `isDemoMode()` in non-test files.
- Frontend remove `/sandbox`, `InteractiveEscrowSandbox`, demo banners.
- All payment/routes require real env keys; missing returns 4xx with actionable message.

### 7.2 API buyer experience
- `/api/v1/docs` stable + versioned Swagger UI.
- Example payloads for booking, cancel, webhook payload, web3 escrow.
- Rate limits, per-key quotas, + OAuth integration.

### 7.3 Deploy pipeline
- Separate `build.yml` + `deploy.yml`; fail fast on lint + typecheck + build.
- Preview deploy branch feature; recommended PR gating.

## 8. Mobile-First UX
- One-handed controls: bottom sheets, large tap targets, FAB for primary actions.
- WhatsApp-first flows for booking/cancel/reschedule (no app required).
- Haptic + sound on booking confirm/cancel.
- Voice notes supported for WhatsApp; transcribed via STT.
- Offline draft saves in CRM and reservation detail.

## 9. Implementation Phases
### Phase 1 — Stable adapter + CRM advance (current sprint)
- ✅ stable adapter idempotency + capabilities + smart action.
- ✅ CRM advanced modal + presets + plugin viewer.
- Remove demo UI/messaging from production.
- Harden `/api/v1/docs` canonical source.

### Phase 2 — AI concierge + lead scoring
- Intent memory + session lifecycle in `whatsapp.smart.service.ts`.
- Lead score field + CRM score column + sort/filter.
- Demand forecast endpoint with weekday + 30-day trend.

### Phase 3 — Web3 escrow + reputation
- On-chain receipt minting for new reservation.
- Web3 adapter + environment guardrail.

### Phase 4 — Hospitality connect + verified blocking
- Google Calendar + Channex OAuth Connection tab.
- Sync worker + verified block/unblock cycle.

## 10. Success Metrics
- CRM outreach-to-booking conversion > 18%.
- WhatsApp concierge resolution rate > 75%.
- Partner onboarding time < 10 min.
- Escrow-backed booking share > 40%.
- API buyer docs CX: 90%+ find-primary-flow success in < 2 clicks.
- Mobile task completion in < 4 taps for 90% flows.

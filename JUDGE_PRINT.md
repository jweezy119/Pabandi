# Pabandi — CoCreate 2026 Judge One-Pager
> Print-ready cheat sheet. Keep this open while walking the demo.

---

## 0. Demo Screencast
- Captured screencast: `Screencast from 2026-07-21 09-40-19.webm`
- Frames extracted: `/home/peesee/Pabandi/.hermes/desktop-attachments/screencast-frames/`

---

## 1. Open (first 10 seconds)
| | |
|---|---|
| **URL** | `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666` |
| **Fallback** | Any `/business/:id` from admin/search if the demo ID is unseeded. |
| **Layout** | Mobile, right hand, portrait. |

---

## 2. Screenshot Checklist
_check each box before moving on_

- [ ] **Business profile hero** — unclaimed banner + “Claim Listing” CTA visible
- [ ] **Tabs** — Overview, Promotions, Reviews, Media
- [ ] **Claim flow** — tap **Claim Listing** → WhatsApp claim overlay opens
- [ ] **Pay with Tap** — visible in hero/business detail
- [ ] **Payment Link Card** — copy link, WhatsApp share, open checkout
- [ ] **Passport Dashboard** — trust score + axes + actions
- [ ] **Developer Portal** — endpoints + risk engine docs section

---

## 3. Talking Points (30 seconds)
- **Trust-first commerce** for informal economy: restaurants, live sellers, freelancers, hospitality.
- **Zero-code merchant wedge**: hosted payment links + Shopify integration, no HTML required.
- **Breakthrough trust engine**: multi-axis Passport Risk Engine, not a single binary score.
- **WhatsApp-native outreach**: OpenWA-first gateway, plugin-aware, one-tap share.

---

## 4. Live Links (judges/devs)
- Frontend: `https://pabandi-42c5b.web.app`
- Backend API: `https://pabandi-backend-97129395003.asia-south1.run.app/api/v1`
- Health: `https://pabandi-backend-97129395003.asia-south1.run.app/health`
- Docs: `https://pabandi-backend-97129395003.asia-south1.run.app/api/docs`
- Schema migration: `marketing/add_passport_risk_signals.sql`
- Deploy runbook: `COCREATE_DEPLOY.md`

---

## 5. Fallbacks
- If live profile fails: use Firebase console seeded business ID.
- If backend health fails: redeploy via `.github/workflows/deploy.yml` or Azure backup if configured.
- If deviant build issue: `cd server && npm run build && cd ../client && npm run build` → expected exit 0.

---

*Last updated: latest CoCreate polishing commit on `main`*

# Outreach — spec

Replaces the `/outreach` `PlaceholderPage`. This is the feature DMG Motors actually
asked for ("CRM pipeline outreach to customers with scheduling"), and it is the last
thing between the current product and a full solution for a service business whose
customers book them.

## 1. What exists today

| Piece | State |
|---|---|
| `CrmClient` | real — `name`, `email`, `phone`, `stage`, `status`, `lastJobAt`, `totalJobs`, `totalSpent` |
| `CrmDeal` / `CrmTask` / `CrmActivity` | real models, real endpoints |
| Email delivery | **Resend**, via `server/src/services/email.service.ts`. Production `/health` reports `emailConfigured: true` |
| `outreachTemplates` | client-only copy in `client/src/config/verticalPersonas.ts` (4 per vertical) |
| `/outreach` route | `PlaceholderPage` |
| Outreach backend | none |
| SMS / WhatsApp | no vendor, no credentials |

**Channel decision: email only for v1.** Resend is configured, working, and needs no
new vendor. SMS needs Twilio, WhatsApp needs Meta Business — both are new accounts,
new costs, and new deliverability problems. Send through a `Channel` seam so a second
channel is an adapter, not a rewrite.

## 2. The use case that matters

Not "blast everyone". The one that pays for this feature:

> A repair shop's customers come in once every 12–18 months. Nobody remembers to
> call them. So the shop loses the next job to whoever is freshest in the customer's
> mind.

That makes the core primitive a **segment**, not a list:

- lapsed customers (no booking in N days) — the money segment
- by stage (`LEAD`, `ACTIVE`, …)
- by spend / job count
- explicit selection

Every other segment is a filter on the same `CrmClient` table.

## 3. Data model

```prisma
model OutreachCampaign {
  id          String   @id @default(cuid())
  businessId  String
  name        String
  channel     String   @default("EMAIL")   // EMAIL | SMS
  subject     String?
  body        String                        // sanitised HTML
  status      String   @default("DRAFT")   // DRAFT | SENDING | SENT | FAILED
  totalCount  Int      @default(0)
  sentCount   Int      @default(0)
  failedCount Int      @default(0)
  segment     String?                       // snapshot of the audience rule
  createdById String
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  recipients  OutreachRecipient[]

  @@index([businessId, createdAt])
}

model OutreachRecipient {
  id         String   @id @default(cuid())
  campaignId String
  clientId   String?
  to         String                        // denormalised for audit after deletion
  status     String   @default("PENDING")  // PENDING | SENT | FAILED
  error      String?
  sentAt     DateTime?

  @@index([campaignId])
}
```

And on `CrmClient`:

```prisma
marketingOptIn   Boolean   @default(true)
marketingOptInAt DateTime?
```

Default `true` because these are the business's own customers, not a list Pabandi
bought. It is settable, and it is checked before every send.

## 4. API

All under `/api/v1/outreach`, all behind `authenticate` + `resolveCrmBusiness`, all
tenant-scoped by the session business — never accept `businessId` from the body.

| Method | Path | Purpose |
|---|---|---|
| GET | `/templates` | vertical outreach templates (moved server-side from `verticalPersonas.ts`) |
| GET | `/campaigns` | list, newest first |
| POST | `/campaigns` | create draft. Body: `{ name, subject, body, segment }` |
| GET | `/campaigns/:id/recipients` | **preview** the audience before sending |
| POST | `/campaigns/:id/send` | send. Requires an `Idempotency-Key` header |
| GET | `/campaigns/:id` | status + counts |
| GET | `/unsubscribe?token=` | public, signed token → opts a client out |

Cross-cutting, non-negotiable:

- **Idempotency-Key required** on send. A double-tap must not email a customer twice.
- **Rate limit** the send route harder than the rest of the API.
- **Cap** a single send (start at 200 recipients) until deliverability is proven.
- **Audit log** every send, per recipient.
- Render all template output as untrusted — a business owner typing "Réunion" must
  not be able to inject markup into a customer's inbox.

## 5. UI

Replace `/outreach` (`App.tsx:672`) with a real page, three steps:

1. **Audience** — segment picker with a live count, and a preview of the first few
   names. The count is the thing an owner actually wants before spending effort.
2. **Message** — template picker (pre-filled from the vertical), editable subject and
   body, plain-language preview. Every risk/AI hint gets a one-sentence tooltip.
3. **Send** — confirmation showing N recipients, then per-recipient results.

Accessibility follows the existing coordinator rules: real labels, visible focus,
`prefers-reduced-motion`, no icon-only buttons.

## 6. Compliance

- **Unsubscribe link in every email**, honoured by the signed-token endpoint. This is
  the one hard requirement — CAN-SPAM, and basic decency.
- Respect `marketingOptIn = false`.
- Never send to a client with no email.
- Include the business's real name and address in the footer.
- Keep the send cap low until the domain is warmed.

## 7. Build order

1. **Schema + migration** — two models, one column on `CrmClient`. `db push` (the
   migrations folder cannot build this database — see `verify.yml`).
2. **Templates server-side** — move `outreachTemplates` out of the client config so
   the server can render and the client can fetch.
3. **Campaign CRUD + audience preview** — no sending yet. This alone is useful.
4. **Send path** — Resend, idempotency, rate limit, audit, unsubscribe.
5. **UI** — replace the placeholder.
6. **Tests** — the existing `verify` job runs the server suite; outreach needs unit
   tests for audience selection and idempotency, not just a happy path.

## 8. Open questions

- **From-address**: `noreply@pabandi.com` today. Sending on a customer's behalf from
  a Pabandi address is a deliverability and trust problem. Per-business sending
  domains are the right answer but are real work — v1 should at least set `reply-to`
  to the business's own address.
- **Warm-up**: a fresh domain sending 200 emails will land in spam. Start at 20/day
  per business and ramp.
- **SMS later**: needs Twilio and per-carrier 10DLC registration for US numbers. Do
  not start this before email is proven.

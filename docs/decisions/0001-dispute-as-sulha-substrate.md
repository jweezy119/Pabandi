# 0001 — Dispute model as substrate for Sulha

- **Status:** Accepted
- **Date:** 2026-10-01

## Context

Whitepaper v4.0 describes "Sulha — Pabandi's dispute resolution layer."
Sulha is not yet implemented. An invoice dispute flow shipped using a `Dispute`
model with `contextType: 'INVOICE'`.

This record exists because the glossary describes a system that does not exist
yet, while a durable primitive that *can* carry it does. Without an explicit
decision, the natural next move for anyone reading the glossary is to model
Sulha as its own entity — which is the one path that would make Sulha and
`Dispute` two sources of truth for the same thing.

## Decision

`Dispute` is the durable primitive. Sulha will be the feature layer
(arbitration workflow, UI, resolution states) built on top of `Dispute` rows.
No parallel dispute model will be introduced.

## Consequences

- `Dispute` rows are forward-compatible with Sulha.
- When Sulha ships, it reads and writes `Dispute` — it does not replace it.
- Any new dispute context (e.g. `FREIGHT`, `TENANCY`) extends the
  `contextType` value list rather than adding a new model. `contextType` is a
  `String?`, not a Prisma enum, so adding a context requires no migration.

## Alternatives considered

- **A separate `SulhaCase` model** — rejected. It would duplicate lifecycle,
  notification, and audit logic already in `Dispute`, and would split dispute
  state across two tables that must then be kept in sync.
- **A Prisma enum for `contextType`** — not adopted here. It would make context
  values machine-enforced, which is a real improvement, but it is a schema
  change to shipped code and out of scope for a documentation record. Worth
  revisiting when the second non-invoice context lands and the full value set
  is known.

## Current state

- Model: `server/prisma/schema.prisma`, `model Dispute`.
- Live context: `'INVOICE'`, written by `fileInvoiceDispute` in
  `server/src/services/failure-ownership.service.ts`.
- Route: `POST /api/v1/reconciliation/:invoiceId/dispute`.
- Pre-existing contexts, from the reservation and milestone flows:
  `MILESTONE`, `OFFRAMP`, `PAYOUT`, `RESERVATION`.

Sulha itself — arbitration workflow, resolution states, and UI — is **not
built**. Only the substrate is.

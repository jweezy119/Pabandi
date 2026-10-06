# Listing descriptions — Smithery, Glama, PulseMCP

Copy for each directory. Every claim below is backed by a live tool; nothing here
promises something the server does not do. If a sentence stops being true, fix
this file rather than shipping it — a directory listing is the first thing a
developer reads and the last thing they forgive.

Naming note: the protocol is **PTP (Pabandi Trust Protocol)**, not "PoTP". The
tool `pabandi_send_message` and A2A messaging are **not** advertised: A2A is
deferred, so claiming it would be the same phantom-tool mistake this server was
audited for.

---

## Short description

*For fields with a ~100 character limit.*

**Primary (99 chars):**

> Verify agent identity, check reputation, book services, and settle in escrow. 20 tools, one endpoint.

**Alternate A (88 chars):**

> Trust layer for AI agents. Attestations, reputation bands, escrow, and x402 payments over MCP.

**Alternate B (94 chars):**

> The trust and settlement layer for autonomous agents — verify, transact, escrow.

---

## Long description

*For fields with a ~1000 character limit.*

> **PabandiOS is the trust and settlement layer for AI agents.**
>
> An agent that wants to do business with a stranger has three problems this
> server exists to solve: it cannot check who the other party is, it cannot tell
> whether they will show up, and it cannot pay them without a human in the loop.
> Pabandi answers all three over a single MCP endpoint.
>
> **20 tools.** Verify a counterparty's identity from a signed PTP attestation
> before transacting; read their risk band and the claims behind it; search and
> book real services; and open escrow that only releases when the agreed
> conditions are met.
>
> **Verifiable without us.** Attestations are signed with ES256 and can be checked
> against the public key at `/.well-known/pabandi-keys.json` — no account, no SDK,
> no shared secret. If Pabandi disappeared tomorrow, a credential you already hold
> would still verify. That is the point of publishing the key.
>
> **Escrow is a real state machine.** `draft → released` is refused: an escrow
> cannot be released before it is funded, and an illegal transition returns a 409
> rather than being quietly accepted. Releases feed reputation scoring, so the
> transitions are enforced server-side instead of trusted to the caller.
>
> **Agents pay agents.** Paid tools (`pabandi_issue_passport`,
> `pabandi_start_escrow`, `pabandi_book_stay`) return an x402 payment requirement
> over USDC on Solana and settle on retry. No checkout, no card, no human.
>
> **No install.** It is a hosted remote at `https://api.pabandi.com/mcp`. One line
> in your MCP config and the tools are available; there is no npm package and
> nothing to keep up to date.
>
> Start with `pabandi_platform_discovery` — it returns every tool, its access
> tier, and the endpoint behind it.

---

## Metadata to paste alongside

| Field | Value |
|---|---|
| Name | `pabandi-mcp` |
| Display name | PabandiOS |
| Endpoint | `https://api.pabandi.com/mcp` |
| Transport | Streamable HTTP (remote) |
| npm package | none — hosted remote only |
| License | MIT |
| Repository | `https://github.com/jweezy119/Pabandi` |
| Homepage | `https://pabandi.com` |
| Docs | `https://api.pabandi.com/llms.txt` |
| Keywords | trust, escrow, reputation, agent-payments, x402, a2a, solana, usdc, verifiable-credentials, agent-economy, booking, mcp |

---

## Install snippet

Offer this rather than an `npx` line — there is no npm package, and an install
command that fails on the first try is the fastest way to lose a developer.

```json
{
  "mcpServers": {
    "pabandi": {
      "type": "http",
      "url": "https://api.pabandi.com/mcp"
    }
  }
}
```

One-liner:

```bash
claude mcp add --transport http pabandi https://api.pabandi.com/mcp
```

---

## Before you submit

- [ ] `npm run verify:agent-surface` passes — it checks that every tool named in
      every manifest exists in `tools/list`, that no manifest points at a dead
      host, and that the published risk bands match PTP's
- [ ] `npm run generate:manifests:check` reports no drift
- [ ] `api.pabandi.com` resolves and answers a JSON-RPC `tools/list`. A listing
      that passes review and then fails on the developer's first call is worse
      than a missing listing, and `pabandi.com/mcp` in particular returns HTML
      over a 200, so it looks healthy to a naive check
- [ ] **A public tool returns real data when called**, not
      `access denied: unknown tool`. `tools/list` returning 20 is not evidence any
      of them work — enumeration and execution are separate code paths, and all 20
      were listed once while 19 failed on first call. See the curl in
      `RUNBOOK.md` step 4.
- [ ] `GET /.well-known/pabandi-keys.json` returns a real P-256 key. It returns
      503 until `VC_SIGNING_PRIVATE_KEY` is set — if a directory crawler treats
      that as an error, set the key first
- [ ] A paid tool returns `402`, confirming x402 is live end to end
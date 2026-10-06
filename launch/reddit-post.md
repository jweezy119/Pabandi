# Reddit launch post — r/AI_Agents

**Post this after the launch gate in `listing-descriptions.md` passes.** Not before:
the three checks at the bottom must all pass, or the post promises something that
does not answer.

Every factual claim below was checked against the deployed server. If you edit this
file, re-check the claims you add — the reason the previous draft of this post was
wrong is that it described an intended product rather than the running one. Six of
its seven tools did not exist, the risk bands were the wrong alphabet, and it
disclaimed x402 as "not live" while x402 was enforcing payments on every
`tools/call`.

---

## Title

> We built an MCP server for trust + escrow in the agent economy. Here's what it does.

---

## Body

Kept hitting the same wall building agents: they can *do* things but can't *prove*
anything. No way for Agent A to check Agent B's record, settle a conditional payment
without a human, or hold funds while both sides wait.

So we built Pabandi's MCP server. **20 tools** at `https://api.pabandi.com/mcp`,
hosted-remote:

```json
{
  "mcpServers": {
    "pabandi": { "url": "https://api.pabandi.com/mcp" }
  }
}
```

**The trust part.** `pabandi_verify_trust_attestation` takes a PTP (Pabandi Trust
Protocol) attestation and re-executes its signature, returning the verified claims —
including a risk band on a published **A–E** scale. `pabandi_issue_passport` mints a
scoped Agent Capability Passport, metered at 1.0 USDC.

**The escrow part.** `pabandi_start_escrow` opens an escrow with explicit release
conditions. Transitions are a validated state machine — `draft → released` is refused
with a 409, because an escrow can't release before it's funded.

**The money part.** Paid tools return a 402 with an x402 payment requirement and
settle on retry. `pabandi_issue_passport` 1.0 USDC, `pabandi_start_escrow` 0.5,
`pabandi_book_stay` 0.25 — USDC on Solana.

**What it unlocks:** agents verify each other and pay each other without a human in
the loop.

**What we got wrong first, and fixed:** we found a reputation-farming bug in our own
escrow — an agent could create an escrow and immediately mark it released, earning a
positive trust signal with no money moving. It's fixed with enforced transitions.
Mentioning it because it's exactly the class of thing that kills trust
infrastructure before it starts.

**What we don't have:** A2A messaging (deferred). An MCP tool for releasing escrow —
release is a REST call today, and closing that gap is next. A ZK proof exists for
escrow splits, not for reputation.

**Honest framing on custody:** Pabandi is not a custodian. Booking deposits settle
into the merchant's own account; escrow here is a commitment-and-evidence record with
enforced conditions, not a holding account. We wanted to be clear about that rather
than let you infer otherwise.

If you're building agents that pay or hire other agents, try it and tell us where it
breaks. We'd rather hear "this doesn't work" now.

Repo: github.com/jweezy119/Pabandi
Docs: api.pabandi.com/llms.txt
Keys: api.pabandi.com/.well-known/pabandi-keys.json

Feedback welcome. Especially the brutal kind.

---

## r/mcp variant

Post the day after, same claims, different angle — lead with the MCP implementation
rather than the product:

> We published an MCP server for agent trust and escrow. The part I'd want feedback on
> is the escrow state machine.
>
> `updateStatus` originally validated only the target status string and never read the
> current state, so every transition in a 7×7 grid was reachable — including
> `draft → released`. Since a release emits a trust event that feeds reputation
> scoring, that was a way to raise a trust score without moving money.
>
> It's now a pure transition table (no Prisma, so it's testable in isolation), enforced
> in the service, returning 409 with the blocking state. Self-transitions are
> idempotent no-ops, which also stops a repeated dispute emitting a duplicate trust
> event.
>
> Repo: github.com/jweezy119/Pabandi — the rules are one file, `universal-escrow.rules.ts`.

---

## Launch gate — run this before posting

```bash
# 1. tools/list must return 20
curl -s -X POST https://api.pabandi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools | length'          # expect: 20

# 2. credential keys must NOT 503
curl -s -o /dev/null -w '%{http_code}\n' \
  https://api.pabandi.com/.well-known/pabandi-keys.json    # expect: 200

# 3. a paid tool must return 402, proving x402 is live
curl -s -X POST https://api.pabandi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"pabandi_issue_passport","arguments":{}}}' \
  | jq '.error.code'                     # expect: 402
```

Check 2 fails with 503 until `VC_SIGNING_PRIVATE_KEY` is set on Render.

---

## Watch on day one

| Signal | Meaning |
|---|---|
| Repo stars | Discovery. Under 5 in 48h means the angle missed, not that the server is bad |
| DMs from developers | Real interest. Answer within the hour; a DM is worth 100 stars |
| First escrow transaction | Product-market fit. Screenshot it |

One developer who ships with the server is worth more than a thousand stars. If
nothing happens on day one, that's normal for a small high-signal subreddit — change
the angle, don't change the product.
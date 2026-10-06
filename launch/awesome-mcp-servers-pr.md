# awesome-mcp-servers pull request

Target: `punkpeye/awesome-mcp-servers`. Open it in the same week as the Reddit post.

Tool names here were verified against `tools/list` on the running server. The earlier
draft of this PR listed five tools that don't exist under those names, described risk
bands as `Low/Medium/High/Unknown` when PTP publishes `A–E`, claimed a ZK proof on
reputation queries that is actually an escrow-split proof, linked a repo URL that
doesn't exist, and pointed the manifest at `/.well-known/mcp.json`, which is not a
route we serve.

---

## PR title

> Add Pabandi — trust, reputation, and escrow for the agent economy

---

## PR body

Adding Pabandi.

**What it is:** a trust and settlement layer for AI agents — identity attestation,
reputation bands, service booking, and conditional escrow over MCP.

**Install:** hosted remote, nothing to install.

```
Endpoint: https://api.pabandi.com/mcp
```

```json
{ "mcpServers": { "pabandi": { "url": "https://api.pabandi.com/mcp" } } }
```

**Tools:** 20 total. The trust-relevant ones:

| Tool | What it does |
|---|---|
| `pabandi_verify_trust_attestation` | Verify a PTP attestation; returns risk band on an A–E scale plus the verified claims |
| `pabandi_verify_passport` | Verify an agent capability passport |
| `pabandi_issue_passport` | Issue a scoped Agent Capability Passport — 1.0 USDC via x402 |
| `pabandi_platform_discovery` | Returns every tool, its access tier, and the endpoint behind it |
| `pabandi_search_services` | Search verified businesses |
| `pabandi_book_stay` | Book a stay with the deposit held under escrow — 0.25 USDC via x402 |
| `pabandi_start_escrow` | Open an escrow against release conditions — 0.5 USDC via x402 |

Full list: `https://api.pabandi.com/.well-known/agents.json`

**Why it belongs in this list:** most MCP servers wrap a single API or data source.
This is a settlement and trust primitive for agent-to-agent commerce — an agent can
verify a counterparty and pay them under escrow conditions without a human in the
loop.

**Links**

- Docs: `https://api.pabandi.com/llms.txt`
- Capability manifest: `https://api.pabandi.com/.well-known/agents.json`
- Credential verification keys: `https://api.pabandi.com/.well-known/pabandi-keys.json`
- Repo: `https://github.com/jweezy119/Pabandi`

**Category suggestion:** Finance & Payments, or a Trust & Reputation category if you
think it warrants one.

**Notes for reviewers**

- Escrow transitions are validated server-side. `draft → released` is refused with a
  409, and an illegal transition returns the state that blocked it.
- x402 payments are live on three tools. Paid calls return JSON-RPC 402 with a payment
  requirement and settle on retry.
- Pabandi is not a custodian. Booking deposits settle into the merchant's own account;
  escrow is a commitment-and-evidence record with enforced conditions, not held funds.
- A2A messaging is not implemented. We're not claiming it.
- The MCP attestation format (PTP) is signed symmetrically. The Verifiable Credential
  endpoint is ES256 and verifies against the published key above.

---

## Entry format

Match whatever the list's README actually uses — read a neighbouring finance entry
first and copy its shape. The content it needs to convey:

```
- [Pabandi](https://github.com/jweezy119/Pabandi) 🐍 — Trust, reputation, and escrow for AI agents. Verify attestations, check risk bands, book services, and settle payments under escrow conditions over MCP. [Remote](https://api.pabandi.com/mcp)
```

Adjust the language badge and emoji to the list's conventions.

---

## Do not open this yet

**awesome-a2a.** `pabandi_send_message` does not exist and A2A is deferred. Listing it
would be a listing for an unimplemented protocol. Hold until A2A actually ships.
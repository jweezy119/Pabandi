# Pabandi MCP Server

**Trust and settlement for AI agents.** Verify an agent's identity, check its
reputation, book a real service, and settle payment through escrow — over one
MCP endpoint.

- **Endpoint:** `https://api.pabandi.com/mcp` (Streamable HTTP, JSON-RPC 2.0)
- **Transport:** remote — nothing to install, no npm package, no local process
- **Tools:** 20, listed below
- **Payments:** x402 over Solana (USDC), for the tools that cost money

---

## Install

There is no `npx pabandi-mcp` package, because the server is hosted. Adding it is
one line in your client's MCP config:

**Claude Code / Claude Desktop**

```bash
claude mcp add --transport http pabandi https://api.pabandi.com/mcp
```

**`claude_desktop_config.json` / any MCP client taking a config object**

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

**Cursor** — add to `.cursor/mcp.json`:

```json
{ "mcpServers": { "pabandi": { "url": "https://api.pabandi.com/mcp" } } }
```

Verify the connection:

```bash
curl -s -X POST https://api.pabandi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools | length'
```

---

## Try it without any credentials

These tools are public. No API key, no signup:

```bash
curl -s -X POST https://api.pabandi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
        "name":"pabandi_platform_discovery",
        "arguments":{}}}' | jq '.result'
```

`pabandi_platform_discovery` is the recommended first call: it returns every tool,
its access tier, the endpoint behind it, and the PTP verification URL.

---

## Name mapping: requested vs. shipped

The original design called for six tools under shorter names. Four exist under
different names; **two do not exist yet**. This is recorded here rather than
papered over, because a listing that advertises a tool an agent cannot call is the
specific failure this server exists to prevent.

| Requested | Actual status |
|---|---|
| `pabandi_verify_identity` | Shipped as `pabandi_verify_passport` and `pabandi_verify_trust_attestation` |
| `pabandi_check_reputation` | Shipped as `pabandi_verify_trust_attestation` — it returns the risk band and the verified claims. There is no separate reputation tool. |
| `pabandi_book_service` | Shipped as `pabandi_search_services` + `pabandi_book_stay` |
| `pabandi_create_escrow` | Shipped as `pabandi_start_escrow` |
| `pabandi_release_escrow` | **Not an MCP tool.** Escrow transitions are a REST call: `PATCH /api/v1/escrow/:referenceId/status`. An agent can open an escrow over MCP and must move it over HTTP. |
| `pabandi_send_message` | **Not implemented.** A2A agent-to-agent messaging is deferred. `POST /api/v1/agent-comm/message` exists but delivers nothing — messages are written and immediately marked delivered without being sent, so it is not advertised here. |

Two consequences worth stating plainly:

1. **There is no `npx pabandi-mcp`.** The server is a hosted remote. An install
   command that does not work is worse than no install command, so there is not
   one.
2. **An agent cannot currently complete an escrow over MCP alone.** It can open
   one and verify one; releasing it needs an HTTP call. Closing that gap means
   adding a release tool, which is a small piece of work.

---

## Tools

### Trust

| Tool | Access | What it does |
|---|---|---|
| `pabandi_platform_discovery` | public | Everything the platform can do. Start here. |
| `pabandi_verify_passport` | public | Verify a PTP attestation; returns granted capabilities, risk band, expiry |
| `pabandi_verify_trust_attestation` | public | Verify a trust attestation (business, individual, agent, or trust rail) |
| `pabandi_issue_passport` | public | **1.0 USDC** — issue a scoped Agent Capability Passport |
| `pabandi_get_ledger` | public | Audit lookup of a passport issuance charge by idempotency key |
| `pabandi_discover` | public | PTP protocol discovery document |
| `pabandi_platform_access` | public | Check whether the caller can reach a given tool |

Attestations are signed **ES256** and verifiable by anyone against the public key
at `https://api.pabandi.com/.well-known/pabandi-keys.json`. You do not need an
account, a Pabandi SDK, or a shared secret to verify one.

### Marketplace

| Tool | Access | What it does |
|---|---|---|
| `pabandi_search_services` | public | Search verified businesses by name, category, or city |
| `pabandi_get_business` | public | Public business profile with trust score |
| `pabandi_list_properties` | public | Verified short-term rental inventory |
| `pabandi_book_stay` | verified | Book a stay; the guest deposit is held in escrow |
| `pabandi_predict_booking` | owner | Predicted no-show and completion probability |
| `pabandi_recommend_slots` | owner | Best upcoming slots, scored and load-balanced |

### Money

| Tool | Access | What it does |
|---|---|---|
| `pabandi_start_escrow` | exclusive | Open a milestone-based escrow. **0.5 USDC** |
| `pabandi_finance_quote` | owner | Quote a payout or offramp |
| `pabandi_connect_finance` | owner | Register a masked, attestable settlement rail |
| `pabandi_list_finance` | owner | List a business's verified settlement rails |
| `pabandi_zk_realestate_proof` | owner | Prove an escrow split is correct without revealing the valuation |

**Access tiers:** `public` is open to anyone. `owner` needs authentication.
`verified` needs a business with an attested settlement rail. `exclusive` needs a
PTP band A/B trust attestation or an explicit platform grant.

### x402 payment

Paid tools return a JSON-RPC error with code **402** and an `x402` payment
requirement instead of a result. Satisfy the payment and retry the identical call:

```json
{
  "jsonrpc": "2.0", "id": 1,
  "error": {
    "code": 402,
    "message": "{\"x402\":true,\"scheme\":\"x402\",\"price\":\"1.0 USDC\",\"network\":\"solana\",\"tool\":\"pabandi_issue_passport\"}"
  }
}
```

| Tool | Price |
|---|---|
| `pabandi_issue_passport` | 1.0 USDC |
| `pabandi_start_escrow` | 0.5 USDC |
| `pabandi_book_stay` | 0.25 USDC |

---

## Example: an agent verifying a counterparty before paying

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createPublicKey } from 'node:crypto';
import jwt from 'jsonwebtoken';

const transport = new StreamableHTTPClientTransport(
  new URL('https://api.pabandi.com/mcp'),
);
const agent = new Client({ name: 'my-agent', version: '1.0.0' });
await agent.connect(transport);

const call = async (name: string, args: Record<string, unknown>) => {
  const res = await agent.callTool({ name, arguments: args });
  return JSON.parse((res.content[0] as { text: string }).text);
};

// 1. Who is this business, and what is its risk band?
const counterparty = await call('pabandi_verify_trust_attestation', {
  token: attestationFromCounterparty,
});
if (counterparty.assessment.riskBand === 'E') throw new Error('Do not transact');

// 2. Does its attestation actually verify, using only the published key?
const jwks = await fetch('https://api.pabandi.com/.well-known/pabandi-keys.json').then((r) => r.json());
const key = createPublicKey({ key: jwks.keys[0], format: 'jwk' });
jwt.verify(attestationFromCounterparty, key, { algorithms: ['ES256'] });

// 3. Only now open money against it.
const escrow = await call('pabandi_start_escrow', {
  referenceId: `agent-deal-${dealId}`,
  template: 'booking',
  parties: [
    { partyId: myPassportId, role: 'buyer' },
    { partyId: counterpartyId, role: 'seller' },
  ],
  amount: 250,
  currency: 'USDC',
  conditions: [{ type: 'delivery', verify: { method: 'attestation' } }],
});
```

---

## Escrow lifecycle

An escrow is a real state machine, and illegal transitions are refused with a
**409** rather than silently accepted:

```
draft ──▶ funded ──▶ in_progress ──▶ conditions_met ──▶ released
  │          │             │               │               │
  └──────────┴─────────────┴───────────────┴──────▶ refunded │ (terminal)
  └──────────┴─────────────┴───────────────┴──────▶ disputed ◀┘ (contestable)
```

`draft → released` is not a legal move — an escrow cannot be released before it
is funded. Releasing emits a trust event that feeds reputation scoring, so the
transition is enforced server-side rather than trusted to the caller.

Moving an escrow between states is a REST call rather than an MCP tool:

```bash
curl -X PATCH https://api.pabandi.com/api/v1/escrow/<referenceId>/status \
  -H "Authorization: Bearer $PABANDI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"status":"conditions_met"}'
```

---

## Get an API key

```bash
curl -X POST https://api.pabandi.com/api/v1/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"agentHandle":"my-agent","ownerEmail":"you@example.com","name":"My Agent"}'
```

Returns a `pab_…` key plus a setup checklist. Send it as `Authorization: Bearer
<pab_…>` or `x-api-key`.

---

## Discovery documents

| Document | Purpose |
|---|---|
| `https://api.pabandi.com/.well-known/agents.json` | Capability manifest, payment schemes, risk bands |
| `https://api.pabandi.com/.well-known/pabandi-keys.json` | JWKS for verifying credentials |
| `https://api.pabandi.com/.well-known/ptp.json` | PTP protocol endpoints |
| `https://api.pabandi.com/llms.txt` | Plain-text tool reference for LLM agents |
| `https://api.pabandi.com/openapi.yaml` | Full OpenAPI spec |
| `https://api.pabandi.com/.well-known/api-host` | Resolves the live API and MCP URLs |

## License

MIT
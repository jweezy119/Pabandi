# Launch runbook

Order matters. Each step unblocks the next, and steps 3–5 are the ones that fail
silently rather than loudly.

Current state: code and manifests are committed and pushed. **Steps 1 and 2 need
you** — they touch DNS and a Render secret I can't reach.

---

## Step 1 — DNS

Point `api.pabandi.com` at the Render service. Until it resolves, every URL in
every launch asset is a dead link.

```bash
getent hosts api.pabandi.com    # expect an address
```

## Step 2 — Render environment

Two variables on the API service.

**`VC_SIGNING_PRIVATE_KEY`** — required. Without it,
`/.well-known/pabandi-keys.json` returns 503 and no third party can verify a
credential, which is the one thing the product claims that nothing else provides.

Print the line to paste into Render:

```bash
grep '^VC_SIGNING_PRIVATE_KEY=' server/.env
```

The `\n` escapes in that value are correct and expected — the loader decodes them.
Do not replace them with real newlines; paste it verbatim. A key was generated
during setup and lives only in `server/.env`, which is gitignored.

**`PUBLIC_API_URL`** — set to `https://api.pabandi.com`. This is the code default,
so it's belt-and-braces, but being explicit costs nothing.

Then redeploy the service.

## Step 3 — Local checks

```bash
cd server
npm run verify:agent-surface       # every advertised tool exists in tools/list
npm run generate:manifests:check   # no manifest drift
```

Both must pass. The first is what stops a directory listing from describing tools
the server has never served — the failure that produced three phantom tools in the
first draft of these assets.

## Step 4 — Live endpoint checks

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

# 3. a paid tool must return 402 — this is what proves x402 is live
curl -s -X POST https://api.pabandi.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"pabandi_issue_passport","arguments":{}}}' \
  | jq '.error.code'                     # expect: 402

# 4. capability manifest must name the canonical bands
curl -s https://api.pabandi.com/.well-known/agents.json | jq '.risk_bands, .base_url'
# expect: ["A","B","C","D","E"] and https://api.pabandi.com
```

Do not proceed past a failure here. Check 2 in particular: the launch post's
credibility rests on credential verification, and a 503 there means the
differentiating feature is the one thing a developer finds broken.

## Step 5 — Official MCP Registry (do this one first)

Everything else syncs from here, so publish here before anything else.

```bash
cd server
export MCP_REGISTRY_GITHUB_TOKEN=<your github token>
npm run submit:registries -- --execute
```

This is the only one of the eight with a real API. The other seven are web forms —
run without `--execute` to print each payload, then paste:

```bash
npm run submit:registries                    # prints all 8 payloads
npm run submit:registries -- --write=payloads.json
```

Submission order after the official registry: wait ~24h for propagation, then
Smithery → Glama → PulseMCP → MCPMarket. Descriptions come from
`listing-descriptions.md`.

## Step 6 — Announcements

| When | What | File |
|---|---|---|
| After step 4 passes | r/AI_Agents | `reddit-post.md` |
| Next day | r/mcp (implementation angle) | `reddit-post.md`, r/mcp variant |
| Same week | awesome-mcp-servers PR | `awesome-mcp-servers-pr.md` |
| Only with 2–3 real users | Hacker News | — |

Hold the Reddit post until step 4 passes in full. A listing can sit unpublished;
a post claiming a feature that 503s is a correction, not a launch.

## Step 7 — Do not submit

**awesome-a2a.** `pabandi_send_message` does not exist and A2A is deferred. Hold
until it ships.

---

## Rollback

If a manifest goes out describing something untrue, fix the source and regenerate —
never edit a published manifest directly:

```bash
cd server && npm run generate:manifests && npm run verify:agent-surface
git commit -am "fix(launch): …" && git push
```

Then update each directory that already listed you. Generated means the next
regeneration cannot reintroduce the error, but the published copies stay wrong
until you edit them there.

## If something looks right but isn't

The most likely failure is a listing that survived review and fails on first
contact — which is why the launch gate is three curls rather than a ping. Check,
in order:

1. `pabandi.com/mcp` returns **HTML over a 200**. The SPA fallback answers any
   path with `index.html`, so it passes a naive liveness check and fails the first
   JSON-RPC call. Never publish it as an MCP endpoint.
2. A manifest names a tool that `tools/list` doesn't return.
3. `/.well-known/pabandi-keys.json` returns 503 or a non-P-256 key.

Step 3's script catches all three. Run it before every submission, not once at the
start.
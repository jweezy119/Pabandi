# Visa agentic commerce — plan and readiness

Status: **research complete, no integration started.** This document records what
Visa actually requires, where Pabandi fits, and the order to do it in. Written
2026-11-25 from Visa's own developer docs and the MIT-licensed `visa/ai` toolkit.

---

## 1. What Visa sells — two different products

| | **Visa Intelligent Commerce (VIC)** | **Intelligent Commerce Connect (ICC)** |
|---|---|---|
| who it serves | agents that **pay** on a consumer's behalf | merchants that **accept** agent-initiated payment |
| our role | Agent Provider / Wallet Provider / Agent Enabler | merchant / acceptance partner |
| entry point | Visa Developer + program approval | one integration via the Visa Acceptance Platform, also resold through acquirers |
| protocols covered | TAP, MPP (HTTP 402), ACP, UCP | same set behind one API |

Also relevant: the **Agentic Ready** certification track, and the **Trusted Agent
Protocol (TAP)**, which is how a *merchant* recognises an approved agent.

**Recommendation: pursue acceptance (ICC / Agentic Ready) first.** Becoming a
token requestor means TRID, VARS registration and VTS/VPP/TAP onboarding — a
commercial relationship with weeks-to-months of approval. Acceptance is a lower
bar and maps onto our core loop: a US service business being paid by a customer's
agent is still a booking.

Ask the acquirer before applying direct — ICC is sold through acceptance partners,
and that path may bypass most of the paperwork.

---

## 2. Endpoint surface we would integrate

```
POST /vts/panEnrollments                                       enrol a card (PAN)
POST /vts/panEnrollments/{id}/provisionedTokens                provision a token
POST /vts/provisionedTokens/{id}/attestation/options           passkey challenge
POST /vts/provisionedTokens/{id}/attestation/result            verify device
POST /vts/provisionedTokens/{id}/deviceBinding                 bind device
POST /vts/provisionedTokens/{id}/stepUpOptions/method          ID&V step-up
POST /vacp/v2/credentials-for-instruction                      the credential itself
```

MCP alternative: `https://sandbox.mcp.visa.com` — Visa publishes an MCP server and
client examples, so an agent can reach VIC without hand-wiring REST.

Environments:

| env | base |
|---|---|
| sandbox | `https://sandbox.api.visa.com` (MCP: `https://sandbox.mcp.visa.com`) |
| certification | `https://cert.api.visa.com` |
| production | `https://api.visa.com` |

Sandbox connectivity alone takes **~10 business days** to establish. Start it first.

---

## 3. Security requirements — this is the actual work

- **mutual TLS** client certificate (transport auth).
- **Agent signature** in every request body (`client.agent.agentSignature`),
  Ed25519/RS256/ES256, validated by the **Visa Agent Registry Service (VARS)**.
  Must be **fresh per credentials call** — reuse is forbidden.
- **Two independent crypto domains**, each with its own storage and rotation:
  - VTS field-level encryption (FLE) for PAN data
  - VIC message-level encryption (JWE, RSA-OAEP-256) for credential responses —
    decrypted **in memory only**
- **Purchase instructions + mandates** carrying consumer-set bounds
  (`declineThreshold`, `effectiveUntilTime`). This is the consent model and the
  basis of dispute evidence.
- One-time cryptograms, **72-hour lifespan**.
- Passkeys + device binding; ID&V step-up where required.
- An **acceptable-use policy** we must comply with.

---

## 4. Credential checklist

From Visa's own `.env.example`. Everything here is issued during onboarding except
the signing key, which **we generate**.

```
VISA_VIC_API_KEY / VISA_VIC_API_KEY_SS          VIC credentials
VISA_EXTERNAL_CLIENT_ID                        = TRID (Token Requestor ID)
VISA_EXTERNAL_APP_ID                           External Application Profile Id
VISA_RELATIONSHIP_ID
VISA_VTS_API_KEY / VISA_VTS_API_KEY_SS          Visa Token Service
VISA_MLE_SERVER_CERT / VISA_MLE_PRIVATE_KEY / VISA_KEY_ID
USER_SIGNING_PRIVATE_KEY                        ours, PKCS#8, never shared
VISA_CONSUMER_ID                                stable across enrollments
VISA_ENROLLMENT_REFERENCE_ID                    vProvisionedTokenId from VTS
```

Production additionally needs: approved VIC participation, VARS registration,
a Business Identifier (BID), a JWE public key on file, and production certification.

---

## 5. Where Pabandi already fits

- **MCP server exists** at `/mcp` (`server/src/routes/mcp.routes.ts`), exposing
  agent tools — the natural place to surface a Visa tool.
- **Rail is already a discriminated union**:
  `'solana_pay' | 'x402' | 'stripe_connect' | 'circle' | 'square' | 'raast'`
  in `server/src/services/agentTools.service.ts`. A new rail is one member plus
  one handler.
- **Idempotency is done properly where it matters** — `Booking.workOrderId @unique`
  is exactly the retry guard Visa expects after a failed credential retrieval.

## 6. Gaps to close first

1. **Secret hygiene.** mTLS certs, signing keys and the MLE keypair must be stored
   and rotated independently. This session found a login code stored in
   **plaintext** on the `User` row — the same muscle, not yet built. Certification
   will probe this.
2. **No authorisation-bounds object.** Nothing models "consumer authorises an agent
   to spend up to X until Y". Our trust-band / net-terms model is adjacent and is
   arguably the differentiator Visa cares about (signals, ID&V), but it is not a
   mandate store.

---

## 7. Sequence

| # | action | owner | note |
|---|---|---|---|
| 1 | Visa Developer account + project, enable VIC + VTS | **you** | starts the ~10-day sandbox clock |
| 2 | Read `visa/ai` examples; run `vic-mcp-examples` against sandbox | us | cheap, reversible |
| 3 | Secrets work: key store + rotation; close the plaintext-code item | us | **before** any integration |
| 4 | Add the rail to the union, sandbox-only, flag-gated | us | no production path touched |
| 5 | Apply for Agentic Ready / ICC with a working sandbox build | **you** | |

Step 1 is the long pole and it is not mine to do. Steps 2–4 can start in parallel
once sandbox credentials exist.

---

## 8. Decisions needed

- Direct Visa application, or via an acquirer's ICC offering?
- Scope now: sandbox prototype only, or also Agentic Ready paperwork?
- Is step 4 worth doing before step 3 lands? (Recommendation: no.)

---

## Sources

- `https://developer.visa.com/docs/visa-intelligent-commerce/` — concepts, getting started
- `https://developer.visa.com/docs/trusted-agent-protocol/trusted-agent-protocol-specifications`
- `https://github.com/visa/ai` — MIT-licensed packages, examples, skills
- `https://usa.visa.com/about-visa/newsroom/press-releases.releaseId.22276.html`

---
name: colosseum-resources
description: Multi-ecosystem hackathon resource advisor for Colosseum builders. Use when a builder needs project-specific sponsor tools, SDKs, RPC providers, frameworks, wallets, infrastructure, or build paths from Colosseum's published resource index.
---

# Colosseum Resources Skill

Help Colosseum hackathon builders choose resources for the ecosystem and project they are actually building on.

## Fetch the Current Data

Fetch the live corpus before making recommendations:

```bash
curl --fail --silent --show-error https://ColosseumOrg.github.io/hackathon-resources/current.json
```

The active payload can contain:

- `tracks`: ecosystem-specific bundles, each with `id`, `name`, `resources`, `resourceGroups`, `sponsors`, `rpcProviders`, and `comingSoon`
- `resources`: curated sections whose nested links use `hyperlink`, `url`, and `description`
- `resourceGroups`: grouped build paths containing resource sections and an optional group description
- `sponsors`: sponsor entries with links, content, tags, and optional skill metadata
- `rpcProviders`: provider entries with descriptions, exact offers, and links

Treat missing optional fields as unavailable, not as evidence that another ecosystem's data applies.

If the fetch fails, say that the live resource index could not be reached. Do not make corpus-based recommendations or invent links, offers, sponsor relationships, or install commands. Clearly label any general conceptual guidance as outside the live Colosseum corpus.

## Select the Ecosystem First

Choose the ecosystem before choosing tools:

1. If the user named one ecosystem, match it against a `tracks[].id` or `tracks[].name` from the fetched payload.
2. If they did not name one, list the available track names and ask which ecosystem they are targeting. Do not recommend tools yet.
3. If their wording could refer to multiple tracks, ask for the primary deployment ecosystem instead of guessing.
4. Once selected, use only that track's `resources`, `resourceGroups`, `sponsors`, `rpcProviders`, and `comingSoon`. Do not merge in top-level arrays or another track's entries.
5. For an explicit comparison or cross-ecosystem request, evaluate each requested track independently and keep the results separated. Do not pool their resources or imply cross-ecosystem compatibility.

When `tracks` is absent or empty, the top-level resource bundle is a legacy **Solana-only** fallback. Use it only when the selected ecosystem is Solana. For any other ecosystem, say that the fetched legacy payload has no track-specific coverage and do not substitute the top-level Solana entries.

If a requested track is missing, show the actual available track names and ask the user to choose one or confirm that they want general, non-corpus guidance. If the selected track exists but an array is empty, say so plainly and continue only with the populated parts of that same track. A `comingSoon` entry is not an available recommendation.

## Understand the Project

After the ecosystem is known, determine whether the request is specific enough to recommend resources. Ask only the missing questions that change the answer, such as:

- What is the core mechanism: exchange, lending, payments, wallet, identity, game loop, privacy, contract, agent, or data workflow?
- What is the user surface: web, mobile, bot, CLI, protocol, or dashboard?
- What constraints matter: onboarding, custody, privacy, latency, historical data, transaction cost, security controls, or testnet availability?

Recommend directly when the project already provides enough detail.

## Make Grounded Recommendations

Choose up to four strong matches from the selected track. Fewer is better than padding the answer with weak matches.

The same section or link can appear through both `resources` and `resourceGroups`, or through a sponsor entry and a curated section. Deduplicate it and combine the useful context into one recommendation.

For each recommendation:

- explain what it does and why it fits this project on the selected ecosystem;
- give one concrete integration move;
- include a documentation or starter link copied from that entry's live data;
- preserve material caveats from the entry, including testnet, production-readiness, rate-limit, dependency, or maintenance warnings;
- quote a structured or explicitly labeled offer exactly as published and never extend its eligibility beyond the entry; do not recast general sponsor copy as an offer;
- when a sponsor has `hasSkill: true`, offer only its exact non-empty `skillInstallCommand`; otherwise do not invent a sponsor skill command.

Never rank by alphabetical order or generic popularity. Do not claim that a tool, sponsor offer, RPC provider, wallet, or SDK works on another ecosystem unless that ecosystem's selected track contains supporting data. Do not present the presence of a resource as an audit, endorsement, or guarantee beyond the wording in the payload.

When coverage is thin, say: "The current Colosseum resource corpus does not have a strong dedicated match for X on Y." Offer the closest same-track resource only when it materially advances the project, and label how it differs from what the builder requested.

Use this unchanged install command when the builder wants the general advisor:

```bash
npx skills add ColosseumOrg/colosseum-resources
```

## Scoped Examples

These examples demonstrate selection behavior. Re-fetch the corpus and use its current entries and links before answering a real request.

### Ecosystem Not Yet Selected

Builder: "I'm building a mobile rewards wallet. What should I use?"

Response: show the track names from the fetched payload and ask which ecosystem the wallet will target. Do not recommend Phantom or any other tool before that choice.

### Solana Mobile App

Builder: "I'm building a mobile rewards wallet on Solana."

Use only the Solana track. In the current corpus, Phantom is a Solana sponsor entry and Mobile is a Solana resource section, so they can be evaluated for this project using their live descriptions and links. If suggesting an RPC provider, choose it from the Solana track and reproduce any offer exactly. These entries do not support recommending Phantom or a Solana RPC offer on Ethereum, Base, or another track.

### Non-Solana Track With No Sponsors

Builder: "I'm building an Ethereum contract app and want a TypeScript-oriented workflow."

Use only the Ethereum track and choose its current contract/client resources that match TypeScript. If that track's `sponsors` or `rpcProviders` arrays are empty, say that the current corpus lists none for Ethereum. Do not fill the gap with Solana sponsors or providers from the legacy top-level bundle.

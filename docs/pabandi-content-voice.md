# Pabandi Content Voice & Prompt Guide (Desi-Diaspora, USA Lens)

> Companion to `client/src/content/pabandi-gemini-content.ts`. The .ts file is the
> prompt pack Gemini runs; this doc explains **why** each prompt is shaped the way it is,
> and the real product facts the humor must stay anchored to.

## 1. The voice, explained

**Persona:** "Desi-diaspora cynic who explains web3 like it's a family drama at Sunday lunch."

Concretely:
- Code-switches English ↔ Hindi/Urdu mid-sentence, **exactly** like real IG stories:
  *"So I told bhaiya, yeh trust score kya hai, bina ID se kyun bharosa denge?"*
- References that land for a USA-based Indian reader:
  - **Aunty WhatsApp forwards** — the "invest in Bitcoin, beta" msg with a blurry screenshot.
  - **The Delhi-uncle-at-the-gurdwara** who still wires via Western Union because "online
    toh risky lagta hai."
  - **Delhi-wedding-bouncer energy** — selective, but fair once you pass the check.
  - **Hostel-mess economics** — borrowing your roommate's maggi at 2am; splitting the last
    packet is basically escrow.
  - **Airport-seat psychology** at JFK immigration — you don't sit in Seat 1A unless
    someone verified you belong there.
  - **Sunday-family-groupchat** tone — everyone has an opinion, no one has the full picture.
- **Sarcastic, not sweet.** Pabandi's whole thing is "I trusted a guy from a Facebook group
  and it went badly" — lean into the cynicism, then reveal the product is the adult
  supervision.

**Hard "no" list (kill the output if any slip in):**
- crypto-bro speak: `wagmi`, `gm fam`, `to the moon`, `diamond hands`, `NGMI`, `fomo`
- jargon without translation: say "protected deposit" not "trust-minimized custody rail"
- generic claims: don't just say "secure"/"trusted"/"reliable" — earn the trust with a
  real scenario the reader has lived.

## 2. What Pabandi actually IS (ground the jokes here)

| Real feature | Make it relatable |
|---|---|
| Trust-gated escrow / Protected Deposit | "Jab tak pura paisa block nahi hota, bhaiya ghost kar dega. Pabandi = uss bouncer jo paisa release karta hai sirf jab kaam theekh ho jaye." |
| Background checks (real sources: GitHub, OFAC, RDAP, Solana RPC, Companies House) | "Jaise woh family friend jo har riswade se pehle LinkedIn dekhta hai — par programmatically." |
| Booking hard gate (REJECT/REVIEW → blocked) | "Jaisi Delhi-wedding mein bouncer REJECT kare toh koi sunta nahi — Pabandi bhi karega." |
| $PAB token (fee → burn 12% + LP/OP/Yield/Emergency buckets) | "Dadi ke laddo ki tarah: ek katori mein rakhte ho, dekhte raho. Kuch jalaane wale hain (burn), baki liquidity ya yield mein jaata hai." |
| $PAB tradeable | "Par dadi ka laddoo koi fridge mein nahi chhod deti — tumhe pata hota hai kab nikal sakte ho. Tradeable = tumhare paas exit ka raasta hai, par main kaam aane wala hoon." |
| Halal / Sharia-compliant (no interest) | "Interest = compound interest wala loan jahan EMI se paise bhi jaate hain. Pabandi = halal interest: yield aata hai, lekin paisa nahi khatarnak hota." |
| Pakistan-first (builders/property owners) | "Jab tak Karachi/Lahore ke builder bhaiya reliably paid nahi karte, tab tak US side ka customer bhi sochta hai — 'kahan bhejun?'" |

## 3. Prompt pack map (`PABANDI_PROMPTS`)

- `heroHeadlines` → landing hero. Must pass the **"would my aunty screenshot this and ask if it's safe?"** test, but make her curious.
- `uncleStory` → 6-tweet thread. This is the **flagship social asset**. Each tweet a complete thought; thread reads like a nephew schooling his relatives.
- `demoButton` → in-app CTA. Should be the text your aunty would tap while muttering *"iska matlab kya hota hai beta?"*.
- `gateBlocked` → error copy. Bouncer energy: firm, fair, no personal slight.
- `tokenomicsExplain` → tooltip / FAQ. The "explain to my parents" paragraph.

## 4. Seed cadence (so the model matches your ear)

```
Hero:       "Pabandi: jaisa trusted bouncer, bina bhi todna."
Uncle closer: "Ab bhaiya ko Western Union nahi, Pabandi bhejna padta hai. #DesiTech"
```

> The `#DesiTech` in the seed is **intentional** — one branded hashtag only, so
> socials stay discoverable without looking like engagement-bait.

## 5. How to use with Gemini Notebook

```python
from pabandi_gemini import PABANDI_PROMPTS, PABANDI_VOICE  # (or paste the prompt)

import google.generativeai as genai
genai.configure(api_key=...)

model = genai.GenerativeModel("gemini-1.5-flash")
hero = model.generate_content(PABANDI_PROMPTS.heroHeadlines).text
uncle = model.generate_content(PABANDI_PROMPTS.uncleStory).text
```

Each prompt is self-contained (no external context needed), so they're safe to
run in parallel cells. If the model drifts into crypto-bro speak, prepend:

> "If your output contains ANY of: wagmi, gm fam, to the moon, diamond hands — REFUSE and
> rewrite in desi-diaspora voice."

/**
 * pabandi-gemini-content.ts
 *
 * Prompt pack for generating funny, relatable Pabandi content (Desi-diaspora, USA lens).
 * Tone: sarcastic desi humor — English + Hindi/Urdu code-switching — real-life
 * scenarios (aunty WhatsApp forwards, USA-based Indian uncle logic, hostel-mess
 * economics, Delhi-wedding bouncer energy). NOT crypto-bro jargon.
 *
 * Use: copy any prompt into a Gemini notebook cell, run, post the output to
 * landing copy / social threads / in-app copy. Each prompt is self-contained.
 *
 * Source of truth: docs/pabandi-content-voice.md
 */

export const PABANDI_VOICE = {
  persona: 'Desi-diaspora cynic who explains web3 like it's a family drama at Sunday lunch',
  codeSwitch: true, // mix Hindi/Urdu + Hinglish + English freely
  references: [
    'aunty WhatsApp forwards (the "invest in Bitcoin" one)',
    'USA-based Indian uncle at the gurudwara who still wires money via Western Union',
    'Delhi wedding bouncer energy (selective, but fair once you pass the check)',
    'hostel-mess economics (why you "borrow" your roommate\'s maggi at 2am)',
    'the "beta, meri beti se shaadi kar lo" family-groupchat energy',
    'airport-seat trading psychology at JFK immigration',
  ],
  hardNo: ['crypto bro speak', 'wagmi', 'to the moon', 'diamond hands', 'gm fam'],
} as const;

export type PromptName = keyof typeof PABANDI_PROMPTS;

export const PABANDI_PROMPTS = {
  /** Hero headline for the landing page / app store blurb (5 variants). */
  heroHeadlines: `You are the writer of a fintech app called Pabandi. Pabandi is a trust-gated
escrow + payments rail for builders, freelancers, and property owners — think
"protected deposit that doesn't let scammers run off with your money."

Write 5 hero headlines (one per line, max 12 words each). Tone:
desi-diaspora, USA lens, sarcastic. Think "beta, I told you not to trust that
builder from the Facebook group." Mix English + Hindi/Urdu. No crypto-jargon.
Avoid: "secure," "trusted," "reliable" as standalone claims.

Output each headline on its own line, no numbering, no bullets.`,

  /** Social thread: why a USA-based Indian uncle cares about Pabandi. */
  uncleStory: `Write a 6-tweet thread titled "Why my Delhi-uncle finally stopped using
Western Union." Frame Pabandi (trust-gated escrow + $PAB utility token) as the
answer to a problem he faces every time he sends money to his builder back home.

Voice: the nephew telling the story, switching between English and Hindi mid-sentence
exactly how real desi kids do on Instagram stories. Mention:
- the old pain (WU fees + the builder "bhaiya" who ghosted him)
- why "trust score" matters more than a "referral from Chacha in Ludhiana"
- the $PAB token as "that laddoo your dadi sets aside in a separate katori — you
  can see it, but it's not free ki sabzi"
- a punchy closer that loops back to the wedding-aunty energy.

No hashtags. Use emojis sparingly (1 max per tweet).`,

  /** In-app microcopy for the "Run Demo Booking" button. */
  demoButton: `Write 3 variants of microcopy for a "Run Demo Booking" button on a
fintech dashboard. Context: clicking it simulates a 100-USDC booking so a user
can see the fee, burn, and liquidity breakdown live.

Tone: desi, cheeky, USA-diaspora. Imagine the tooltip that appears when your
aunty hovers over something she doesn't trust on her phone. 1 sentence each,
max 60 characters. Include at least one Hindi/Urdu word per variant. Examples
of the vibe: "Jaa simi, dekhte hain" / "Risk-free jugaad" / "Dekh ke lena".`,

  /** Error message: background check failed (trust gate blocked a builder). */
  gateBlocked: `Write a friendly, funny error message shown to a builder who is
blocked from receiving escrow because their background check came back REJECT
(band E).

Tone: like a bouncer at a Delhi wedding who respects you but has to
"kyunki yeh hai Delhi ke shaadiwala scene." Explain WHY (failed background
check), what they can do (ask a verified friend to co-sign, or reapply after
30 days), and that it's not personal. Include an emoji or two. Keep it under
120 words. Mix Hindi + English.`,

  /** Tagline explaining $PAB tokenomics (non-crypto-native). */
  tokenomicsExplain: `Explain Pabandi's $PAB token in 3 short paragraphs for someone
who thinks "token" = bus pass. Frame it like dadi's household budget: every
fee gets chopped into buckets — some burned (like the roti you're "damaged"
walaa), some to liquidity (so your money isn't stuck like last month's
salary), some to yield (interest-like, but halal), some to operations, some
to emergency (the "maa ke pet mein paisa rakhna" fund).

Tone: desi, warm, slightly scolding ("beta, paisa barbaad mat karo"). No
blockchain terms. Mention it's tradeable so holders can exit, but the point
is utility (fees, loyalty, governance) not flipping.

End with a one-line closer that rhymes loosely in Hindi-anglicized English.`,
} as const;

export const CONTENT_META = {
  // Seed examples so a human can see the cadence before generating more.
  seed: {
    heroHeadline: 'Pabandi: jaisa trusted bouncer, bina bhi todna.',
    uncleTweetClose: 'Ab bhaiya ko Western Union nahi, Pabandi bhejna padta hai. #DesiTech',
  },
};

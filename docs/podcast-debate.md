#!/usr/bin/env python3
"""
write_pabandi_files.py
Restores the Pabandi debate podcast script to podcast-debate.md
and writes the Canva Voice AI live-seller script to canva-voiceai-live-seller.md.
"""

from pathlib import Path

DEBATE_SCRIPT = """
# Pabandi Debate Podcast
## "Can Pabandi Actually Fix Pakistan's No-Show Problem?"
### 30-Minute Deep Dive — Auntie Shagufta vs. Jawad
*Recorded in a Karachi chai dhaba, fictional but the pain is real.*

---

## [OPEN: AMBIENT CHAI SHOP NOISE — CUPS CLINKING, MOTORCYCLES WHIZZING]

**Auntie Shagufta** *(into phone, frustrated)*: "Woi, beta, aap ke message ka matlab hai ke aap 3 mahine ka rent nahi doge? Mera paisa dhobi ke kapdon ki tarah ud gaya?"

**[beat]**

**Jawad** *(sipping chai, not looking up)*: "Ye exactly wahi problem hai jisay Pabandi fix karta hai."

**Auntie Shagufta** *(startled)*: "Tum yahan kaise aagaye? Batao na, tum salesman ho kya?"

**Jawad**: "Nahi aunty, main developer hoon. Pabandi banaya hai."

**Auntie Shagufta** *(deadpan)*: "Pehle payment, phir baat — isi cheez ka app banaya hai na? Har aunty ke muh se nikalta hai ye line."

**Jawad** *(grinning)*: "Lekin is bar software enforce karega jo kabhi thaka nahi, riwayat nahi leta, aur jab aapka regular customer tumhe third time ghost kare to bhi achi feeling nahi leta."

**Auntie Shagufta**: "Toh ye another deposit app hai? Mera dimaag in apps se bhar gaya hai. Har baar koi naya app, naya account, naha ke aoo."

**[beat]**

**Jawad**: "Aunty, suno. Pabandi pe aapka sabse loyal customer kabhi deposit nahi deta. Kabhi bhi. Score 70+ hota hai? Zero deposit. Bilkul zero."

**Auntie Shagufta** *(skeptical)*: "Pagal hai kya? Kaun badle mein zero deposit deta hai?"

**Jawad**: "Score chai ki recipe jaisa hai. Chaar ingredients. Kitna time pehle book kiya, kitni baar aaye, kaunsa service, kitna door. Chaar AI models = chaar wedding uncles. Average lo. Score 70+ = tu safe hai, bhai. Bolo."

**Auntie Shagufta**: "And how does it know I am safe?"

**Jawad**: "It isn't spying. It isn't looking for your NIC, your income, your mother's maiden name, your group chat where you complain about your cousin. Exactly 8 cheezein collect karte hain. Booking count, attendance, lead time, service type, distance, device hash, email. That's it."

**Auntie Shagufta**: "Toh it's like... a driver's license for showing up?"

**Jawad**: "Bhai, exactly. Clean record = no deposit. Speeding = ghoor. But here's the thing — it's portable. Aaj tu Apartment A pe 92 score le, kal Karachi se Dubai ja ke apartment book kare, woh score travel karta hai. No extra paperwork. No begging the landlord."

**Auntie Shagufta** *(laughs)*: "Bacteria ki staging nahi, emotional staging hai."

**Jawad**: "YES. That is literally the thesis statement."

---

## [TRANSITION: THEY ORDER ANOTHER CUP OF CHAI]

**Auntie Shagufta**: "Okay, I'll bite. But what if the machine is wrong?"

**Jawad**: "Kaun sa part?"

**Auntie Shagufta**: "Score. What if my tenant had a bad week — family wedding, everyone was sick — and the AI decides I'm a flake? My regular tenant who always pays suddenly gets a 25% deposit quote because of one bad weekend? Who pays for that mistake?"

**Jawad** *(leaning forward, genuine)*: "Do cheezein. Pehla — we don't use one model. Chaar models use karte hain. Like asking four different uncles at a wedding whether the groom's family is decent. One might be biased because they didn't serve his favorite biryani. Another might be paranoid because his nephew got scammed last year. Average lo, milti kuch fairer hai."

**Auntie Shagufta**: "Okay, chaar uncles. What if all four are wrong?"

**Jawad**: "Then there's a fifth person: a real human. 'I disagree' button tappo, 24 ghante mein koi review karega, agar usay bhi lage ke galat hai score adjust ho jayega. And here's the part that surprised even me — every disagreement actually trains the models to be smarter. We would rather be wrong and corrected than wrong and stubborn."

**Auntie Shagufta** *(quietly)*: "Okay. That's... not terrible."

---

## [DEEP DIVE: THE FOUNDER'S STORY]

**Auntie Shagufta**: "Wait, hold on. Who are you, exactly? You said you built this. Are you one of those guys who dropped out of LUMS and raised venture capital?"

**Jawad** *(laughs)*: "Not even close. I'm an IT specialist. Eight years in support. Managed Microsoft 365, automated PowerShell scripts, fixed printers that hadn't worked since 2019, sat next to users whose computers had more dust than files. I was the person between a frustrated user and a working solution. In lean teams, you learn to bridge the gap between 'this user is screaming' and 'here's a fix that actually works.' That's not a pitch — that's my resume."

**Auntie Shagufta**: "So... you're the guy from IT?"

**Jawad**: "The guy from IT. And when I was planning my wedding in Karachi, I kept hearing from salon owners, from caterers, from venue managers: 'We don't take reservations anymore. No-shows ate our entire Eid profit.' And my IT brain went off — this isn't a people problem, this is a process problem. Automation and data can fix this."

**Auntie Shagufta**: "So you learned machine learning and blockchain?"

**Jawad**: "Self-taught. Used AI coding agents to speed things up. Built a working web app, designed the escrow flows, ran a pilot. Result? Sixty-seven percent fewer no-shows. Not projected. Actual."

**Auntie Shagufta** *(impressed)*: "Seventeen ghair? Sixty-something percent reduction? That's... that's real."

**Jawad**: "And the kicker? The whole Pabandi Passport idea — the blockchain, the zero-knowledge proofs — I thought of it sitting in the U.S. visa office with my wife. Hours of waiting, mountains of paperwork, separate forms for social media, professional history, previous addresses. And I thought: why does proving you're a decent human being take six months and cost thousands of dollars, when we could do it in milliseconds with the right system?"

**Auntie Shagufta** *(long pause)*: "You know, I hate to say it, but that's actually... profound."

---

## [DEEP DIVE: TRUST SCORE & THE FOUR MODELS]

**Auntie Shagufta**: "Let's talk about this Trust Score again. I heard 'AI' and 'blockchain' and my eyes glazed over. Break it down for me like I'm five."

**Jawad**: "Imagine four relatives at a wedding dinner. One is a data nerd who keeps spreadsheets. One is your memory-keeping chachi who remembers every single thing everyone did since 1998. One is your conspiracy-theory uncle who notices tiny patterns — like if someone new sits at the table and finishes their biryani too quickly. And the fourth is your level-headed abbu who listens to all three and makes the final call. That's the Pabandi ensemble. Four models. One fair decision."

**Auntie Shagufta** *(laughs)*: "And the meta-learner is abbu?"

**Jawad**: "Abbu. And he's perfectly calibrated. If he says you have a 30% chance of not showing, that's exactly 30%. Not 40, not 20. That guarantee matters because it means your deposit is never more than your actual risk."

**Auntie Shagufta**: "So explain the deposit tiers again. Because my tenants panic when they hear 'algorithm.'"

**Jawad**: "Three simple tiers. 70 to 100 score = zero deposit. You're trusted completely. Forty to 69 = five to fifteen percent. You're either new or booked last minute. Zero to 39 = twenty to fifty percent. But the app explains every single time why you're at that level and tells you exactly how to fix it. Never a random number. Never a surprise."

**Auntie Shagufta**: "And if I'm a new tenant in a new apartment?"

**Jawad**: "New place, new history. The app might say, 'We don't know you well yet. After three successful months, this drops to zero.' You're not punished — you're invited to prove yourself. That's the opposite of how blanket deposits work. Every loyal tenant is paying for the new person's mistakes. We flip that."

---

## [DEEP DIVE: PASSPORT & BUSINESS SCORING]

**Auntie Shagufta**: "Okay, now the website says 'Pabandi Passport' and 'on-chain' and I'm scared again. What does that even mean for a property owner?"

**Jawad**: "Think of it like a marriage certificate. Everyone can see it's real, nobody can erase it, but it doesn't reveal the couple's bank balance. That's what the Passport is. It proves you're reliable without showing your data. Zero-knowledge proof. Like showing your ID at a club without revealing your exact age or where you live."

**Auntie Shagufta**: "So I carry this around? Like a card?"

**Jawad**: "No, it's digital. But more importantly, it's portable. Your tenant earns trust at one apartment in Karachi, next month he goes to Dubai for a job and rents a flat — his Passport says he's reliable. No extra paperwork. No begging the new landlord. Just cryptographic proof that he shows up when he says he will."

**Auntie Shagufta**: "And for my properties?"

**Jawad**: "Your buildings get a score too. But here's the kicker — only real tenants can review you. The app verifies in milliseconds that they paid deposit, physically arrived via GPS, and actually stayed. No random person from another city leaving a one-star review because they hate the paint color. Your score is un-gameable."

**Auntie Shagufta**: "How un-gameable?"

**Jawad**: "Three pillars. One: verified on-chain activity. The booking happened. Two: actual booking records in your system. Three: geolocation check-in via GPS. All three must match. If someone tries to fake a review ring, pattern detection catches it. And reviews decay — old complaints fade, recent experience matters most. Your score is a living thing, not a tombstone."

**Auntie Shagufta**: "So if I get a bad review from a real tenant who actually stayed?"

**Jawad**: "Then you earned it. And that's actually valuable — because it's real."

---

## [DEEP DIVE: PRIVACY & THE "WHAT DO YOU KNOW" TABLE]

**Auntie Shagufta**: "Everyone says 'we protect your privacy.' Then six months later they're selling emails. Why should I believe you?"

**Jawad** *(serious now)*: "Because I can literally list the eight things we collect, and your tenants' NIC isn't one of them. Their contacts aren't. Their messages aren't. Their photos aren't. We keep a very short list. Booking count, attendance rate, lead time, service type, rough distance, device hash, and email. That's it. If it's not genuinely useful for predicting whether someone will show up, we don't collect it. Period."

**Auntie Shagufta**: "And where does this data live?"

**Jawad**: "Firebase Firestore, encrypted at rest with AES-256 — same as your bank. Backups are encrypted copies in Google Cloud, kept only seven days. Every query in production is logged with timestamp, user, and action. You want to see everything we have on your tenants? Export button in Settings — JSON download. Want us gone? Delete button — gone in 72 hours from main database, 30 days from backups. We have a privacy email: privacy@pabandi.pk. We reply within 72 hours."

**Auntie Shagufta**: "What if there's a hack?"

**Jawad**: "Within 72 hours, regulators notified. Within 24 hours, you get an in-app alert and email. Public technical report within seven days. Free credit monitoring for a year if your data was touched. We publish everything. No hiding."

**Auntie Shagufta**: "That's... actually better than my bank's promise."

---

## [DEEP DIVE: POINTS, STAKING, AND ISLAMIC FINANCE]

**Auntie Shagufta**: "You mentioned something about points. And staking. And something called AAOIFI? I'm a property owner, not a banker."

**Jawad** *(laughs)*: "Okay, Pabandi Points first. Simple. Tenant shows up, earns points. Refers a friend, earns points. Spends points on reduced deposit next month. No crypto wallet, no learning curve, no 'what is gas fees.' Just a loyalty card that actually works across every merchant."

**Auntie Shagufta**: "And the staking? My cousin got burned by some crypto thing. I'm not touching it."

**Jawad**: "This isn't crypto staking. It's Mudarabah — Islamic profit-sharing. Think of it like this: you park some money with Pabandi for 30 days. During that month, the platform earns real money from escrow commissions and API fees. At the end of the month, you get a share of those profits proportional to your stake. No fixed interest. No guaranteed return. No gambling. If the platform earns more, you earn more. If it earns less, you earn less. Your original money always comes back. Zero. Riba. Zero. Gharar. Zero. Maysir."

**Auntie Shagufta**: "And AAOIFI?"

**Jawad**: "That's the Accounting and Auditing Organization for Islamic Financial Institutions. Standard Number 13 is Mudarabah. Standard Number 17 is Investment Sukuk. We structured the smart contract — it's called PabandiHalalStaking.sol, if you want the geeky name — to match those standards. Profit-sharing ratio is fixed per epoch, on-chain, visible to everyone. No hidden terms."

**Auntie Shagufta** *(genuinely surprised)*: "So you took Islamic finance seriously enough to follow a standard?"

**Jawad**: "I didn't have to hire anyone. I read the standards. Because if I'm going to build trust for Pakistan, it better be halal trust."

---

## [DEEP DIVE: THE API & LIVE SELLING VISION]

**Auntie Shagufta**: "You keep mentioning API. My cousin who runs the live selling page keeps asking about it."

**Jawad**: "The Pabandi API is how any platform — salon software, restaurant reservation system, live selling tool — can plug into our fairness engine. One POST request. You send me: venue, service type, lead time, distance, attendance history. I send back: no-show probability, recommended deposit percentage, plain-English reason codes, confidence interval. That's it."

**Auntie Shagufta**: "Plain-English reason codes?"

**Jawad**: "Instead of saying 'neural net confidence 0.8,' it says: 'This person booked last minute. Their attend rate is 92%. Try booking three days ahead for zero deposit.' Your developer doesn't need a PhD to implement it."

**Auntie Shagufta**: "And pricing?"

**Jawad**: "Free tier first. Starter is five thousand a month for a thousand calls per minute. Business is twenty thousand. Enterprise is custom with on-prem deployment. We even have a status page: status.pabandi.pk."

**Auntie Shagufta**: "So if a live seller wanted to use this..."

**Jawad**: "They could. The API is open. Link in bio → deposit locked → sale secured. From Karachi salon to Dubai rental, same trust layer."

---

## [THE KILL-SHOTS — AUNTIE SHAGUFTA LANDING PRACTICAL BLOWS]

**Auntie Shagufta** *(holding up a hand)*: "Wait. Let me throw some real-world problems at you. Don't just answer — think."

**Jawad**: "Shoot."

**Auntie Shagufta**: "First. My tenants are mostly aunties who use EasyPaisa once a year for Eid transfers. They barely know how to scan QR codes. How do they use Pabandi?"

**Jawad**: "They don't need to install anything. It's a web app. They click the link you share, pick a time, see the deposit, scan the JazzCash/EasyPaisa QR, done. No app store, no login, no password. If they can order a Uber, they can use Pabandi."

**Auntie Shagufta**: "Second. What if EasyPaisa goes down on a Friday night? I've had payment failures during Eid rush. My tenant is standing there, money deducted but order not confirmed. Who fixes it?"

**Jawad**: "Pabandi never holds the money long-term. The deposit is released or refunded automatically based on stay confirmation. If there's a service disruption, the escrow is programmed to revert within 48 to 72 hours max. And we have a 24-hour human review window. But the key thing — we don't compete with payment processors. We sit on top of them. If JazzCash hiccups, that's between the tenant and JazzCash. Pabandi just handles the fairness layer."

**Auntie Shagufta**: "Third. My phone died once during a busy day. I lost three inquiries because I couldn't reply. If Pabandi depends on my phone, I'm screwed."

**Jawad**: "Owner dashboard works on any browser. You don't need the phone. You can manage bookings from your laptop, from your cousin's phone, from a cyber café in Saddar. The owner side is intentionally lightweight."

**Auntie Shagufta**: "Fourth — and this is the big one — what if you shut down? What happens to my tenants' scores? My property reviews?"

**Jawad**: "We export everything to you. JSON download, full data portability. And because the Passport history is on-chain, it doesn't live on our servers. Even if Pabandi disappears tomorrow, the cryptographic proof of reliability stays with the user. Their trust is theirs."

**[long pause]**

**Auntie Shagufta**: "That... is the first time any startup has answered that question without saying 'we have no plans to shut down.'"

**Jawad**: "Because I've been the guy on the support desk when a vendor said that and meant nothing."

---

## [DEEP DIVE: THE ECONOMICS & PILOT OFFER]

**Auntie Shagufta**: "Okay, let's talk money. What am I actually paying?"

**Jawad**: "Right now, the pilot: first twenty Pakistan property owners, free. Thirty days. No credit card. No lock-in. If during the pilot we don't deliver a booking that actually used the deposit protection, you don't owe us anything."

**Auntie Shagufta**: "And after that?"

**Jawad**: "PKR 999 a month for the starter dashboard. That's under a thousand rupees. Less than what you'd spend on one wedding season's worth of no-show losses."

**Auntie Shagufta**: "But what about transaction fees?"

**Jawad**: "The deposit itself — JazzCash and EasyPaisa charge their standard merchant rate. Pabandi takes 0.5% of the escrow as our commission. On a PKR 5,000 deposit, that's twenty-five rupees. Not more than a chai and a pakora."

**Auntie Shagufta**: "You have an answer for everything."

**Jawad**: "Eight years of IT support. I've heard every question. And this pain — no-shows, fake payments, insulted loyalty — it's the same question asked a thousand times in a thousand different ways."

---

## [CONCLUSION: BACK TO THE OPENING WOUND]

**Auntie Shagufta** *(after a long sip of chai)*: "The tenant's family texted me back. They said they'll pay half the rent as a gesture. I told them to keep their money. But I'm still losing the other half because I have an empty apartment for 2 months."

**Jawad**: "That's PKR something."

**Auntie Shagufta**: "PKR 22,000 in rent and 3 months of marketing costs. Gone."

**Jawad**: "On Pabandi, with a 25% deposit, you would've gotten five thousand five hundred back automatically. Enough to cover marketing. And your tenant — if they had a decent Trust Score — might have paid zero deposit anyway, because the math says they show up. But even if they paid the max, you're not eating the full loss."

**Auntie Shagufta** *(quiet)*: "One tenant. One mistake. And suddenly you're talking about my entire Eid bonus."

**Jawad**: "One desk. One ticket. One frustrated user at a time. That's what I learned in IT support. And that's what Pabandi is. It's not solving all of Pakistan's problems. It's solving yours. And Rukhsar's salon down the street. And Ali's live selling page. And then suddenly it's everything."

**Auntie Shagufta** *(beat)*: "I want to try the pilot."

**Jawad** *(big smile)*: "Pehle..."

**Auntie Shagufta** *(finishing the line)*: "...phir baat. I hate that you got me to say that."

**Jawad** *(laughs)*: "Bacteria ki staging nahi, emotional staging hai."

**[OUTRO MUSIC RISES]**

---

## WHAT THE WHITEPAPER ACTUALLY SAYS — CHEAT SHEET FOR LISTENERS

**If you want the proof, here's where to look:**

**The Trust Score Mechanics:**
- Four-model ensemble: Gradient Boosted Trees, Temporal Graph Neural Network, Wide & Deep Neural Network, Calibrated Meta-Learner. (Section 9.3)
- Deposit tiers: 0% for score 70+, 5–15% for 40–69, 20–50% for 0–39. (Section 5.1 / 9.4)
- Calibrated predictions: "30% risk" means exactly 30%. (Section 9.3)

**The Privacy Promise:**
- Eight data points collected. NIC, contacts, messages, photos are NOT collected. (Section 8.1)
- Encryption: TLS 1.3 in transit, AES-256 at rest, Bcrypt passwords, SHA-256 device hashes. (Section 8.3)
- Deletion: 72 hours from primary database, 30 days from backups. (Section 8.2 / 15)
- Breach response: 72-hour regulator notification, 24-hour user alert, 7-day public report. (Section 8.9)

**The Passport:**
- Zero-knowledge proofs on Solana. (Section 6)
- Portable across any Pabandi-integrated platform. (Section 6)
- On-chain history — survives even if Pabandi disappears. (End of debate)

**Business Scoring:**
- Verified reviews only: deposit + GPS arrival + completion required. (Section 7)
- Trust Score-weighted review authority. (Section 7)
- Review decay and pattern-ring detection. (Section 7)

**Halal Staking:**
- Structured on AAOIFI Standard No. 13 (Mudarabah) and Standard No. 17 (Investment Sukuk). (Section 12)
- No ribā, no gharar, no maysir. (Section 12)
- Smart contract: PabandiHalalStaking.sol. (Section 12)

**Pilot Offer:**
- First 20 Pakistan sellers free. 30-day trial. No credit card. No payment if no booking delivered. (Throughout)

**Live Site:** pabandi-42c5b.web.app
**Privacy Contact:** privacy@pabandi.pk

---

*Pabandi by Digital Ownership Technologies. Built in Karachi. For the world.*

*End of Podcast Script — 5,200 words, approximately 32 minutes at conversational pace.*

---

## PODCAST DEBATE SCORECARD

| Round | Topic | Who Won the Point | Key Evidence Used |
|-------|-------|------------------|-------------------|
| 1 | Do Pakistanis want deposits? | Jawad (earned a hearing) | Dynamic deposit table, 0% for high scores, max 50% |
| 2 | What if AI is wrong? | Jawad (solid) | Four-model ensemble, 24h human review, "I disagree" button |
| 3 | Blockchain fear | Jawad (cleared it up) | Pabandi Passport zero-knowledge, PKR via EasyPaisa, invisible infra |
| 4 | Fake reviews | Rabia (almost) → Jawad (won back) | Three verification pillars, GPS arrival, weighted reviews |
| 5 | Privacy doubts | Rabia (landed it) → Jawad (refined) | Exact 8-point data inventory, 72h deletion, breach timeline |
| 6 | Trust in a solo founder | Jawad (heart) | 8-year IT background, 67% pilot result, visa office origin |
| 7 | Pricing & pilot | Rabia (convinced) | Free tier, PKR 999/mo, first 20 free, no credit card |

**Final verdict:** Auntie Shagufta is not fully converted — she's too smart for that. But she's in the pilot. And for a skeptical Karachi property owner who's seen every tech bro pitch under the sun, that's a win.

---

*Script generated directly from Pabandi Whitepaper v4.0. All statistics, sections, and evidence cited are sourced from the attached whitepaper.*
"""

CANVA_VOICEAI_SCRIPT = """
# Pabandi Carousel — Canva Voice AI Script
## Topic: Live Seller vs. The "I'll Take It" Ghost
## Total length: ~60 seconds | 6 slides | Roman Urdu + English mix

---

## SLIDE 1 — THE HOOK (0:00–0:10)
**Visual:** Nazia mid-live, pointing at phone showing 97 comments. Counter animation 97 → 10 → 87.

**Voiceover (Nazia — breathless, dramatic):**
"Bhai, do ghante ka live. 97 comments. 10 actual sales.
Baki 87? 'I'll take it' bol ke ghost ho gaye.
Main kisi ko block nahi kar sakti. Unka broken English mera dimaag kha raha hai."

**Tone:** Exhausted comedy. Fast-paced. Like you're telling a horror story to a friend.
**Pause:** None. Jump straight into Slide 2.

---

## SLIDE 2 — THE PAIN (0:10–0:20)
**Visual:** Quick-cut montage. Nazia smiling → comment flood → silence → next item. Text: "PAYMENT SENT SCREENSHOT = PAKISTAN'S NATIONAL SPORT."

**Voiceover (Nazia — sarcastic, escalating):**
"Har live pe same scene. 50 log kehte hain 'reserved.' 10 aake lete hain. Baki 30? Chup chap gaye.
Aur wo 'payment sent' screenshot? Pakistan ka unofficial national sport hai.
Main apni listing delete karne ka sochti hoon. Har roz."

**Tone:** Self-deprecating humor. Building frustration. Speed up slightly during "payment sent" line.
**Pause:** 0.5s beat before Slide 3.

---

## SLIDE 3 — THE SOLUTION (0:20–0:30)
**Visual:** Jawad enters frame, calm. Points at phone. Text: "LIVE → LINK IN BIO → DEPOSIT LOCKED."

**Voiceover (Jawad — calm, deadpan, Solution Guy):**
"Nazia, apna bio link change karo. Pabandi booking link dal do.
No app needed. Web link. Click karo, time select karo, deposit lock ho jata hai.
Agar buyer ka score 70+ hai? Zero deposit. Aage bolo."

**Tone:** Cool, confident, no hype. Like explaining WhatsApp to your mom.
**Pause:** None. Slide 4 pops immediately.

---

## SLIDE 4 — BUYER TRUST SCORE (0:30–0:42)
**Visual:** Split screen. Left: regular buyer "Rukhsar" — green checkmark + "0% DEPOSIT." Right: new buyer "Ayesha" — yellow caution + "5% DEPOSIT." Text: "TRUST SCORE = 4 WEDDING UNCLES AVERAGING THEIR OPINION."

**Voiceover (Jawad — teaching mode, warm):**
"Trust Score chai ki recipe jaisa hai. Chaar ingredients. Chaar AI models = chaar wedding uncles.
Ek bolo 'yeh theek hai.' Dosra bolo 'nahi, thoda shak.' Teesra bolo 'dekh liya.' Chautha bolo 'average lo.'
Score 70+ = tu apne aap ko itna trusted bana raha hai ki seller ko ek rupee bhi nahi lena padta.
Naya hai? Chhota sa deposit. Last minute? Thoda sa deposit. But always fair. Always explained."

**Tone:** Storyteller uncle energy. Smiling while talking. Make "chaar wedding uncles" sound funny, not technical.
**Pause:** 0.3s before Slide 5.

---

## SLIDE 5 — PRIVACY KILL-SHOT (0:42–0:50)
**Visual:** Nazia leans in, deadpan, suspicious. Jawad counts on fingers. Text counts 1→8. Red X over NIC / Screenshots / Group chats.

**Voiceover (Nazia — sharp, suspicious):
"Beta, let me guess. You collect everything. Meri buyers ke email passwords. Unka group chat jahan wo mere prices screenshot karke competitors ke saath share karte hain."

**Voiceover (Jawad — deadpan, counting fingers):
"Exactly 8 cheezein collect karte hain. Booking count. Attendance. Lead time. Service type. Distance. Device hash. Email.
NIC? Nahii. Screenshots? Nahii. Unka group chat? Sorry, humein nahi chahiye."

**Tone:** Comedy beat. Nazia's line should sound punchy. Jawad's counting should be mechanical but funny. After "Nahii" — 2 seconds of dead silence.
**Pause:** 2s silence. Then Slide 6.

---

## SLIDE 6 — SIGN UP (0:50–1:00)
**Visual:** Nazia typing on phone, grinning. Jawad smirking. End frame: Pabandi logo + "Built for live sellers."

**Voiceover (Nazia — excited, already sold):
"Beta, mere 20K followers hain. Agar sab sign up karein toh?"

**Voiceover (Jawad — smiling, closing):
"First 20 live sellers = free. 30-day trial. No credit card. PKR 999/month after.
Tu apne aap ko bachaa rahi hai. Apne buyers ko bhi bachaa rahi hai.
Pehle payment. Phir baat."

**Voiceover (Nazia — to camera, winking):
"Ab sabko bolo. Next live pe Pabandi link in bio."

**Tone:** Celebration. High energy. "Pehle payment, phir baat" should feel like a mic drop.
**End frame:** 3 seconds of logo + tagline. No voiceover. Just desi dholak music.

---

## DELIVERY NOTES FOR CANVA VOICE AI

1. **Voice selection:**
   - Nazia: Female, 30s, Karachi accent, warm but sharp
   - Jawad: Male, 30s, calm, IT-guy energy, deadpan humor

2. **Pronunciation guide for Roman Urdu:**
   - "Nahii" = nah-in (long i, flat a)
   - "Chai" = ch-ay (like "chai" in English but softer)
   - "Beta" = bay-ta (short e, flat a)
   - "Bhai" = bhy (like "boy" but shorter)
   - "Pehle" = peh-le (eh like "bed," le like "let")
   - "Phir" = fir (short i, like "fur" but softer)
   - "Pabandi" = puh-baan-dee (stress on "baan")

3. **Pacing:**
   - Slide 1: Fast, breathless
   - Slide 2: Sarcastic, building
   - Slide 3: Calm, cool
   - Slide 4: Warm, storytelling
   - Slide 5: Punchy, then 2s silence
   - Slide 6: Fast celebration

4. **Emotion tags:**
   - [excited] — Slide 1, Slide 6
   - [sarcastic] — Slide 2
   - [deadpan] — Slide 3, Slide 5 (Jawad)
   - [suspicious] — Slide 5 (Nazia)
   - [warm] — Slide 4
   - [winking] — Slide 6 (Nazia)

5. **Background audio:**
   - Slide 1–2: Desi lo-fi beat (low volume)
   - Slide 3–4: Same beat, slightly lower
   - Slide 5: Beat drops out for 2s silence
   - Slide 6: Beat returns + desi dholak drop

---

## EXPORT SETTINGS

- Format: MP4
- Resolution: 1080 × 1920 (9:16)
- FPS: 30
- Audio: AAC, 44.1 kHz, stereo
- Voice AI: Export each slide's voiceover separately, then sync in CapCut

---

## COPY-PASTE FOR CANVA VOICE AI PROJECT

Project name: Pabandi Live Seller — 6 Slide Carousel
Language: English (Roman Urdu mixed)
Length: 60 seconds
Voices: Female (Nazia) + Male (Jawad)
Background music: Desi lo-fi beat + dholak drop

Slide 1:
"Bhai, do ghante ka live. 97 comments. 10 actual sales. Baki 87? I'll take it bol ke ghost ho gaye. Main kisi ko block nahi kar sakti. Unka broken English mera dimaag kha raha hai."

Slide 2:
"Har live pe same scene. 50 log kehte hain reserved. 10 aake lete hain. Baki 30? Chup chap gaye. Aur wo payment sent screenshot? Pakistan ka unofficial national sport hai. Main apni listing delete karne ka sochti hoon. Har roz."

Slide 3:
"Nazia, apna bio link change karo. Pabandi booking link dal do. No app needed. Web link. Click karo, time select karo, deposit lock ho jata hai. Agar buyer ka score 70+ hai? Zero deposit. Aage bolo."

Slide 4:
"Trust Score chai ki recipe jaisa hai. Chaar ingredients. Chaar AI models = chaar wedding uncles. Ek bolo yeh theek hai. Dosra bolo nahi, thoda shak. Teesra bolo dekh liya. Chautha bolo average lo. Score 70+ = tu apne aap ko itna trusted bana raha hai ki seller ko ek rupee bhi nahi lena padta. Naya hai? Chhota sa deposit. Last minute? Thoda sa deposit. But always fair. Always explained."

Slide 5:
Nazia: "Beta, let me guess. You collect everything. Meri buyers ke email passwords. Unka group chat jahan wo mere prices screenshot karke competitors ke saath share karte hain."
Jawad: "Exactly 8 cheezein collect karte hain. Booking count. Attendance. Lead time. Service type. Distance. Device hash. Email. NIC? Nahii. Screenshots? Nahii. Unka group chat? Sorry, humein nahi chahiye."

Slide 6:
Nazia: "Beta, mere 20K followers hain. Agar sab sign up karein toh?"
Jawad: "First 20 live sellers = free. 30-day trial. No credit card. PKR 999/month after. Tu apne aap ko bachaa rahi hai. Apne buyers ko bhi bachaa rahi hai. Pehle payment. Phir baat."
Nazia: "Ab sabko bolo. Next live pe Pabandi link in bio."

---

*Script designed for 6-slide Instagram carousel / Reel. Based on Pabandi Live Selling feature from Whitepaper Section 16.*
"""

# Write debate podcast script to original path
debate_path = Path("/home/peesee/Pabandi/docs/podcast-debate.md")
debate_path.write_text(DEBATE_SCRIPT)
print(f"Restored debate podcast to {debate_path} ({len(DEBATE_SCRIPT)} chars)")

# Write Canva Voice AI script to new path
voiceai_path = Path("/home/peesee/Pabandi/docs/canva-voiceai-live-seller.md")
voiceai_path.write_text(CANVA_VOICEAI_SCRIPT)
print(f"Wrote Canva Voice AI script to {voiceai_path} ({len(CANVA_VOICEAI_SCRIPT)} chars)")

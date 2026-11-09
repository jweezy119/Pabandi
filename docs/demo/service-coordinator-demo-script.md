# Service Coordinator — 3-Minute Demo Script

For the A-1 Roofing pitch. Ends to end, live.

> **How to read the risk scores: higher = worse.**
> A score of **71% means a 71% chance this job goes wrong** — late, over budget,
> or with a problem on site. It does **not** mean a 71% chance of finishing on
> time. Low is good, high is bad. Every chip in the product has a "?" that says
> exactly this in one sentence.

---

## 1. The empty state (0:00–0:15)

"This is what you see when you log in the first time. Nothing hidden, nothing
to configure. The box at the bottom is the command bar — you can type in plain
English, or press the suggestion buttons."

## 2. Incoming WhatsApp creates a work order (0:15–0:40)

"Watch the list. A customer messages us on WhatsApp, and the job appears here
with a red priority dot. No data entry."

## 3. Hover the risk chip (0:40–1:10)

"Hover the chip. It says: **'Higher means we think this job is more likely to
go wrong. 71% means there is a meaningful chance of a problem.'** High risk,
because of today's schedule density. Now click the row and look at **Why this
score** — the reasons are written in sentences, not coefficients."

## 4. Assign from the command bar (1:10–1:50)

"Watch this. I type: **assign 1425 Chase to Marcus tomorrow 9am**. The
confirmation dialog says in plain language what is about to happen — who, and
what they get. I press **Assign and send**."

## 5. The technician side (1:50–2:15)

"Marcus gets the job on WhatsApp, taps accept, and the status flips to **On the
way**. One coordinator, no phone calls."

## 6. Demo mode accelerates (2:15–2:35)

"Thirty seconds later, Marcus taps complete and uploads a photo. The invoice
flag flips to **Ready**."

## 7. The what-if strip (2:35–2:55)

"Now the part that sells it. I drag the **days of notice** slider down — this
job was booked at the last minute. Watch the risk climb and the range widen.
Read it the same way as the chip: **higher means more likely to go wrong.**
Later is riskier, and now the coordinator can see that before promising a slot.
This is why we recommend the earlier one."

## 8. Close (2:55–3:00)

"One coordinator, twice the volume, no new software to learn. Ready to try it
with your next 10 jobs?"

---

## Presenter notes

- **If the command bar finds two matches, it asks.** It never picks silently —
  it shows a disambiguation strip naming the options. Say that out loud; it is
  the difference between a tool that guesses and a tool that checks.
- **If you type something the parser does not recognise**, the product silently
  treats it as a search and shows results with "Did you mean one of these?".
  There is no error message, because a wrong guess should not scold anyone.
- **Undo is a real revert.** Pressing Undo calls the server and removes the
  assignment; it is not a dismissed toast. Say it if anyone asks what happens
  after 30 seconds — after that the window has passed and the assignment stands.
- **Do not read the numbers as completion likelihood.** If a customer reads 71%
  as "71% chance it goes well", correct them: 71% is the chance it goes wrong.

## Environment

- `DEMO_MODE=true` on the server seeds A-1 Roofing, 3 technicians, 6 customers
  and 12 work orders, and shortens the post-completion timer to 30 seconds.
- `VITE_DEMO_MODE=true` on the client shows the "DEMO MODE" badge and enables
  the deterministic risk stub so the predictive UI is populated.
- Seeded risk-bearing work orders: `demo-wo-01` … `demo-wo-06`
  (see `client/src/components/coordinator/demoRiskProvider.ts`).

# Pabandi Content Skit: "Airbnb Scammer Call – Desi Uncensored"

> Source script for NotebookLM video generation. A man-and-female pair (Zain the
> skeptic + Sarah the "deal hunter") re-enact a hotel-booking-site scammer call
> they both received — and turn it into the Pabandi sales pitch without meaning to.
> Designed as a ~45s video (TikTok/Reels cut). Desi-diaspora voice, Hinglish+Urdu.

## Scene breakdown (for the notebook video generator)

### SCENE 1 — "The Call" (0-4s)
- **VISUAL**: Split screen. Left: Zain at his Austin desk, headphones on, facepalming.
  Right: Sarah on her phone in a Lahore cafe, scrolling Instagram.
- **AUDIO (Zain, deadpan)**: "Sarah, mujhe lag raha tha keh Netflix subscription
  bhi cancel kar denge mujhe... par yeh toh pura ek scammer hai."
- **AUDIO (Sarah, giggling)**: "Bhaiya, itni badi booking mil gayi — €800/month
  Dubai apartment! Sirf tumhari tarah ek WhatsApp group mein."

### SCENE 2 — "The Scam Reveal" (5-20s)
- **VISUAL**: Phone screen overlay showing the scammy "Booking.com" message bubble
  ("Dear customer, your reservation #BK294857 is confirmed. Please pay €950
  immediately via bank transfer or your card will be BLOCKED").
- **AUDIO (both overlapping, mimicking the scammer's robotic English)**:
  - Zain (forced faux-formal): "You have one hour to verify your account or it
    will be TERMINATED FOREVER."
  - Sarah (switching to Urdu, mocking): "Arrey bhai, yeh 'account termination'
    wala kya game hai? Lag raha hai Clash of Clans se bhi zyada serious hai."
  - Zain: "Check-out link pe click karke agar 'confirm' dabaoonga toh mera
    passport bhi scan ho jayega kya?"
  - Sarah: "Bilkul bhi nahi — yehi toh purana WhatsApp forward hai jo har
    Eid ke baad sabse pehle aata hai, sirf Booking.com ki jagah 'FBI' tha."

### SCENE 3 — "The Pabandi Pivot" (21-38s)
- **VISUAL**: Phone morphs — scam bubbles dissolve → clean Pabandi escrow UI
  shows a green "Trusted • Band A • Protected Deposit" badge.
- **AUDIO (Sarah, now the teacher)**: "Isliye main Pabandi use karti hoon, beta.
    Jab tak pura paisa release nahi hota bande ke haath, tab tak koi
    'TERMINATE FOREVER' nahi bola jaata."
  - **Zain**: "So Pabandi = uss bouncer jaisi hai jo Dubai mein uss apartment
    ke saamne khada hota hai, na ki sirf ek message bhejna wala WhatsApp uncle."
  - **Sarah**: "Haan. Trust score + escrow = wohi jugaad jo
    'bank transfer via cousin's friend' se bacha ke rakhe."
  - **Zain**: "$PAB token bhi hai — jaise dadi ka laddoo katori, tumhe pata
    hotu kab tak rakh sakte ho, par free mein khaane wala nahi."

### SCENE 4 — "The Mic Drop" (39-45s)
- **VISUAL**: Both on screen. Zain points at phone. End frame: Pabandi logo
  + "Protected Deposit. No ghost stories."
- **AUDIO (Zain, to camera)**:
  "Booking.com wala kehta tha '1 hour'. Pabandi ke saath: aadmi aadmi
  mile toh release hota hai. Warna bhi bola jaaye — par koi ghost nahi
  chhupata. #DesiTech"

## Prompt for NotebookLM video generation

```
You are a video-generation assistant. Create a 45-second TikTok/Reels skit
titled "Airbnb Scammer Call – Desi Uncensored" using the scene script above.

CAST (voice + visuals):
- ZAIN (male): USA-based desi skeptic, deadpan humor. Austin home office.
- SARAH (female): Desi-diaspora "deal hunter", switches English↔Urdu mid-sentence.
  Lahore cafe background.

VISUAL STYLE:
- Split-screen for dialogue.
- Glitch/pixelation effect when scam calls get mocked (Scene 2→3 transition:
  scam bubbles DISSOLVE into clean Pabandi escrow UI).
- Color palette: warm desi tones (saffron/orange), Pabandi brand teal for the
  trust badge in Scene 3.
- Subtitles in both English AND Urdu (code-switched) so sound-off works.

AUDIO:
- Natural South-Asian accented English with Hindi/Urdu code-switching (exactly
  like real desi IG stories).
- Scammer voice = deliberately robotic/over-enunciated mock.
- Tone: playful-sarcastic (NOT mean). The joke is on the scam, not the victim.
- BGM: faint tabla-drum loop, low in mix.

SCENE TIMING (strict):
1: 0-4s   | "The Call" (split screen, facepalm)
2: 5-20s  | "The Scam Reveal" (phone overlay, Urdu mockery of 'terminate forever')
3: 21-38s | "The Pabandi Pivot" (UI morph, escrow education)
4: 39-45s | "Mic Drop" (logo + tagline)

END FRAME TEXT:
  "Pabandi — Protected Deposit. No ghost stories. #DesiTech"

HARD CONSTRAINTS:
- No actual phone numbers, bank details, or brand-logos beyond Pabandi.
- Make the scammer LOOK generic (no real Booking.com branding) to dodge impersonation.
- 4:5 vertical (1080x1350) for Reels/TikTok, 30fps, <=45s.
```

## How to run in a NotebookLM notebook

```python
# Cell 1 — load the script
skit_script = open("pabandi-content-airbnb-scam-skit.md").read()

# Cell 2 — feed script + prompt to your video gen model
video = video_gen_model.generate(
    prompt="...paste the Prompt block above...",
    script=skit_script,                # so the model follows your scenes verbatim
    aspect_ratio="9:16",               # vertical
    duration_seconds=45,
    fps=30,
)

# Cell 3 — render + download
video.save("pabandi_airbnb_scam_skit.mp4")
```

> Tip: keep `skit_script` as a separate variable from the prompt so the model can
> quote scene cues without re-inventing them.

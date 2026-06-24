# Pabandi Marketing Bot

Automated Twitter + Instagram content publishing and engagement for @PabandiGlobal.

Reads content from your markdown docs and posts on schedule. No manual copy-paste needed.

---

## Setup

```bash
cd Pabandi/marketing-bot

# 1. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy config template
cp bot_config.example.json bot_config.json

# 4. Add your real API keys to bot_config.json
# (never commit this file!)
```

---

## Twitter API Setup (Required)

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Create a new app (Basic tier: $100/month, or Free for testing)
3. Enable these permissions:
   - Read and Write (for posting tweets)
   - Read (for searching)
4. Generate these 4 keys:
   - API Key
   - API Secret
   - Access Token
   - Access Secret
5. Add them to `bot_config.json` under `twitter`

---

## Instagram API Setup (Optional)

1. Convert your Instagram account to **Business or Creator** type
2. Connect it to a Facebook Page
3. Create a Facebook App at [developers.facebook.com](https://developers.facebook.com)
4. Add Instagram Graph API product
5. Generate a Page Access Token
6. Add to `bot_config.json` under `instagram`

---

## Usage

```bash
# Import all docs into content queue
python3 marketing_bot.py --action import

# Import specific file
python3 marketing_bot.py --action import --file ../docs/Twitter-API-Launch-Threads.md

# Post anything due now
python3 marketing_bot.py --action post

# Post specific text immediately
python3 marketing_bot.py --action post --text "Your tweet here"

# View your content queue
python3 marketing_bot.py --action queue

# Run daily engagement (like 5 target accounts)
python3 marketing_bot.py --action engage

# Setup/verify connections
python3 marketing_bot.py --action setup
```

---

## Schedule Posts

You have two options:

### Option 1: Manual Scheduling (Recommended for Now)

1. Run `python3 marketing_bot.py --action import` to load all content
2. Edit `content_queue.json` and add `schedule_time` to each post
3. Run `python3 marketing_bot.py --action post` when due

### Option 2: Cron Job (Fully Automated)

```bash
# Check for due posts every hour
crontab -e

# Add this line:
0 * * * * cd /home/peesee/Pabandi/marketing-bot && /home/peesee/Pabandi/marketing-bot/.venv/bin/python3 marketing_bot.py --action post >> /home/peesee/Pabandi/marketing-bot/bot.log 2>&1
```

---

## Content Files

The bot reads these files from `../docs/`:
- `Twitter-90Day-Calendar.md` — daily posts
- `Twitter-API-Launch-Threads.md` — thread sequences
- `Twitter-RomanUrdu-Series.md` — Roman Urdu content
- `LiveSeller-Outreach-DMs.md` — DM templates

Add your own markdown files — the bot auto-parses code blocks and bullet points as tweets.

---

## Engagement Targets

To build a target list for auto-engagement:

```bash
# Add handles one at a time
echo '["mominsaqib", "ConnectedPak", "web3pak"]' > engagement_targets.json

# Then run engagement
python3 marketing_bot.py --action engage
```

Recommended targets from your research:
- @mominsaqib
- @ConnectedPak
- @web3pak
- @sarahperacha
- @itsadilashfaq
- @MizNaQ

---

## How the Bot Works

```
markdown docs → ContentParser → ContentQueue → Twitter/Instagram API
                                                        ↓
                                                  Live posts
```

1. **ContentParser** scans your markdown files for tweet-sized content
2. **ContentQueue** stores scheduled posts in `content_queue.json`
3. **TwitterBot** posts via Tweepy (Twitter API v2)
4. **EngagementBot** automates likes/replies on target accounts

---

## Security Notes

- **Never** commit `bot_config.json` — it contains API keys
- Use environment variables for production:
  ```bash
  export TWITTER_API_KEY="..."
  export TWITTER_API_SECRET="..."
  ```
- The `.gitignore` in root should exclude `bot_config.json` and `.env`
- Rotate keys immediately if exposed

---

## Troubleshooting

**Bot won't post:**
- Check API keys in config
- Verify Twitter app has Read+Write permissions
- Check rate limits: Free = 300 tweets/day, Basic = 1,500/day

**Content not importing:**
- Make sure tweets are in code blocks (```)
- Check tweets are under 280 characters
- Verify file path is correct

**Instagram not working:**
- Instagram Graph API requires Business/Creator account
- Token expires every 60 days — refresh via Facebook App
- Instagram doesn't allow full automation — use sparingly

---

## Next Steps

1. [ ] Get Twitter API keys (Basic tier recommended)
2. [ ] Run `python3 marketing_bot.py --action import`
3. [ ] Schedule your first 7 tweets
4. [ ] Run `python3 marketing_bot.py --action post` daily
5. [ ] Set up cron for hourly checks

---

*Pabandi Marketing Bot — Wada pura karo. Inaam pao.*

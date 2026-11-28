# Render environment & encryption checklist

## 1. Generate secrets (run locally)

```bash
# 32-byte key, exactly 64 hex characters — required by utils/encryption.ts
openssl rand -hex 32

# JWT / session secrets (any long random string)
openssl rand -base64 48
openssl rand -base64 48
openssl rand -base64 48
```

`ENCRYPTION_KEY` must be **64 hex characters**. A normal password or base64 string will crash the API at boot.

## 2. API service (`pabandi`) env vars

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Supabase connection string, set manually (`sync: false`). |
| `JWT_SECRET` | yes | ≥16 chars. Used for token signing and as session fallback. |
| `JWT_REFRESH_SECRET` | yes | Separate refresh-token secret. |
| `SESSION_SECRET` | recommended | Distinct 32+ char value; if absent, `JWT_SECRET` is used. |
| `COOKIE_SESSION_SECRET` | optional | Legacy; no longer used after cookie-session removal. |
| `ENCRYPTION_KEY` | yes | 64 hex chars. Encrypts mail/CalDAV credentials and wallet secrets. |
| `TELEGRAM_BOT_SECRET` or `TELEGRAM_WEBHOOK_SECRET` | yes | Telegram webhook verification. |
| `BTCPAY_WEBHOOK_SECRET` | if used | Unsigned BTCPay events are rejected. |
| `PAYLIO_WEBHOOK_SECRET` | if used | Unsigned PayLio events are rejected. |
| `RAAST_WEBHOOK_SECRET` | if used | Required for Raast webhook verification. |
| `OFFRAMP_WEBHOOK_SECRET` | if used | Mock EMI webhook is disabled in production without it. |
| `CHANNEL_INGEST_SECRET` | for inbound email/calendar | HMAC secret for `POST /api/v1/channels/ingest`. Blueprint generates one. |
| `ENABLE_CHANNEL_SYNC` | set `false` | The worker performs periodic sync, not the API. |
| `REDIS_URL` | recommended | Enables Redis-backed sessions and durable email queue. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for outbound mail | `EMAIL_FROM` must be a verified sender domain. |
| AI provider keys | optional | `OPENAI_API_KEY`, `DASHSCOPE_API_KEY`, `NVIDIA_API_KEY`, `GEMINI_API_KEY`, `POLLINATIONS_ENABLED`. |
| `PTP_SIGNING_SECRET` | optional | Needed only for PTP attestations; absence no longer blocks boot. |

Render blueprint entries marked `generateValue: true` are only applied when the blueprint is synced. If this service is managed manually in the dashboard, copy the generated values there yourself.

## 3. Worker service (`pabandi-worker`) env vars

| Variable | Required | Notes |
|---|---|---|
| `REDIS_URL` | yes | Worker exits non-zero without it. |
| `DATABASE_URL` | yes | Same database as the API. |
| `ENCRYPTION_KEY` | yes | **Same 64-hex value as the API.** Different values make saved credentials undecryptable. |
| `ENABLE_CHANNEL_SYNC` | set `true` | Runs IMAP/CalDAV sync every 5 minutes. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for queued email | |

## 4. Mailbox & calendar credentials (UI, not env)

Go to **Contact OS → Email & Calendar**:

- **Mailbox:** email address, IMAP host/port, username, password/app password, optional SMTP host/port/user/password.
- **Calendar:** CalDAV URL, username, password/app password.

These are encrypted with `ENCRYPTION_KEY` and never returned by the API. Gmail typically needs an **app password**; providers that require OAuth2 are not supported by the Basic-auth path yet.

Use **Sync now** to test immediately, then watch logs for `[ChannelSync]`.

## 5. Verify after deploy

```bash
curl -s https://pabandi.onrender.com/health | jq '{status, commitSha, schema}'
curl -s https://pabandi.onrender.com/api/v1/openapi.json | head -c 200
```

Expected: `status: "ok"`, `schema.ok: true`, and a JSON OpenAPI document. If `schema.ok` is false, the boot-time `shipped-migrations.sql` did not apply the new tables — check the deploy log for `[table-bootstrap]`.

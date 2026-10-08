# Telegram alerts: setup

Kadd sends a Telegram message when a wallet you follow trades on Monad mainnet, or when the keeper copies a trade
into your copy vault or a copy club you joined. Unlike the in-app notifications, these arrive with Kadd closed.

How it works:

1. In the Following feed (Groups), **Alerts on Telegram** creates a subscription: a secret token plus your followed
   wallets and account address, stored in Redis. The browser keeps the token and updates the wallets when you follow
   or unfollow someone.
2. The button opens `t.me/<bot>?start=<token>`. Tapping **Start** sends `/start <token>` to the bot's webhook
   (`/api/telegram/webhook`), which links that chat to the subscription.
3. Every keeper tick (`/api/copy/keeper`, the same cron that runs auto copy) sends what's new to each linked chat.
   More than 3 new items go out as one summary message. `/stop` in the chat turns alerts off.

Until every step below is done, the button stays hidden and the rest of the app works as before.

## 1. Create the bot

1. In Telegram, open [@BotFather](https://t.me/BotFather) → `/newbot` → pick a name and a username ending in `bot`
   (for example `kadd_alerts_bot`).
2. BotFather replies with a token like `123456789:AA…`. Treat it as a password: never commit it or paste it in chat.
3. Optional: `/setdescription`, `/setuserpic` (use `kadd/src/app/icon.png`) and `/setcommands`:
   ```
   stop - Turn alerts off
   ```

## 2. Add Redis (Upstash, free)

1. Vercel → the `kaad-app` project → **Storage** → **Create Database** → **Upstash for Redis** (Marketplace) → free
   plan → region close to the Vercel functions.
2. **Connect** it to the project for Production (and Preview if you test there). Vercel adds `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` itself. (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work.)

## 3. Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|------|-------|
| `TELEGRAM_BOT_TOKEN` | the token from BotFather |
| `NEXT_PUBLIC_TELEGRAM_BOT` | the bot username **without** `@`, e.g. `kadd_alerts_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | a random string, e.g. the output of `openssl rand -hex 32` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | set by step 2 |

Then **redeploy**: `NEXT_PUBLIC_*` values are built into the page, so a running deployment won't pick them up.

## 4. Point the bot at Kadd (once)

Run this in your own terminal, with your values in the two variables (they stay on your machine):

```sh
TELEGRAM_BOT_TOKEN='…' TELEGRAM_WEBHOOK_SECRET='…'
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://kaad-app.vercel.app/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`. Check it any time:

```sh
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

`url` should be the Kadd webhook, and `last_error_message` empty. A `403` there means `TELEGRAM_WEBHOOK_SECRET` in
Vercel and in the `setWebhook` call differ.

## 5. Make sure the keeper ticks

Alerts are sent on the keeper's tick, so the cron pinger has to be on: a [cron-job.org](https://cron-job.org) job
calling `https://kaad-app.vercel.app/api/copy/keeper` every minute. The response now includes a `telegram` field:

- `{"sent": n}`: the pass ran and sent `n` messages.
- `null`: Telegram isn't configured, or a pass ran less than 50 seconds ago on this instance.
- `{"error": "…"}`: Redis or Telegram failed (wrong token or URL).

## 6. Test it

1. Open Kadd, sign in, follow a wallet that trades often (Leaderboard → Monad mainnet), then go to **Groups**.
2. Click **Alerts on Telegram** → **Start** in Telegram. The bot answers "Connected…".
3. The first keeper pass after connecting only records what already happened, so old trades never flood the chat.
   The first message comes with the next new trade, usually within a few minutes for an active wallet.
   Copies show up with a delay of up to about 5 minutes (they come from the same cached event history as Stats).
4. Send `/stop` to check that unlinking works.

## Limits

- One subscription per chat; connecting another browser to the same chat replaces the old one.
- Up to 50 followed wallets per subscription.
- Dispatch goes through every subscriber in one pass. That's fine for hundreds of subscribers; past that, it should
  be batched.

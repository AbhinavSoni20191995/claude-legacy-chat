# Claude Legacy Chat — v6.1

A privacy-first chatbot interface with persistent memory, model switching, and visible reasoning.

## What's new in v6.1

- ✅ **Pro waitlist** — collects emails of users interested in a future managed version
- ✅ **API setup help** — direct line for users stuck on getting an Anthropic API key
- ✅ **Tip jar link** — optional support without requiring a paid tier
- ✅ All v6 features preserved (live models, edit & resubmit, smart file compression, data migration)

## Capturing signals on Railway

The three signal endpoints (`/api/waitlist`, `/api/help-request`, and the tip jar link) capture interest in:
1. **A managed Pro tier** — so you can validate demand before building it
2. **API setup pain points** — so you can build better onboarding or know when Pro is needed
3. **Willingness to pay** — via tip jar clicks/conversions

By default, signals are logged to Railway's stdout (visible in Railway dashboard → Logs).

### Optional: Forward signals to your email or Discord

To receive real-time notifications when someone submits a waitlist or help request:

1. Set up a free webhook service like [Make.com](https://make.com), [Zapier](https://zapier.com), or [n8n](https://n8n.io)
2. Create a scenario: "On webhook → send email" (or send Discord/Slack message)
3. Get the webhook URL
4. In Railway, set environment variable:
   - `NOTIFY_WEBHOOK_URL` = `https://your-webhook-url`

Now every signup notifies you immediately, with the user's email.

### Configure tip jar URL

Edit `openTipJar()` in `public/index.html` to point to your preferred tip jar (Buy Me a Coffee, Ko-fi, Stripe Payment Link, etc.).

Default: `https://www.buymeacoffee.com/abhinavsoni` — update to your actual URL.

## Quick start

```bash
npm install
node server.js
```

## Required Railway environment variables

- `PRODUCTION_DOMAIN` — your Railway URL (locks CORS)
- `NOTIFY_WEBHOOK_URL` — optional, for receiving signal notifications

## License

MIT — see LICENSE file.

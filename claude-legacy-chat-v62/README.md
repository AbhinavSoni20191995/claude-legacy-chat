# Claude Legacy Chat — v6.2

A privacy-first chatbot interface with persistent memory, model switching, visible reasoning, and **auto-update**.

## What's new in v6.2

- ✅ **Auto-update system** — when you deploy a new version, all users see a gold "New version available · Refresh" banner at the top of the app. One tap and they're on the latest version. No manual reinstall needed.
- ✅ **Smart caching** — HTML is always fetched fresh from network, assets are cached for speed.
- ✅ **Version checks every 30 minutes** while the app is open, plus on every launch.

## How the auto-update works

1. You push new code to GitHub
2. Railway redeploys
3. Open apps detect a new service worker within ~30 min (or on next launch)
4. A gold banner slides down: "✨ New version available · Refresh"
5. User taps it → app reloads with new version
6. Done — no reinstall, no losing data

**Important for releasing updates:** When you make changes, bump the version string in:
- `public/sw.js` line 3: `const APP_VERSION = 'v6.2';` → change to `v6.3`, `v6.4`, etc.

That single line is what triggers the update detection. Without changing it, users won't see the banner.

## All features (cumulative)

- Persistent memory across all sessions with auto-summarization
- Profile notes always sent to Claude
- Extended thinking mode (visible reasoning)
- Model picker with live data from Anthropic API
- Edit & resubmit any message
- Smart file compression (auto-handles large uploads)
- Full history browser with archive
- Export all data as text
- Beginner setup guide
- Terms of Use + Privacy Policy
- 18+ consent gate
- Server stores ZERO data
- Rate limiting + CORS lock
- Pro waitlist signup
- API setup help requests
- Tip jar link
- Auto-update system ⭐ new

## Quick start

```bash
npm install
node server.js
```

## Deploy to Railway

1. Push to GitHub
2. Connect repo to Railway
3. Set env vars:
   - `PRODUCTION_DOMAIN` — your Railway URL (locks CORS)
   - `NOTIFY_WEBHOOK_URL` — optional, for receiving signal notifications

## License

MIT — see LICENSE file.

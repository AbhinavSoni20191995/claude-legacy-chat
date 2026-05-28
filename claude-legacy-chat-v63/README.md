# Claude Legacy Chat

A privacy-first chat interface for the Anthropic API. Bring your own API key, conversations stay on your device, persistent memory carries across sessions.

**Live demo:** https://claude-legacy-chat-production.up.railway.app

## Features

- **Persistent memory** across all sessions with auto-summarization (powered by Haiku)
- **Profile notes** Claude always knows about you (sent every session)
- **Live model picker** — pulls available models from Anthropic API directly, no hardcoded list to go stale
- **Extended thinking** mode shows Claude's reasoning chain
- **Edit & resubmit** — tap the pencil icon on any user message to regenerate from that point
- **Smart file upload** — large context files (>90KB) are auto-compressed via Haiku to fit within rate limits
- **Prompt caching** — system prompt (memory + profile + docs) is cached for ~90% cost reduction on repeated tokens
- **Full session history** browser with export
- **Auto-update** banner notifies users when new versions deploy
- **Bring your own API key** — server stores nothing, all data lives only on your device

## Privacy

- Server is a stateless proxy — no database, no logging of request bodies
- API key and conversations live in browser localStorage only
- API keys are scrubbed from any error metadata
- HTTPS required in production
- CORS locked to your deployed domain
- Rate-limited (30 req/min, 300/hr per IP) to prevent abuse

## Quick start (local)

```bash
npm install
node server.js
```

Open `http://localhost:3000` and enter your Anthropic API key.

## Deploy to Railway

1. Fork this repo or push your own copy to GitHub
2. Create a new project on Railway → Deploy from GitHub
3. Set environment variable: `PRODUCTION_DOMAIN` = your Railway URL (locks CORS)
4. Optional: `NOTIFY_WEBHOOK_URL` = webhook URL to receive waitlist/help signal notifications

## Self-hosting

The whole stack is one Node.js server + static files. You can run it on:
- Railway, Render, Fly.io, Vercel — easiest cloud options
- A VPS (DigitalOcean, Hetzner, Linode) — full control
- Your own home server — works behind Cloudflare Tunnel

Just clone the repo, set `npm start`, and point a domain at it.

**Note on the license:** Because this project is AGPL-3.0, if you run a modified version as a public/network service, you must make your modified source code available to your users. See LICENSE for details.

## How to update users to the latest version

1. Make your code changes
2. Bump the version string in `public/sw.js` line 3: `const APP_VERSION = 'v6.3';` -> `'v6.4'`
3. Commit and push
4. Users with the app installed see a banner: "New version available - Refresh"
5. Tap -> app reloads with latest version
6. No data loss - localStorage persists across updates

## Contributing

See `CONTRIBUTING.md`. Pull requests welcome.

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)** — see the `LICENSE` file.

In short:
- You may use, study, modify, and self-host this software freely
- If you run a modified version as a network service, you must publish your modified source under the same license
- This keeps the project free and open for everyone — no one can take it closed-source or build a proprietary product from it

For commercial licensing or other arrangements, contact: abhinav.soni003@gmail.com

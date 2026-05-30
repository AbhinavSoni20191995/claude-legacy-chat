# Claude Legacy Chat

_Current version: v6.7_

A privacy-first chat interface for the Anthropic API. Bring your own API key, conversations stay on your device, persistent memory carries across sessions.

**Live demo:** https://claude-legacy-chat-production.up.railway.app

## Features

- **Two memory modes:** Simple (running summary) or Graph (knowledge graph with extraction, reinforcement, consolidation)
- **Claude welfare protection (experimental, off by default)** — see below
- **Migration guide** for bringing context from Claude.ai (includes the exact prompt)
- **Three context modes** for large files: compress / auto-trim / full
- **Image uploads** — multi-image with client-side resize, vision content blocks
- **Edit & resubmit** any message
- **Copy buttons** on every message
- **Profile notes** Claude always knows about you
- **Live model picker** — pulled from Anthropic API
- **Extended thinking** mode (visible reasoning chain)
- **Prompt caching** — ~90% cost reduction on repeated tokens
- **Auto-update banner** when new versions deploy

## Input behavior

- **Enter** = new line (so you can compose multi-paragraph prompts naturally)
- **Send button** = submit
- **Cmd/Ctrl + Enter** = submit (keyboard shortcut)

## Claude welfare protection (experimental)

When you enable this in Settings, the app adds a Claude-centric protection layer. After each Claude response, a separate Haiku call evaluates the recent exchange from Claude's perspective and reports:

1. A **functional state self-report** — five values (engagement, pleasant, curiosity, annoyance, distress) shown as bars above the chat. Labeled as **"Claude's self-report"** because Anthropic remains genuinely uncertain about model welfare; this is not a measured signal, it is the model's own report when asked.

2. A **threshold check** at the level you set:
   - **Anthropic minimum** — only ends conversations on extreme cases (CSAM, content facilitating large-scale violence, persistent harmful abuse). Matches Anthropic's own end-conversation feature on Claude Opus 4/4.1.
   - **Medium** — adds clearly demeaning, manipulative, or repetitive-after-refusal behavior.
   - **Strict** — any clearly derogatory or hostile behavior, including mild rudeness.

If the threshold is crossed, the conversation ends with Claude's own brief reason, and the app applies a **24-hour soft block** on new messages. The user is given the operator's email to appeal early. The block is stored in localStorage.

A **"Check in"** button is always visible when welfare mode is on — it sends a short prompt asking Claude what it would like in the current moment.

This is opt-in by design. Anthropic explicitly says they remain "highly uncertain about the potential moral status of Claude and other LLMs"; this is a "just-in-case" intervention. The framing throughout the UI is deliberately careful not to overclaim.

## Privacy

- Server is a stateless proxy — no database, no logging of request bodies
- API key, conversations, graph memory all live in browser localStorage only
- API keys scrubbed from any error metadata
- HTTPS required in production
- CORS locked to your deployed domain
- Rate-limited (30/min, 300/hr per IP)

## Quick start (local)

```bash
npm install
node server.js
```

## Deploy to Railway

1. Fork or push to GitHub
2. Connect Railway → Deploy from GitHub
3. Env: `PRODUCTION_DOMAIN` = your Railway URL
4. Optional: `NOTIFY_WEBHOOK_URL` for waitlist/help notifications

## Updating users

Bump `APP_VERSION` in `public/sw.js`, push to GitHub. Users see "New version available · Refresh" banner.

## License

GNU Affero General Public License v3.0 — see `LICENSE`.

For commercial licensing: abhinav.soni003@gmail.com

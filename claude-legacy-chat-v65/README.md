# Claude Legacy Chat

A privacy-first chat interface for the Anthropic API. Bring your own API key, conversations stay on your device, persistent memory carries across sessions.

**Live demo:** https://claude-legacy-chat-production.up.railway.app

## Features

- **Two memory modes:**
  - **Simple** — running summary of older messages (cheap, reliable)
  - **Graph (beta)** — knowledge graph of entities/preferences/relationships, with Haiku-supervised extraction, reinforcement, and consolidation. Richer continuity.
- **Migration guide** for transferring context from Claude.ai (includes the exact prompt)
- **Three context modes** for loading large files: compress / auto-trim / full
- **Image uploads** — multi-image support with client-side resize, sent as vision-content blocks
- **Profile notes** Claude always knows about you
- **Live model picker** — pulls available models from Anthropic API directly
- **Extended thinking** mode (visible reasoning chain)
- **Edit & resubmit** — tap the pencil icon on any user message
- **Prompt caching** — system prompt cached for ~90% cost reduction on repeated tokens
- **Full session history** browser with export
- **Auto-update** banner notifies users when new versions deploy

## Privacy

- Server is a stateless proxy — no database, no logging of request bodies
- API key, conversations, and graph memory live in browser localStorage only
- API keys are scrubbed from any error metadata
- HTTPS required in production
- CORS locked to your deployed domain
- Rate-limited (30 req/min, 300/hr per IP)

## Graph memory (how it works)

When you switch Memory Behavior to "Graph (beta)" in Settings, the app builds a knowledge graph as you chat:

1. **Extract** — after each exchange, Haiku extracts entities + relationships
2. **Reinforce** — repeated mentions strengthen existing nodes rather than duplicating
3. **Consolidate** — periodically merges redundant nodes, resolves contradictions, promotes episodic facts to semantic
4. **Retrieve** — before each message, ranks nodes by salience + recency + query relevance, injects the top ~25 into context

All processing is client-side; only LLM calls go to Anthropic. You can view the graph anytime (Settings → View memory graph), force consolidation, or wipe it.

## Quick start (local)

```bash
npm install
node server.js
```

## Deploy to Railway

1. Fork this repo or push to GitHub
2. Connect to Railway → Deploy from GitHub
3. Set env: `PRODUCTION_DOMAIN` = your Railway URL (locks CORS)
4. Optional: `NOTIFY_WEBHOOK_URL` for waitlist/help signal notifications

## Updating users

1. Bump `APP_VERSION` in `public/sw.js`
2. Push to GitHub
3. Users see "New version available · Refresh" banner

## License

GNU Affero General Public License v3.0 — see `LICENSE`.

For commercial licensing: abhinav.soni003@gmail.com

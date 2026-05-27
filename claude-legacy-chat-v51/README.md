# Claude Legacy Chat

A personal AI chatbot with persistent memory, model switching, and visible reasoning.

**Created by Abhinav Soni** · Side project, not affiliated with Anthropic.

## Features

- 🧠 **Persistent memory across all sessions**
- 📝 **Profile notes** — facts Claude always knows about you
- 🔄 **Auto-summarization** — older messages compressed intelligently
- 💭 **Extended thinking mode** — see Claude's reasoning chain
- 🤖 **Model picker** — Opus, Sonnet, Haiku (current + legacy)
- 📜 **History browser** — every session saved and revisitable
- ⇩ **Export everything** as text
- 📖 **Beginner setup guide** built in
- 🔒 **Privacy-first** — nothing stored on server

## Safeguards for public deployment

- ✅ Terms of Use acceptance modal on first launch (18+ gate)
- ✅ Privacy policy + Terms of Use as separate pages
- ✅ Rate limiting (30 req/min, 300 req/hr per IP)
- ✅ CORS lock (set PRODUCTION_DOMAIN env var when deploying)
- ✅ Zero request body logging
- ✅ API key scrubbing in error logs
- ✅ Content reporting flow to creator's email

## Quick start (local)

```bash
npm install
node server.js
```

Test at `http://localhost:3000`.

## Deploy to Railway

1. Push this folder to a GitHub repo
2. Connect Railway → Deploy from GitHub
3. After deploy, set environment variable in Railway:
   - `PRODUCTION_DOMAIN` = `https://your-app.up.railway.app` (your actual domain)
4. Railway generates the public URL — share it with anyone

## Privacy guarantees

- Server stores nothing — stateless proxy
- No request bodies are ever logged
- API key + conversations + memory: all on user's device only
- Anthropic's policy applies for upstream data

## Available models

| Model | Use case | Status |
|---|---|---|
| Opus 4.7 | Most capable | Current |
| Sonnet 4.6 | Best daily driver | Current |
| Sonnet 4.5 | Previous generation | Legacy |
| Haiku 4.5 | Fastest, cheapest | Current |
| Opus 4.5 / 4.6 | Earlier Opus | Legacy |

Models retired by Anthropic (Sonnet 3.5, Haiku 3.5, Opus 3, etc.) are not selectable — their endpoints no longer respond.

## License

Personal use license — see LICENSE file. Not for commercial redistribution.

## Contact

Abhinav Soni — abhinav.soni003@gmail.com

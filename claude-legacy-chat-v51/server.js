const express = require('express');
const path = require('path');

const app = express();

// ─── PRIVACY: never log request bodies ───
app.use(express.json({ limit: '5mb' }));

// ─── CORS LOCK ───
// In production, only allow requests from the app's own domain.
// PRODUCTION_DOMAIN can be set via environment variable on Railway.
const ALLOWED_ORIGIN = process.env.PRODUCTION_DOMAIN || null;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN) {
    // Production: lock to the configured domain
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin) {
      // Reject cross-origin API requests in production
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Cross-origin requests not allowed.' });
      }
    }
  } else {
    // Local dev: allow any origin (no production domain set)
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── RATE LIMITING ───
// Per-IP rate limit on API endpoints to prevent abuse of the proxy.
// Tracks: 30 requests per 60 seconds, with a longer-term cap of 300/hour.
const rateLimitMap = new Map(); // ip -> { shortBucket: [], longBucket: [] }

function rateLimit(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const SHORT_WINDOW = 60 * 1000;  // 1 minute
  const LONG_WINDOW = 60 * 60 * 1000; // 1 hour
  const SHORT_MAX = 30;
  const LONG_MAX = 300;

  let entry = rateLimitMap.get(ip);
  if (!entry) {
    entry = { shortBucket: [], longBucket: [] };
    rateLimitMap.set(ip, entry);
  }

  // Drop expired timestamps
  entry.shortBucket = entry.shortBucket.filter(t => now - t < SHORT_WINDOW);
  entry.longBucket = entry.longBucket.filter(t => now - t < LONG_WINDOW);

  if (entry.shortBucket.length >= SHORT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Slow down — wait a minute before trying again.' });
  }
  if (entry.longBucket.length >= LONG_MAX) {
    return res.status(429).json({ error: 'Hourly rate limit reached. Please wait before continuing.' });
  }

  entry.shortBucket.push(now);
  entry.longBucket.push(now);
  next();
}

// Periodically clean stale entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.longBucket.length === 0 && entry.shortBucket.length === 0) {
      rateLimitMap.delete(ip);
    } else if (now - Math.max(...entry.longBucket, 0) > 60 * 60 * 1000) {
      rateLimitMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);

app.use(rateLimit);
app.use(express.static(path.join(__dirname, 'public')));

// Privacy-safe error logger
function scrubError(err, context) {
  const msg = (err && err.message) || String(err);
  const safe = msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***REDACTED***');
  console.error(`[${context}] ${safe}`);
}

// Helper: call Anthropic
async function callAnthropic({ apiKey, model, messages, system, maxTokens = 2048, thinking = false }) {
  const body = {
    model: model || 'claude-sonnet-4-5-20250929',
    max_tokens: maxTokens,
    messages,
  };
  if (system) body.system = system;

  const supportsThinking = /claude-(opus|sonnet|haiku)-4-(5|6|7)/.test(body.model);
  if (thinking && supportsThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 4000 };
    if (body.max_tokens < body.thinking.budget_tokens + 1024) {
      body.max_tokens = body.thinking.budget_tokens + 1024;
    }
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data.error && data.error.message) || 'API error';
    throw new Error(msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***REDACTED***'));
  }

  let thinkingText = '';
  let replyText = '';
  for (const block of data.content) {
    if (block.type === 'thinking') thinkingText += block.thinking || '';
    else if (block.type === 'text') replyText += block.text || '';
  }
  return { thinking: thinkingText, reply: replyText };
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, systemPrompt, apiKey, thinking, model } = req.body;
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(401).json({ error: 'No API key provided.' });

  try {
    const result = await callAnthropic({ apiKey: key, model, messages, system: systemPrompt, thinking });
    res.json(result);
  } catch (err) {
    scrubError(err, 'chat');
    res.status(500).json({ error: err.message });
  }
});

// Summarization endpoint
app.post('/api/summarize', async (req, res) => {
  const { messages, apiKey } = req.body;
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(401).json({ error: 'No API key provided.' });

  try {
    const transcript = messages.map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content}`).join('\n\n');
    const result = await callAnthropic({
      apiKey: key,
      model: 'claude-haiku-4-5',
      system: `You are summarizing a conversation between a user and Claude for long-term memory purposes. Create a dense, factual summary that captures:
- Key topics discussed
- Decisions made or conclusions reached
- Personal facts the user shared about themselves (work, projects, preferences, life context)
- Open questions or unresolved threads
- Important context Claude should remember going forward

Write in dense bullet form. Avoid filler. Be comprehensive but concise — aim for maximum information density. Write in third person ("The user said X" not "You said X").`,
      messages: [{ role: 'user', content: `Summarize this conversation for long-term memory:\n\n${transcript}` }],
      maxTokens: 1500,
    });
    res.json({ summary: result.reply });
  } catch (err) {
    scrubError(err, 'summarize');
    res.status(500).json({ error: err.message });
  }
});

// Health check (Railway)
app.get('/health', (_, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Claude Legacy Chat running on http://localhost:${PORT}`);
  console.log(`📱  iOS: Safari → your IP:${PORT} → Share → Add to Home Screen`);
  console.log(`🔒  Privacy: no request bodies logged.`);
  console.log(`⚡  Rate limit: 30 req/min, 300 req/hour per IP.`);
  if (ALLOWED_ORIGIN) console.log(`🌐  CORS locked to: ${ALLOWED_ORIGIN}`);
  console.log('');
});

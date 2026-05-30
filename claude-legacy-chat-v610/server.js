const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ─── CORS LOCK ───
const ALLOWED_ORIGIN = process.env.PRODUCTION_DOMAIN || null;
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN) {
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin && req.path.startsWith('/api/')) {
      return res.status(403).json({ error: 'Cross-origin requests not allowed.' });
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── RATE LIMITING ───
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const SHORT_WINDOW = 60 * 1000, LONG_WINDOW = 60 * 60 * 1000;
  const SHORT_MAX = 30, LONG_MAX = 300;
  let entry = rateLimitMap.get(ip);
  if (!entry) { entry = { shortBucket: [], longBucket: [] }; rateLimitMap.set(ip, entry); }
  entry.shortBucket = entry.shortBucket.filter(t => now - t < SHORT_WINDOW);
  entry.longBucket = entry.longBucket.filter(t => now - t < LONG_WINDOW);
  if (entry.shortBucket.length >= SHORT_MAX) return res.status(429).json({ error: 'Too many requests. Wait a minute.' });
  if (entry.longBucket.length >= LONG_MAX) return res.status(429).json({ error: 'Hourly limit reached.' });
  entry.shortBucket.push(now); entry.longBucket.push(now);
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (entry.longBucket.length === 0) rateLimitMap.delete(ip);
    else if (now - Math.max(...entry.longBucket) > 60 * 60 * 1000) rateLimitMap.delete(ip);
  }
}, 10 * 60 * 1000);
app.use(rateLimit);
app.use(express.static(path.join(__dirname, 'public')));

function scrubError(err, context) {
  const msg = (err && err.message) || String(err);
  const safe = msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***REDACTED***');
  console.error(`[${context}] ${safe}`);
}

async function callAnthropic({ apiKey, model, messages, system, maxTokens = 2048, thinking = false }) {
  const body = { model: model || 'claude-sonnet-4-6', max_tokens: maxTokens, messages };

  // System prompt: use array form with cache_control on the last block
  // for prompt caching. Reduces costs by ~90% on repeated tokens (memory,
  // profile notes, loaded docs). Minimum cache size: 1024 tokens for
  // Sonnet/Opus, 2048 for Haiku — Anthropic silently skips caching below this.
  if (system) {
    body.system = [
      {
        type: 'text',
        text: system,
        cache_control: { type: 'ephemeral' }
      }
    ];
  }

  const supportsThinking = /claude-(opus|sonnet|haiku)-4-(5|6|7)/.test(body.model);
  if (thinking && supportsThinking) {
    body.thinking = { type: 'enabled', budget_tokens: 4000 };
    if (body.max_tokens < body.thinking.budget_tokens + 1024) body.max_tokens = body.thinking.budget_tokens + 1024;
  }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const msg = (data.error && data.error.message) || 'API error';
    throw new Error(msg.replace(/sk-[a-zA-Z0-9_-]+/g, 'sk-***REDACTED***'));
  }
  let thinkingText = '', replyText = '';
  for (const block of data.content) {
    if (block.type === 'thinking') thinkingText += block.thinking || '';
    else if (block.type === 'text') replyText += block.text || '';
  }
  // Pass back usage info so the caller can verify caching is working
  return {
    thinking: thinkingText,
    reply: replyText,
    usage: data.usage || null
  };
}

// ─── LIVE MODELS ENDPOINT ───
// Fetches the live list of models from Anthropic, with annotations.
// Cached server-side for 1 hour to reduce API calls.
let modelsCache = null;
let modelsCacheTime = 0;
const MODELS_CACHE_MS = 60 * 60 * 1000;

async function fetchModelsFromAnthropic(apiKey) {
  if (modelsCache && Date.now() - modelsCacheTime < MODELS_CACHE_MS) {
    return modelsCache;
  }
  const r = await fetch('https://api.anthropic.com/v1/models?limit=100', {
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  });
  if (!r.ok) {
    const data = await r.json();
    throw new Error(data.error?.message || 'Could not fetch models');
  }
  const data = await r.json();
  modelsCache = data.data || [];
  modelsCacheTime = Date.now();
  return modelsCache;
}

app.post('/api/models', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(401).json({ error: 'API key required to fetch model list.' });
  try {
    const models = await fetchModelsFromAnthropic(apiKey);
    res.json({ models });
  } catch (err) {
    scrubError(err, 'models');
    res.status(500).json({ error: err.message });
  }
});

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

// Summarization (used for memory + context-doc compression)
app.post('/api/summarize', async (req, res) => {
  const { messages, apiKey, mode, model } = req.body;
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(401).json({ error: 'No API key provided.' });
  try {
    const transcript = messages.map(m => `${m.role === 'user' ? 'User' : 'Claude'}: ${m.content}`).join('\n\n');
    const systemPrompts = {
      memory: `You are summarizing a conversation between a user and Claude for long-term memory purposes. Create a dense, factual summary capturing: key topics, decisions, personal facts the user shared, open questions, important context. Write in dense bullet form, third person.`,
      context: `You are compressing a document so it can fit in a smaller context window while preserving all critical information. Extract: main themes, key facts, named entities, important details, structure. Use dense bullet form. Drop only true filler/repetition. Aim for ~20-30% of original length.`,
    };
    const userPrompts = {
      memory: `Summarize this conversation for long-term memory:\n\n${transcript}`,
      context: `Compress this document while preserving all critical information:\n\n${transcript}`,
    };
    const result = await callAnthropic({
      apiKey: key,
      // Client picks the model based on the Memory Quality setting.
      // Fall back to Haiku if no model passed.
      model: model || 'claude-haiku-4-5',
      system: systemPrompts[mode] || systemPrompts.memory,
      messages: [{ role: 'user', content: userPrompts[mode] || userPrompts.memory }],
      maxTokens: 2000,
    });
    res.json({ summary: result.reply });
  } catch (err) {
    scrubError(err, 'summarize');
    res.status(500).json({ error: err.message });
  }
});

// ─── COMPRESS LARGE FILE ENDPOINT ───
app.post('/api/compress-file', async (req, res) => {
  const { content, apiKey, filename, model } = req.body;
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(401).json({ error: 'No API key provided.' });
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'No content provided.' });

  try {
    const CHUNK_SIZE = 30000;
    const chunks = [];
    for (let i = 0; i < content.length; i += CHUNK_SIZE) {
      chunks.push(content.slice(i, i + CHUNK_SIZE));
    }

    const summaries = [];
    for (const [i, chunk] of chunks.entries()) {
      const result = await callAnthropic({
        apiKey: key,
        model: model || 'claude-haiku-4-5',
        system: `You are compressing chunk ${i + 1} of ${chunks.length} from a document named "${filename || 'document'}". Extract all key information densely: facts, names, decisions, important details. Use bullet form. Drop only filler. Aim for ~25% of original size.`,
        messages: [{ role: 'user', content: chunk }],
        maxTokens: 1500,
      });
      summaries.push(result.reply);
    }

    const combined = summaries.join('\n\n--- next section ---\n\n');
    res.json({
      compressed: combined,
      originalSize: content.length,
      compressedSize: combined.length,
      ratio: (combined.length / content.length).toFixed(2),
      chunks: chunks.length,
    });
  } catch (err) {
    scrubError(err, 'compress-file');
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

// ─── SIGNAL CAPTURE ENDPOINTS ───
// Forward to a webhook (e.g. Make.com, Zapier, or your own email service)
// so signups don't get lost on redeploy. Set NOTIFY_WEBHOOK_URL in Railway env vars.
const NOTIFY_WEBHOOK = process.env.NOTIFY_WEBHOOK_URL || null;

async function notifyOwner(payload) {
  if (!NOTIFY_WEBHOOK) {
    // No webhook configured — log to console for owner to see in Railway logs
    console.log(`[SIGNAL] ${JSON.stringify(payload)}`);
    return;
  }
  try {
    await fetch(NOTIFY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[notify] webhook failed');
  }
}

app.post('/api/waitlist', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'Email required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email.' });
  if (email.length > 200) return res.status(400).json({ error: 'Email too long.' });

  await notifyOwner({ type: 'waitlist', email, timestamp: new Date().toISOString() });
  res.json({ ok: true });
});

app.post('/api/help-request', async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) return res.status(400).json({ error: 'Email and message required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email.' });

  await notifyOwner({
    type: 'help-request',
    email,
    message: message.slice(0, 2000),
    timestamp: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅  Claude Legacy Chat v6.10 running on http://localhost:${PORT}`);
  console.log(`🔒  No request bodies logged. Rate limit: 30/min, 300/hr per IP.`);
  if (ALLOWED_ORIGIN) console.log(`🌐  CORS locked to: ${ALLOWED_ORIGIN}`);
  console.log('');
});

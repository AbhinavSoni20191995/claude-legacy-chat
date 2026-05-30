// ============================================================
// GRAPH MEMORY ENGINE — Claude Legacy Chat
// ============================================================
// A client-side, LLM-supervised knowledge graph for preserving
// conversational context and "personality" continuity.
//
// Design (inspired by MNEME, mnemon, claude-engram patterns):
//   - Nodes  = entities/facts/preferences/events with salience + recency
//   - Edges  = typed relations (temporal, entity, causal, semantic)
//   - Lifecycle: extract -> reinforce -> consolidate -> retrieve
//
// All processing is client-side. The only network calls are to the
// app's /api/* proxy (which forwards to Anthropic). No vector DB,
// no embeddings server — the LLM does the semantic reasoning.
//
// Storage: a single localStorage key holds the whole graph as JSON.
// ============================================================

const GraphMemory = (() => {
  const STORE_KEY = 'claude_graph_memory_v1';

  // Tunables
  const MAX_NODES = 200;            // hard cap; lowest-salience pruned beyond this
  const RETRIEVE_TOP_K = 25;        // nodes injected into context per message
  const DECAY_HALF_LIFE_DAYS = 14;  // salience halves every 2 weeks without reinforcement
  const CONSOLIDATE_EVERY = 12;     // run consolidation every N user messages

  // ---- Graph state ----
  // { nodes: { id: {id,type,label,content,salience,reinforced,createdAt,updatedAt,tier} },
  //   edges: [ {from,to,type,note} ],
  //   meta:  { messagesSinceConsolidate, lastConsolidatedAt } }
  function emptyGraph() {
    return { nodes: {}, edges: [], meta: { messagesSinceConsolidate: 0, lastConsolidatedAt: null } };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyGraph();
      const g = JSON.parse(raw);
      if (!g.nodes || !g.edges) return emptyGraph();
      if (!g.meta) g.meta = { messagesSinceConsolidate: 0, lastConsolidatedAt: null };
      return g;
    } catch { return emptyGraph(); }
  }

  function save(g) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(g)); return true; }
    catch (e) {
      // Quota — prune hardest and retry once
      pruneToCap(g, Math.floor(MAX_NODES / 2));
      try { localStorage.setItem(STORE_KEY, JSON.stringify(g)); return true; } catch { return false; }
    }
  }

  function wipe() { localStorage.removeItem(STORE_KEY); }

  // ---- Salience with time decay ----
  function effectiveSalience(node) {
    const ageDays = (Date.now() - (node.updatedAt || node.createdAt)) / (1000 * 60 * 60 * 24);
    const decay = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
    // Reinforcement adds a floor so often-mentioned things resist decay
    const reinforceBoost = Math.min(0.4, (node.reinforced || 0) * 0.05);
    return Math.min(1, node.salience * decay + reinforceBoost);
  }

  function pruneToCap(g, cap = MAX_NODES) {
    const ids = Object.keys(g.nodes);
    if (ids.length <= cap) return;
    const ranked = ids.map(id => ({ id, s: effectiveSalience(g.nodes[id]) }))
                      .sort((a, b) => b.s - a.s);
    const keep = new Set(ranked.slice(0, cap).map(r => r.id));
    for (const id of ids) if (!keep.has(id)) delete g.nodes[id];
    // Drop edges that reference removed nodes
    g.edges = g.edges.filter(e => g.nodes[e.from] && g.nodes[e.to]);
  }

  // ---- ID helper ----
  function makeId(label) {
    return 'n_' + (label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Math.random().toString(36).slice(2, 6);
  }

  // Find an existing node with a similar label (cheap string match;
  // semantic dedup happens in consolidation via the LLM).
  function findSimilarNode(g, label) {
    const norm = (label || '').toLowerCase().trim();
    for (const id in g.nodes) {
      const nl = (g.nodes[id].label || '').toLowerCase().trim();
      if (nl === norm) return id;
      // loose containment match for short labels
      if (norm.length > 4 && (nl.includes(norm) || norm.includes(nl))) return id;
    }
    return null;
  }

  // ============================================================
  // EXTRACT — pull entities + relations from a recent exchange
  // ============================================================
  // `callLLM` is injected: async ({system, messages, model, maxTokens}) => text
  async function extract(g, exchangeText, callLLM) {
    const system = `You extract structured memory from a conversation between a user and an AI assistant. Return ONLY valid JSON, no prose, no markdown fences.

Extract durable, reusable knowledge — not transient chit-chat. Schema:
{
  "nodes": [
    { "type": "person|project|concept|preference|event|fact|trait",
      "label": "short unique name",
      "content": "one dense sentence of detail",
      "salience": 0.0-1.0 }
  ],
  "edges": [
    { "from": "label", "to": "label", "type": "temporal|entity|causal|semantic", "note": "short" }
  ]
}

Rules:
- salience: how important/durable is this for long-term continuity (0.9+ = core identity/relationship, 0.5 = useful context, 0.2 = minor).
- Capture the user's traits, preferences, ongoing projects, key people, decisions, and emotional/relational tone with the assistant.
- Prefer few high-quality nodes over many trivial ones. Max 8 nodes per call.
- Edge endpoints must reference node labels (existing or new).`;

    let text;
    try {
      text = await callLLM({
        system,
        // model omitted — host app's callLLM picks based on quality setting
        maxTokens: 1200,
        messages: [{ role: 'user', content: `Extract memory from this exchange:\n\n${exchangeText}` }],
      });
    } catch { return g; }

    let parsed;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch { return g; }

    // Merge nodes
    const labelToId = {};
    for (const id in g.nodes) labelToId[(g.nodes[id].label || '').toLowerCase().trim()] = id;

    for (const n of (parsed.nodes || [])) {
      if (!n.label) continue;
      const existingId = findSimilarNode(g, n.label);
      if (existingId) {
        // Reinforce
        const node = g.nodes[existingId];
        node.reinforced = (node.reinforced || 0) + 1;
        node.salience = Math.max(node.salience, n.salience || 0.5);
        node.updatedAt = Date.now();
        if (n.content && n.content.length > (node.content || '').length) node.content = n.content;
        labelToId[(n.label || '').toLowerCase().trim()] = existingId;
      } else {
        const id = makeId(n.label);
        g.nodes[id] = {
          id, type: n.type || 'fact', label: n.label,
          content: n.content || '', salience: n.salience || 0.5,
          reinforced: 0, createdAt: Date.now(), updatedAt: Date.now(),
          tier: 'episodic',
        };
        labelToId[(n.label || '').toLowerCase().trim()] = id;
      }
    }

    // Merge edges
    for (const e of (parsed.edges || [])) {
      const from = labelToId[(e.from || '').toLowerCase().trim()];
      const to = labelToId[(e.to || '').toLowerCase().trim()];
      if (!from || !to || from === to) continue;
      const exists = g.edges.some(x => x.from === from && x.to === to && x.type === e.type);
      if (!exists) g.edges.push({ from, to, type: e.type || 'entity', note: e.note || '' });
    }

    pruneToCap(g);
    return g;
  }

  // ============================================================
  // CONSOLIDATE — merge dupes, resolve contradictions, promote tiers
  // ============================================================
  async function consolidate(g, callLLM) {
    const nodeList = Object.values(g.nodes);
    if (nodeList.length < 6) return g; // not worth it yet

    const summary = nodeList.map(n =>
      `${n.id} [${n.type}, sal=${effectiveSalience(n).toFixed(2)}, x${n.reinforced}] ${n.label}: ${n.content}`
    ).join('\n');

    const system = `You are consolidating an AI assistant's long-term memory graph about a user. Return ONLY valid JSON, no prose.

Given the node list, produce:
{
  "merge": [ { "keep": "node_id", "remove": ["node_id", ...], "mergedContent": "combined sentence" } ],
  "drop": [ "node_id", ... ],            // redundant/trivial/contradicted-stale nodes
  "promote": [ "node_id", ... ]          // episodic nodes that are now stable semantic facts
}

Rules:
- Merge nodes that refer to the same entity/fact.
- Resolve contradictions by keeping the newest/highest-salience info.
- Drop genuine noise, but never drop core identity, relationships, or active projects.
- Be conservative — when unsure, keep.`;

    let text;
    try {
      text = await callLLM({
        system,
        // model omitted — host app's callLLM picks based on quality setting
        maxTokens: 1500,
        messages: [{ role: 'user', content: `Consolidate this memory graph:\n\n${summary}` }],
      });
    } catch { return g; }

    let plan;
    try { plan = JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return g; }

    // Apply merges
    for (const m of (plan.merge || [])) {
      if (!g.nodes[m.keep]) continue;
      if (m.mergedContent) g.nodes[m.keep].content = m.mergedContent;
      g.nodes[m.keep].updatedAt = Date.now();
      for (const rid of (m.remove || [])) {
        if (rid === m.keep || !g.nodes[rid]) continue;
        g.nodes[m.keep].reinforced += (g.nodes[rid].reinforced || 0) + 1;
        // redirect edges
        g.edges.forEach(e => { if (e.from === rid) e.from = m.keep; if (e.to === rid) e.to = m.keep; });
        delete g.nodes[rid];
      }
    }
    // Apply drops
    for (const id of (plan.drop || [])) delete g.nodes[id];
    // Apply promotions
    for (const id of (plan.promote || [])) if (g.nodes[id]) g.nodes[id].tier = 'semantic';

    // Clean dangling edges + dedupe
    g.edges = g.edges.filter(e => g.nodes[e.from] && g.nodes[e.to]);
    const seen = new Set();
    g.edges = g.edges.filter(e => { const k = e.from + '>' + e.to + '>' + e.type; if (seen.has(k)) return false; seen.add(k); return true; });

    g.meta.lastConsolidatedAt = Date.now();
    g.meta.messagesSinceConsolidate = 0;
    pruneToCap(g);
    return g;
  }

  // ============================================================
  // RETRIEVE — build a context block of the most relevant memory
  // ============================================================
  // Scores by salience(+decay) and light keyword relevance to the query.
  function retrieve(g, queryText) {
    const nodes = Object.values(g.nodes);
    if (nodes.length === 0) return '';

    const qWords = new Set((queryText || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []);

    const scored = nodes.map(n => {
      let score = effectiveSalience(n);
      // relevance boost: overlap between query words and node text
      const text = (n.label + ' ' + n.content).toLowerCase();
      let overlap = 0;
      qWords.forEach(w => { if (text.includes(w)) overlap++; });
      score += overlap * 0.15;
      // semantic (consolidated) facts get a small stability bonus
      if (n.tier === 'semantic') score += 0.1;
      return { n, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, RETRIEVE_TOP_K).map(s => s.n);

    // Build readable context with relationships
    const lines = top.map(n => `- (${n.type}) ${n.label}: ${n.content}`);

    // Include edges among the retrieved nodes for relational context
    const topIds = new Set(top.map(n => n.id));
    const relEdges = g.edges.filter(e => topIds.has(e.from) && topIds.has(e.to));
    const relLines = relEdges.slice(0, 30).map(e => {
      const f = g.nodes[e.from], t = g.nodes[e.to];
      return `- ${f.label} —[${e.type}${e.note ? ': ' + e.note : ''}]→ ${t.label}`;
    });

    let block = 'KNOWN FACTS & CONTEXT ABOUT THE USER (from graph memory):\n' + lines.join('\n');
    if (relLines.length) block += '\n\nRELATIONSHIPS:\n' + relLines.join('\n');
    return block;
  }

  // ============================================================
  // STATS — for the UI memory viewer
  // ============================================================
  function stats(g) {
    const nodes = Object.values(g.nodes);
    return {
      nodeCount: nodes.length,
      edgeCount: g.edges.length,
      semanticCount: nodes.filter(n => n.tier === 'semantic').length,
      topNodes: nodes.map(n => ({ label: n.label, type: n.type, salience: effectiveSalience(n) }))
                     .sort((a, b) => b.salience - a.salience).slice(0, 15),
      lastConsolidated: g.meta.lastConsolidatedAt,
    };
  }

  // ============================================================
  // PUBLIC: process a completed exchange (extract + maybe consolidate)
  // ============================================================
  async function ingest(userText, assistantText, callLLM) {
    const g = load();
    const exchange = `User: ${userText}\n\nAssistant: ${assistantText}`;
    await extract(g, exchange, callLLM);
    g.meta.messagesSinceConsolidate = (g.meta.messagesSinceConsolidate || 0) + 1;
    if (g.meta.messagesSinceConsolidate >= CONSOLIDATE_EVERY) {
      await consolidate(g, callLLM);
    }
    save(g);
    return g;
  }

  function buildContext(queryText) {
    const g = load();
    return retrieve(g, queryText);
  }

  return { load, save, wipe, ingest, buildContext, stats, consolidate, CONSOLIDATE_EVERY };
})();

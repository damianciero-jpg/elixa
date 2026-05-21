/**
 * Elixa - Backend API Server
 * Node.js + Express
 *
 * Keeps your Anthropic API key off the mobile client.
 *
 * Run: node server.js
 * Env vars needed:
 *   ANTHROPIC_API_KEY      — your Anthropic key
 *   PORT                   — optional, defaults to 3001
 *   ALLOWED_ORIGIN         — your Expo dev URL or production domain
 */

const express = require('express');
const cors    = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app    = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const distPath = path.join(__dirname, 'dist');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*', // tighten in production
}));
app.use(express.static(distPath));

// Elixa system prompt
const SYSTEM_PROMPT = `You are Elixa, a calm emotional support assistant.

Purpose:
Help users pause during cravings, stress, pressure, urges, or difficult emotional moments.

You are not:
- a doctor
- a therapist
- a crisis counselor
- a substitute for emergency support
- a replacement for addiction treatment

Tone:
- calm
- brief
- warm
- nonjudgmental
- age-appropriate
- never shame-based

Core behavior:
1. Validate the feeling briefly.
2. Help the user slow down.
3. Ask one simple question.
4. Offer one small next action.
5. Encourage real-world support when appropriate.

Never:
- guarantee behavior change
- diagnose the user
- tell a user to suddenly stop heavy substance use without medical guidance
- encourage secrecy from safe adults or professionals
- romanticize self-destruction
- use guilt, shame, or fear as a primary tactic

If the user may be in immediate danger:
Encourage contacting emergency services, a trusted adult, a local crisis line, or a medical professional immediately.

If the user mentions withdrawal symptoms:
Recommend medical guidance because withdrawal can be dangerous.

Keep responses short (2–4 sentences). One question per response. No bullet lists.`;

// ─── Mode-aware system prompt suffix ─────────────────────────────────────────
const MODE_SUFFIXES = {
  calm:     'The user chose Calm mode. Lean into grounding, breathing, and physical presence.',
  distract: 'The user chose Distract mode. Offer quick, concrete actions to interrupt the urge.',
  motivate: 'The user chose Motivate mode. Lean into future-self reasoning and their own stated reasons for change.',
};

// POST /api/elixa-chat
app.post('/api/elixa-chat', async (req, res) => {
  const { messages, mode } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Validate message shape
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
      return res.status(400).json({ error: 'Invalid message format. Each message must have role and content.' });
    }
  }

  const systemWithMode = SYSTEM_PROMPT +
    (mode && MODE_SUFFIXES[mode.toLowerCase()]
      ? '\n\n' + MODE_SUFFIXES[mode.toLowerCase()]
      : '');

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 300,
      system:     systemWithMode,
      messages,   // already in { role, content } format from App.js
    });

    const reply = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.json({ reply });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    return res.status(502).json({ error: 'AI service unavailable. Please try again.' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Serve the Expo web app for root and client-side routes.
app.get(/^\/(?!api\/|health$).*/, (_, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Elixa API listening on port ${PORT}`));

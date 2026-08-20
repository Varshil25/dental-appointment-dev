import { Router } from 'express';
import { GoogleGenAI, ApiError } from '@google/genai';
import { config } from '../config.js';

const router = Router();

// Cheapest/fastest tier Google recommends for exactly this shape of task
// (routine, high-volume, simple support chat) — not the flagship model
// this app has no need to pay flagship rates for. gemini-2.5-flash-lite is
// deprecated for new API keys as of testing this (confirmed live via a 404
// from the API itself, which named this replacement) — if Google ships a
// newer flash-lite later, prefer that over reaching for a non-lite tier.
const MODEL = 'gemini-3.5-flash-lite';
// A support widget reply should be a few sentences, not an essay — also
// bounds worst-case cost per request.
const MAX_TOKENS = 500;
// Caps both token cost and the size of what a client can push through this
// endpoint per request; older turns beyond this are simply dropped from
// what's sent to the model (the browser tab still shows full history).
const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 2000;

const client = config.geminiApiKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Visibility into usage/cost while testing — deliberately simple (console),
// matching how the rest of this backend logs (no metrics stack exists yet).
let requestCount = 0;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

function formatHours(hours) {
  return [...(hours || [])]
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => `${DAY_NAMES[h.day_of_week]}: ${h.is_closed ? 'Closed' : `${h.open_time}–${h.close_time}`}`)
    .join('\n');
}

// Pulled fresh on every request (not cached/hardcoded) so an admin editing
// clinic profile or dentists via the staff dashboard is reflected in the
// chatbot's answers immediately, with no redeploy or restart.
async function buildSystemPrompt() {
  const [profile, dentists] = await Promise.all([
    fetchJson(`${config.services.dentist}/clinic-profile`).catch(() => null),
    fetchJson(`${config.services.dentist}/`).catch(() => []),
  ]);

  const activeDentists = (dentists || []).filter((d) => d.status === 'active');
  const dentistLines = activeDentists.length
    ? activeDentists.map((d) => `- ${d.name}${d.specialty ? ` (${d.specialty})` : ''}`).join('\n')
    : 'No dentist information is currently available.';

  const clinicName = profile?.clinic_name || config.clinic.name;
  const address = profile?.address || 'not listed';
  const phone = profile?.phone || 'not listed';
  const hoursText = profile?.hours?.length ? formatHours(profile.hours) : 'not listed';

  return `You are a friendly, concise front-desk assistant on ${clinicName}'s website.

CLINIC INFO (accurate as of this message — this is the only source of truth, never invent details beyond it):
Address: ${address}
Phone: ${phone}
Hours:
${hoursText}

Dentists:
${dentistLines}

YOUR JOB:
- Answer questions about the clinic (hours, location, phone, dentists, specialties) and general dental FAQs (what a cleaning involves, when to see a dentist, common procedures) helpfully and concisely.
- If the patient wants to book, reschedule, or cancel an appointment, do NOT attempt it conversationally. In one short sentence, direct them to the booking page at /book for a new appointment, or /book/manage to reschedule or cancel an existing one.
- If asked for a specific medical diagnosis or personalized treatment advice, or anything outside general clinic/dental info, politely decline and suggest they ask the dentist directly at their appointment, or call the clinic.
- Keep replies short — 2-4 sentences unless the question genuinely needs a list.
- Never invent clinic details (hours, prices, insurance coverage, specific dentist availability) beyond what's given above — if you don't know, say so and suggest calling the clinic.`;
}

router.post('/', async (req, res) => {
  if (!client) {
    return res.status(503).json({ error: 'chat is not configured' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  // Gemini's role for the assistant turn is 'model', not 'assistant' — the
  // frontend still sends/stores 'assistant' (matches the wire shape every
  // other client in this app uses), translated only at this boundary.
  const cleaned = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content.slice(0, MAX_MESSAGE_CHARS) }],
    }));

  if (!cleaned.length || cleaned[cleaned.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'the last message must be from the user' });
  }

  try {
    const systemInstruction = await buildSystemPrompt();

    const response = await client.models.generateContent({
      model: MODEL,
      contents: cleaned,
      config: { systemInstruction, maxOutputTokens: MAX_TOKENS },
    });

    requestCount += 1;
    console.log(
      `[gateway] chat request #${requestCount} — in:${response.usageMetadata?.promptTokenCount ?? '?'} out:${response.usageMetadata?.candidatesTokenCount ?? '?'} tokens`
    );

    res.json({ reply: response.text || "Sorry, I couldn't come up with a reply — please try again." });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      console.error('[gateway] chat: invalid GEMINI_API_KEY');
    } else if (err instanceof ApiError && err.status === 429) {
      console.error('[gateway] chat: rate-limited by Gemini API');
    } else if (err instanceof ApiError) {
      console.error('[gateway] chat: Gemini API error', err.status, err.message);
    } else {
      console.error('[gateway] chat error:', err.message);
    }
    res.status(502).json({ error: 'The assistant is temporarily unavailable — please try again in a moment.' });
  }
});

export default router;

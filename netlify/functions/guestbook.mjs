// GET lists recent comments; POST screens one with OpenAI moderation, then saves it.
// Needs Netlify environment variable OPENAI_API_KEY.
import { getStore } from '@netlify/blobs';

const reply = (status, data) => Response.json(data, { status });

export default async (req) => {
  const store = getStore('guestbook');

  if (req.method === 'GET') {
    // Fetch the newest 100 stored comments.
    const { blobs } = await store.list();
    const keys = blobs.map(b => b.key).sort().reverse().slice(0, 100);
    return reply(200, (await Promise.all(keys.map(k => store.get(k, { type: 'json' })))).filter(Boolean));
  }
  if (req.method !== 'POST') return reply(405, { message: 'GET or POST only.' });

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply(400, { message: 'Please enter a name and message.' });
  const { name, body } = payload;
  const n = typeof name === 'string' ? name.trim() : '';
  const b = typeof body === 'string' ? body.trim() : '';
  if (!n || n.length > 30 || !b || b.length > 280) return reply(400, { message: 'Name up to 30 characters, message up to 280.' });

  // Fail closed: if OpenAI can't be reached, nothing gets posted.
  if (!process.env.OPENAI_API_KEY) return reply(503, { message: 'Guestbook moderation is not configured yet.' });
  const mod = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'omni-moderation-latest', input: `${n}\n${b}` }),
  }).catch(() => null);
  if (!mod?.ok) return reply(503, { message: 'Could not post. Try again.' });
  const { results } = await mod.json().catch(() => ({}));
  if (results?.[0]?.flagged !== false) return reply(400, { message: 'Please keep it friendly.' });

  const created_at = new Date().toISOString();
  await store.setJSON(`${created_at}-${crypto.randomUUID()}`, { name: n, body: b, created_at });
  return reply(201, { message: 'ok' });
};

export const config = { path: '/api/guestbook' };

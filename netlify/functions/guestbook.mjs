// Public comments and owner-only deletion.
// Secrets: OPENAI_API_KEY and GUESTBOOK_ADMIN_PASSWORD (at least 32 characters).
import { getStore } from '@netlify/blobs';

export default async (req, context = {}) => {
  const origin = req.headers.get('Origin');
  const allowed = new Set(['https://josephruocco.github.io', new URL(req.url).origin]);
  const headers = {
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (origin && allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (status, data) => Response.json(data, { status, headers });
  if (origin && !allowed.has(origin)) return reply(403, { message: 'This origin is not allowed.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const store = getStore({ name: 'guestbook', consistency: 'strong' });

  const adminRequest = req.method === 'DELETE' || new URL(req.url).searchParams.has('admin');
  if (adminRequest) {
    const password = process.env.GUESTBOOK_ADMIN_PASSWORD;
    if (!password || password.length < 32) return reply(503, { message: 'Set GUESTBOOK_ADMIN_PASSWORD in Netlify to a password of at least 32 characters, then redeploy.' });
    const supplied = req.headers.get('Authorization') || '';
    const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const expected = await digest(`Bearer ${password}`), actual = await digest(supplied);
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ actual[i];
    if (mismatch) return reply(401, { message: 'Incorrect admin password.' });
  }
  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z-[a-f0-9-]{36}$/.test(id)) return reply(400, { message: 'Invalid comment.' });
    if (!await store.get(id, { type: 'json' })) return reply(404, { message: 'Comment already removed.' });
    await store.delete(id);
    return reply(200, { message: 'Comment deleted.' });
  }
  if (req.method === 'GET') {
    // Fetch the newest 100 stored comments.
    const { blobs } = await store.list();
    const keys = blobs.map(b => b.key).sort().reverse().slice(0, 100);
    return reply(200, (await Promise.all(keys.map(async id => { const row = await store.get(id, { type: 'json' }); return row ? { ...row, id } : null; }))).filter(Boolean));
  }
  if (req.method !== 'POST') return reply(405, { message: 'GET, POST or DELETE only.' });

  // Bound reads even when the client omits Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return reply(400, { message: 'Please enter a name and message.' });
  let raw = '', bytes = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 4096) { await reader.cancel(); return reply(413, { message: 'Message is too large.' }); }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  let payload;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply(400, { message: 'Please enter a name and message.' });
  if (payload.website) return reply(400, { message: 'Could not post.' });
  const { name, body } = payload;
  const n = typeof name === 'string' ? name.trim() : '';
  const b = typeof body === 'string' ? body.trim() : '';
  if (!n || n.length > 30 || !b || b.length > 280) return reply(400, { message: 'Name up to 30 characters, message up to 280.' });

  // Moderation categories do not replace an explicit profanity rule.
  const normalized = `${n} ${b}`.normalize('NFKC').toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, '')
    .replace(/[014@$!]/g, c => ({ '0': 'o', '1': 'i', '4': 'a', '@': 'a', '$': 's', '!': 'i' }[c]));
  if (/\b(?:fuck\w*|shit\w*|bullshit|bitch\w*|cunt\w*|assholes?|motherfuck\w*)\b/i.test(normalized)) {
    return reply(400, { message: 'Please keep it friendly and avoid profanity.' });
  }

  // Fail closed: if OpenAI can't be reached, nothing gets posted.
  if (!process.env.OPENAI_API_KEY) return reply(503, { message: 'Guestbook moderation is not configured yet.' });
  // An atomic expiring lease prevents parallel requests bypassing the cooldown.
  // Use Netlify's trusted client IP, never a caller-supplied forwarding header.
  if (!context.ip) return reply(503, { message: 'Could not verify your connection. Try again.' });
  const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join('');
  const client = await hash(`${process.env.OPENAI_API_KEY}:${context.ip}`);
  const bodyHash = await hash(b.normalize('NFKC').toLowerCase().replace(/\s+/g, ' '));
  const limits = getStore({ name: 'guestbook-limits', consistency: 'strong' });
  const previous = await limits.getWithMetadata(client, { type: 'json' });
  const now = Date.now();
  const remaining = previous ? Math.ceil((previous.data.until - now) / 1000) : 0;
  if (remaining > 0) {
    headers['Retry-After'] = String(remaining);
    return reply(429, { message: `Wait ${remaining} seconds before posting again.` });
  }
  if (previous?.data.accepted && previous.data.bodyHash === bodyHash && previous.data.until + 86400000 > now) return reply(409, { message: 'You already sent that message. Try something new.' });
  const claim = await limits.setJSON(client, { until: now + 30000, bodyHash }, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
  if (!claim.modified) return reply(429, { message: 'Another message is posting. Wait 30 seconds.' });
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
  await limits.setJSON(client, { until: now + 30000, bodyHash, accepted: true }, { onlyIfMatch: claim.etag });
  return reply(201, { message: 'ok' });
};

export const config = { path: '/api/guestbook', rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } };

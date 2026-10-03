const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync('netlify/functions/guestbook.mjs', 'utf8')
  .replace(/import \{ getStore \} from '@netlify\/blobs';/, '')
  .replace('export default async', 'return async')
  .replace(/export const config = .*;/, '');
function fixture({ key = 'test-only', flagged = false, broken = false } = {}) {
  const stored = [];
  const store = { setJSON: async (id, entry) => stored.push(entry), list: async () => ({ blobs: [] }) };
  const fetchMock = async () => broken ? { ok: true, json: async () => { throw Error('bad JSON'); } } : Response.json({ results: [{ flagged }] });
  const handler = new Function('getStore', 'fetch', 'process', 'Response', 'AbortSignal', 'crypto', source)(
    () => store, fetchMock, { env: { OPENAI_API_KEY: key } }, Response, AbortSignal, crypto
  );
  return { stored, handler };
}
const request = payload => new Request('https://example.test/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
test('valid screened message is saved', async () => {
  const { handler, stored } = fixture();
  assert.equal((await handler(request({ name: ' Visitor ', body: ' Hi! ' }))).status, 201);
  assert.equal(stored[0].name, 'Visitor');assert.equal(stored[0].body, 'Hi!');
});
test('flagged message is never saved', async () => {
  const { handler, stored } = fixture({ flagged: true });
  assert.equal((await handler(request({ name: 'Visitor', body: 'Flagged test fixture' }))).status, 400);
  assert.equal(stored.length, 0);
});
test('missing key and malformed moderation response fail closed', async () => {
  for (const options of [{ key: '' }, { broken: true }]) {
    const { handler, stored } = fixture(options);
    assert.ok((await handler(request({ name: 'Visitor', body: 'Hi!' }))).status >= 400);
    assert.equal(stored.length, 0);
  }
});
test('null, arrays, and oversized messages are rejected', async () => {
  const { handler, stored } = fixture();
  for (const payload of [null, [], { name: 'Visitor', body: 'x'.repeat(281) }]) assert.equal((await handler(request(payload))).status, 400);
  assert.equal(stored.length, 0);
});
test('GitHub Pages can preflight and read comments; unknown origins are rejected', async () => {
  const { handler } = fixture();
  const headers = { Origin: 'https://josephruocco.github.io' };
  const preflight = await handler(new Request('https://example.test/api/guestbook', { method: 'OPTIONS', headers }));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), headers.Origin);
  const list = await handler(new Request('https://example.test/api/guestbook', { headers }));
  assert.equal(list.status, 200);
  assert.equal(list.headers.get('Access-Control-Allow-Origin'), headers.Origin);
  assert.equal((await handler(new Request('https://example.test/api/guestbook', { headers: { Origin: 'https://untrusted.example' } }))).status, 403);
});
test('profanity is rejected even when the moderation result would be unflagged', async () => {
  const { handler, stored } = fixture();
  for (const body of ['this is bullshit', 'what the fUck', 'sh1t']) {
    assert.equal((await handler(request({ name: 'Visitor', body }))).status, 400);
  }
  assert.equal(stored.length, 0);
});

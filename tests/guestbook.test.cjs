const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const source = fs.readFileSync('netlify/functions/guestbook.mjs', 'utf8')
  .replace(/import \{ getStore \} from '@netlify\/blobs';/, '')
  .replace('export default async', 'return async')
  .replace(/export const config = .*;/, '');
function fixture({ key = 'test-only', flagged = false, broken = false, admin = 'a'.repeat(32) } = {}) {
  const stored = [];
  const entries = new Map(), leases = new Map();
  const store = { setJSON: async (id, entry) => {stored.push(entry);entries.set(id,entry)}, list: async () => ({ blobs: [...entries.keys()].map(key=>({key})) }), get: async id=>entries.get(id), delete: async id=>entries.delete(id) };
  const limits = {
    getWithMetadata: async id=>leases.get(id),
    setJSON: async (id,data,condition)=>{
      const prev=leases.get(id);
      if(condition.onlyIfNew ? !!prev : prev?.etag!==condition.onlyIfMatch)return {modified:false};
      const etag=crypto.randomUUID();leases.set(id,{data,etag});return {modified:true,etag};
    }
  };
  const fetchMock = async () => broken ? { ok: true, json: async () => { throw Error('bad JSON'); } } : Response.json({ results: [{ flagged }] });
  const handler = new Function('getStore', 'fetch', 'process', 'Response', 'AbortSignal', 'crypto', source)(
    options => options.name==='guestbook-limits'?limits:store, fetchMock, { env: { OPENAI_API_KEY: key, GUESTBOOK_ADMIN_PASSWORD: admin } }, Response, AbortSignal, crypto
  );
  return { stored, entries, leases, handler: (req,context={ip:'192.0.2.1'})=>handler(req,context) };
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

test('cooldown and concurrent requests allow only one post per client', async () => {
  const {handler,stored}=fixture();
  const results=await Promise.all(Array.from({length:5},()=>handler(request({name:'Visitor',body:'Hello'}))));
  assert.equal(results.filter(r=>r.status===201).length,1);
  assert.equal(results.filter(r=>r.status===429).length,4);
  assert.equal(stored.length,1);
  assert.equal((await handler(request({name:'Other',body:'Hello'}),{ip:'192.0.2.2'})).status,201);
});
test('cooldown expires but duplicate message is still blocked', async () => {
  const {handler,leases}=fixture();
  await handler(request({name:'Visitor',body:'Hello'}));
  [...leases.values()][0].data.until=Date.now()-1;
  assert.equal((await handler(request({name:'Visitor',body:'HELLO'}))).status,409);
  assert.equal((await handler(request({name:'Visitor',body:'Another message'}))).status,201);
});
test('honeypot, oversized body and missing trusted IP cannot save comments', async () => {
  const {handler,stored}=fixture();
  assert.equal((await handler(request({name:'Bot',body:'Hi',website:'spam'}))).status,400);
  assert.equal((await handler(request({name:'Bot',body:'x'.repeat(5000)}))).status,413);
  assert.equal((await handler(request({name:'Visitor',body:'Hi'}),{})).status,503);
  assert.equal(stored.length,0);
});
test('only authenticated owner can delete and deleted comments disappear', async () => {
  const {handler}=fixture();
  await handler(request({name:'Visitor',body:'Hello'}));
  const url='https://example.test/api/guestbook';
  const rows=await (await handler(new Request(url))).json();
  assert.equal(rows.length,1);
  const target=url+'?id='+encodeURIComponent(rows[0].id);
  assert.equal((await handler(new Request(target,{method:'DELETE'}))).status,401);
  assert.equal((await handler(new Request(target,{method:'DELETE',headers:{Authorization:'Bearer wrong'}}))).status,401);
  const headers={Authorization:'Bearer '+'a'.repeat(32)};
  assert.equal((await handler(new Request(url+'?admin=1',{headers}))).status,200);
  assert.equal((await handler(new Request(target,{method:'DELETE',headers}))).status,200);
  assert.deepEqual(await (await handler(new Request(url))).json(),[]);
  assert.equal((await handler(new Request(target,{method:'DELETE',headers}))).status,404);
  assert.equal((await handler(new Request(url+'?id=bad',{method:'DELETE',headers}))).status,400);
});
test('admin fails closed without a sufficiently long configured password', async () => {
  for(const admin of ['', 'short']){
    const {handler}=fixture({admin});
    assert.equal((await handler(new Request('https://example.test/api/guestbook?admin=1'))).status,503);
  }
});

test('moderation outages do not mark a message as an accepted duplicate', async () => {
  const {handler,leases}=fixture({broken:true});
  const payload={name:'Visitor',body:'Hello'};
  assert.equal((await handler(request(payload))).status,400);
  [...leases.values()][0].data.until=Date.now()-1;
  assert.equal((await handler(request(payload))).status,400);
  assert.equal([...leases.values()][0].data.accepted,undefined);
});

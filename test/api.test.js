'use strict';

// Tes handler tanpa server & tanpa database (pakai fallback memori).
const assert = require('assert');
const { EventEmitter } = require('events');

const shorten = require('../api/shorten');
const redirect = require('../api/r');
const stats = require('../api/stats');

function mockReq({ method = 'GET', body, query = {}, ip = '1.1.1.1' } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.body = body;
  req.query = query;
  req.headers = { host: 'alca.test', 'x-forwarded-proto': 'https', 'x-forwarded-for': ip };
  return req;
}

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  res.end = (b) => { res.body = b || ''; res.done = true; };
  return res;
}

async function post(body, ip) {
  const res = mockRes();
  await shorten(mockReq({ method: 'POST', body, ip }), res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

async function run() {
  let n = 0;
  const t = async (name, fn) => { await fn(); n++; console.log('  ✓', name); };

  await t('buat link dengan alias custom', async () => {
    const r = await post({ url: 'https://linktree.com/alca', alias: 'alcaganteng' });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.json.short, 'https://alca.test/alcaganteng');
  });

  await t('alias bentrok → 409', async () => {
    const r = await post({ url: 'https://example.com', alias: 'alcaganteng' });
    assert.strictEqual(r.status, 409);
  });

  await t('redirect 302 ke URL asli + hitung klik', async () => {
    const res = mockRes();
    await redirect(mockReq({ query: { slug: 'alcaganteng' } }), res);
    assert.strictEqual(res.statusCode, 302);
    assert.strictEqual(res.headers.location, 'https://linktree.com/alca');
    await new Promise((r) => setTimeout(r, 10));
    const s = mockRes();
    await stats(mockReq({ query: { slug: 'alcaganteng' } }), s);
    assert.strictEqual(JSON.parse(s.body).clicks, 1);
  });

  await t('slug tidak ada → 404', async () => {
    const res = mockRes();
    await redirect(mockReq({ query: { slug: 'tidakada' } }), res);
    assert.strictEqual(res.statusCode, 404);
  });

  await t('alias acak otomatis', async () => {
    const r = await post({ url: 'example.com/halaman' });
    assert.strictEqual(r.status, 201);
    assert.ok(/^[a-zA-Z0-9]{6}$/.test(r.json.slug));
    assert.strictEqual(r.json.url, 'https://example.com/halaman');
  });

  await t('tolak javascript: / data: / ftp:', async () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com/a']) {
      const r = await post({ url: u });
      assert.strictEqual(r.status, 400, u);
    }
  });

  await t('tolak alias terlarang & karakter aneh', async () => {
    assert.strictEqual((await post({ url: 'https://a.com', alias: 'api' })).status, 400);
    assert.strictEqual((await post({ url: 'https://a.com', alias: 'a b!' })).status, 400);
    assert.strictEqual((await post({ url: 'https://a.com', alias: 'ab' })).status, 400);
  });

  await t('tolak link ke AlcaShort sendiri', async () => {
    const r = await post({ url: 'https://alca.test/abc' });
    assert.strictEqual(r.status, 400);
  });

  await t('tolak method selain POST di /api/shorten', async () => {
    const res = mockRes();
    await shorten(mockReq({ method: 'GET' }), res);
    assert.strictEqual(res.statusCode, 405);
  });

  await t('rate limit → 429', async () => {
    let last;
    for (let i = 0; i < 20; i++) last = await post({ url: 'https://example.com/' + i }, '9.9.9.9');
    assert.strictEqual(last.status, 429);
  });

  console.log(`\n${n} tes lulus.`);
}

run().catch((e) => { console.error('GAGAL:', e); process.exit(1); });

'use strict';

const store = require('../lib/store');
const { isValidSlug, RESERVED } = require('../lib/utils');

function notFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 · AlcaShort</title>
<style>
:root{color-scheme:light dark}
body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fff;color:#0b0f14;text-align:center}
@media(prefers-color-scheme:dark){body{background:#0b0f14;color:#e8edf3}}
h1{font-size:4rem;margin:0}p{opacity:.7}
a{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600}
</style></head><body><main><h1>404</h1><p>Link tidak ditemukan atau sudah tidak aktif.</p><a href="/">Buat link baru</a></main></body></html>`);
}

module.exports = async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').trim();

  if (!isValidSlug(slug) || RESERVED.has(slug.toLowerCase())) return notFound(res);

  try {
    const raw = await store.get(`link:${slug}`);
    if (!raw) return notFound(res);

    let target;
    try {
      target = JSON.parse(raw).url;
    } catch {
      return notFound(res);
    }

    // Hitung klik tanpa menghambat redirect terlalu lama
    store.incr(`clicks:${slug}`).catch(() => {});

    res.statusCode = 302;
    res.setHeader('Location', target);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.end();
  } catch (err) {
    console.error('redirect error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Terjadi kesalahan server.');
  }
};

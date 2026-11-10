'use strict';

const store = require('../lib/store');
const {
  randomSlug,
  isValidSlug,
  normalizeUrl,
  getOrigin,
  getIp,
  sendJson,
  readJsonBody,
} = require('../lib/utils');

const RATE_LIMIT = Math.max(1, Number(process.env.RATE_LIMIT_PER_MIN) || 15);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method tidak diizinkan.' });
  }

  try {
    // Rate limit per IP per menit
    const minute = Math.floor(Date.now() / 60000);
    const hits = await store.incr(`rl:${getIp(req)}:${minute}`, 90);
    if (hits > RATE_LIMIT) {
      return sendJson(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }

    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object') {
      return sendJson(res, 400, { error: 'Body request tidak valid.' });
    }

    const { host, origin } = getOrigin(req);
    const check = normalizeUrl(body.url, host);
    if (!check.ok) return sendJson(res, 400, { error: check.error });

    const record = JSON.stringify({ url: check.url, createdAt: Date.now() });
    const alias = typeof body.alias === 'string' ? body.alias.trim() : '';

    let slug;
    if (alias) {
      if (!isValidSlug(alias)) {
        return sendJson(res, 400, {
          error: 'Alias 3-32 karakter: huruf, angka, "-" atau "_" (dan bukan kata terlarang).',
        });
      }
      const ok = await store.setIfNotExists(`link:${alias}`, record);
      if (!ok) return sendJson(res, 409, { error: 'Alias sudah dipakai, coba yang lain.' });
      slug = alias;
    } else {
      for (let i = 0; i < 6 && !slug; i++) {
        const candidate = randomSlug(i < 3 ? 6 : 8);
        if (!isValidSlug(candidate)) continue;
        if (await store.setIfNotExists(`link:${candidate}`, record)) slug = candidate;
      }
      if (!slug) return sendJson(res, 500, { error: 'Gagal membuat link, coba lagi.' });
    }

    return sendJson(res, 201, {
      slug,
      short: `${origin}/${slug}`,
      url: check.url,
      persistent: store.persistent,
    });
  } catch (err) {
    console.error('shorten error:', err);
    return sendJson(res, 500, { error: 'Terjadi kesalahan server.' });
  }
};

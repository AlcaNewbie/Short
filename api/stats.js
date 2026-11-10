'use strict';

const store = require('../lib/store');
const { isValidSlug, sendJson } = require('../lib/utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method tidak diizinkan.' });
  }

  const slug = String((req.query && req.query.slug) || '').trim();
  if (!isValidSlug(slug)) return sendJson(res, 400, { error: 'Slug tidak valid.' });

  try {
    const exists = await store.get(`link:${slug}`);
    if (!exists) return sendJson(res, 404, { error: 'Link tidak ditemukan.' });
    const clicks = Number((await store.get(`clicks:${slug}`)) || 0);
    return sendJson(res, 200, { slug, clicks });
  } catch (err) {
    console.error('stats error:', err);
    return sendJson(res, 500, { error: 'Terjadi kesalahan server.' });
  }
};

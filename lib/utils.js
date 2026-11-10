'use strict';

const crypto = require('crypto');

const SLUG_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const RESERVED = new Set([
  'api', 'admin', 'index', 'favicon', 'robots', 'sitemap', 'static', 'public',
  'assets', 'login', 'logout', 'dashboard', 'health', 'status', 'about',
]);
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_URL_LENGTH = 2048;

function randomSlug(length = 6) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug) && !RESERVED.has(slug.toLowerCase());
}

/**
 * Normalisasi & validasi URL tujuan.
 * Hanya http/https. Kalau skema tidak ditulis, otomatis https://
 * Return { ok, url, error }.
 */
function normalizeUrl(input, ownHost) {
  if (typeof input !== 'string') return { ok: false, error: 'URL wajib diisi.' };
  let raw = input.trim();
  if (!raw) return { ok: false, error: 'URL wajib diisi.' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, error: 'URL terlalu panjang.' };

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    // tolak skema aneh seperti javascript:, data:, mailto:
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !/^[^/]+:\d+/.test(raw)) {
      return { ok: false, error: 'Hanya URL http/https yang diperbolehkan.' };
    }
    raw = 'https://' + raw;
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'Format URL tidak valid.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Hanya URL http/https yang diperbolehkan.' };
  }
  if (!parsed.hostname || !parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
    return { ok: false, error: 'Domain URL tidak valid.' };
  }
  if (ownHost && parsed.host.toLowerCase() === String(ownHost).toLowerCase()) {
    return { ok: false, error: 'Tidak bisa memendekkan link AlcaShort itu sendiri.' };
  }
  return { ok: true, url: parsed.toString() };
}

function getOrigin(req) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = (req.headers['x-forwarded-proto'] || (host.startsWith('localhost') ? 'http' : 'https'))
    .split(',')[0]
    .trim();
  return { host, origin: `${proto}://${host}` };
}

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
    try {
      return JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body));
    } catch {
      return null;
    }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000) return null;
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  randomSlug,
  isValidSlug,
  normalizeUrl,
  getOrigin,
  getIp,
  sendJson,
  readJsonBody,
  RESERVED,
};

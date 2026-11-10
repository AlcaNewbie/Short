'use strict';

/**
 * Storage layer.
 * - Production: Upstash Redis (REST API, tanpa dependency).
 * - Local/dev tanpa env: fallback ke memori (hilang saat restart).
 */

const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

const persistent = Boolean(REST_URL && REST_TOKEN);

// ---- Memory fallback ----
const mem = globalThis.__alcaMem || (globalThis.__alcaMem = new Map());

function memGet(key) {
  const item = mem.get(key);
  if (!item) return null;
  if (item.exp && item.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  return item.value;
}

// ---- Redis REST ----
async function redis(command) {
  const res = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

async function get(key) {
  if (!persistent) return memGet(key);
  return redis(['GET', key]);
}

/** Simpan hanya jika key belum ada. Return true kalau berhasil. */
async function setIfNotExists(key, value) {
  if (!persistent) {
    if (memGet(key) !== null) return false;
    mem.set(key, { value, exp: 0 });
    return true;
  }
  const result = await redis(['SET', key, value, 'NX']);
  return result === 'OK';
}

/** Increment counter. Opsional ttl (detik) diset saat pertama dibuat. */
async function incr(key, ttlSeconds) {
  if (!persistent) {
    const current = Number(memGet(key) || 0) + 1;
    const existing = mem.get(key);
    mem.set(key, {
      value: String(current),
      exp: existing ? existing.exp : ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0,
    });
    return current;
  }
  const n = await redis(['INCR', key]);
  if (ttlSeconds && n === 1) await redis(['EXPIRE', key, ttlSeconds]);
  return n;
}

module.exports = { get, setIfNotExists, incr, persistent };

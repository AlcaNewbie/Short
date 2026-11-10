# AlcaShort

Pemendek link simpel, cepat, dengan alias custom. Tema terang & gelap. Siap deploy di Vercel.

**Credits: AlcaW44**

## Fitur

- Pendekkan link + alias custom (contoh: `domainmu.com/alcaganteng`)
- Alias acak otomatis kalau dikosongkan
- Hitung jumlah klik
- Tema White & Dark (ikut sistem, bisa diganti manual)
- Tanpa framework, tanpa dependency → build instan, loading kencang
- Proteksi dasar: validasi URL (hanya http/https), alias terlarang, rate limit per IP

## Struktur

```
AlcaShort/
├── api/
│   ├── shorten.js   POST /api/shorten  → buat link
│   ├── r.js         GET  /:slug        → redirect (lewat rewrite)
│   └── stats.js     GET  /api/stats?slug=...  → jumlah klik
├── lib/
│   ├── store.js     Penyimpanan (Upstash Redis / fallback memori)
│   └── utils.js     Validasi & helper
├── public/          Frontend statis (HTML, CSS, JS)
├── test/            Tes API (npm test)
└── vercel.json      Rewrite /:slug → /api/r
```

## Deploy ke Vercel

1. Upload folder ini ke GitHub (atau pakai `vercel` CLI).
2. Di Vercel: **Add New → Project** → pilih repo-nya. Framework preset: **Other**. Tidak perlu build command.
3. **Hubungkan database (wajib supaya link permanen):**
   - Di project Vercel buka tab **Storage** → **Marketplace** → pilih **Upstash Redis** (ada free tier) → Create & Connect.
   - Vercel otomatis mengisi env `KV_REST_API_URL` dan `KV_REST_API_TOKEN` (atau `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Keduanya sudah didukung.
4. **Redeploy** agar env terbaca. Selesai.

> Tanpa database, aplikasi tetap jalan dalam mode demo (data di memori) dan link bisa hilang kapan saja karena fungsi serverless tidak menyimpan state.

## Jalankan lokal

```bash
npm i -g vercel
vercel dev
```

Buka http://localhost:3000. Untuk tes cepat tanpa Vercel: `npm test`.

## Environment variables

| Nama | Keterangan |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | URL REST Redis |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Token REST Redis |
| `RATE_LIMIT_PER_MIN` | Batas buat link per IP per menit (default 15) |

## Custom domain

Pasang domain pendek di Vercel (**Settings → Domains**) supaya hasil link makin singkat.

## Lisensi

MIT — Credits: AlcaW44

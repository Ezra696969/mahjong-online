---
title: Mahjong Online
emoji: 🀄
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Mahjong Online

Mahjong 4 pemain lewat browser, bisa main bareng teman dari komputer/HP berbeda. Kursi kosong diisi bot.
Server: Node.js + WebSocket (`ws`). Tanpa database, tanpa build step.

## Jalankan di laptop

```bash
npm install
npm start
```

Buka http://localhost:3000, klik **Buat ruangan baru**, lalu kirim kode 4 huruf (atau tautan) ke teman.

- **Satu WiFi/LAN yang sama**: teman membuka `http://<IP-laptopmu>:3000` (cek IP dengan `ipconfig`). Izinkan Node.js di Windows Firewall bila diminta.
- **Beda jaringan, tanpa deploy**: jalankan tunnel, mis. `cloudflared tunnel --url http://localhost:3000` atau `ngrok http 3000`, lalu bagikan URL yang muncul. Laptop harus tetap menyala.

## Online terus tanpa laptop menyala (deploy)

Karena memakai WebSocket, butuh hosting yang menjalankan server Node.js terus-menerus (bukan Vercel/Netlify biasa).

### Render.com (gratis, paling mudah)
1. Upload folder ini ke repo GitHub.
2. Di render.com: **New → Blueprint** (atau **Web Service**), pilih repo. File `render.yaml` sudah menyiapkan semuanya
   (build `npm install`, start `npm start`, health check `/health`).
3. Setelah deploy selesai, Render memberi URL `https://mahjong-online.onrender.com`. Bagikan ke teman.

Catatan paket gratis: server "tidur" setelah ±15 menit tanpa pengunjung dan butuh ±30 detik untuk bangun. Ruangan yang sedang
bermain tersimpan di memori, jadi hilang bila server restart/tidur. Untuk selalu aktif, pakai paket berbayar atau VPS.

### Hugging Face Spaces (gratis, tanpa kartu kredit)
Blok `---` di bagian paling atas README ini adalah konfigurasi Space (SDK Docker, port 7860); `Dockerfile` sudah disediakan.
1. Buat Space baru di huggingface.co/new-space: SDK **Docker**, template **Blank**, visibilitas Public.
2. `git remote add space https://huggingface.co/spaces/USERNAME/mahjong-online`
3. `git push space main --force` (login memakai username HF dan **access token** dengan izin Write sebagai password).
4. Setelah build selesai, pakai URL langsung `https://USERNAME-mahjong-online.hf.space`.
Space gratis tertidur bila lama tidak dikunjungi; buka URL-nya untuk membangunkan.

### Alternatif
Railway, Fly.io, Koyeb (mirip Render), atau VPS apa pun: `git clone`, `npm install`, `PORT=80 node server.js`
(disarankan di balik Caddy/Nginx untuk HTTPS, dan jalankan dengan `pm2`/systemd).
Server membaca port dari variabel `PORT` dan klien otomatis memakai `wss://` bila situs di-HTTPS-kan.

## Aturan singkat
- 136 ubin (Wan, Pin, Bambu, Angin, Naga), tanpa bunga. Susun 4 set + 1 pasang, Tujuh Pasang, atau Tiga Belas Yatim.
- Aksi: Pon, Chi (hanya dari pemain sebelum kamu), Kong (terbuka, tertutup, dan tambahan), Ron, Tsumo.
- Skor gaya Hong Kong disederhanakan (faan, poin = 2^faan maks 256). Daftar lengkap ada di tombol **?** dalam game.
- Waktu giliran 45 detik; bila habis atau pemain terputus, bot memainkan gilirannya. Pemain bisa kembali dengan membuka ulang halaman.

## Pengujian
```bash
npm test                 # logika game + 400 simulasi permainan penuh
node test/smoke.js       # (server harus jalan) uji multiplayer via WebSocket
```

## Struktur
- `game.js` – aturan, deteksi menang, skor, bot
- `room.js` – ruangan, kursi, timer, siaran status per pemain (tangan lawan tidak pernah dikirim)
- `server.js` – HTTP statis + WebSocket
- `public/` – tampilan (ubin digambar dengan SVG)

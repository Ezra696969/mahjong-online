'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Room } = require('./room');
const { TILE_RE } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const BUILD = Date.now().toString(36);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/health') { res.writeHead(200); return res.end('ok'); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    // Tempelkan ID build ke URL skrip/css agar CDN/browser tidak mencampur file lama dan baru
    if (path.extname(file) === '.html') data = data.toString().replace(/(src|href)="([\w.-]+\.(?:js|css))"/g, `$1="$2?v=${BUILD}"`);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, maxPayload: 4096 });
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
}
const cleanName = (n) => String(n || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Pemain';
const err = (ws, msg) => ws.send(JSON.stringify({ t: 'error', msg }));

function attach(ws, room, seat, token) {
  ws.ctx = { room, seat };
  ws.send(JSON.stringify({ t: 'joined', code: room.code, token, seat }));
  room.broadcast();
}

function detach(ws, leave) {
  const ctx = ws.ctx;
  ws.ctx = null;
  if (!ctx) return;
  const { room, seat } = ctx;
  const s = room.seats[seat];
  if (!s || s.ws !== ws) return; // sudah digantikan koneksi lain
  if (leave) room.removeSeat(seat);
  else { s.connected = false; s.ws = null; s.lastSeen = Date.now(); }
  room.afterChange();
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.ctx = null;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('close', () => detach(ws, false));
  ws.on('error', () => {});
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    try { handle(ws, m); } catch (e) { console.error('handler error', e); err(ws, 'Terjadi kesalahan di server'); }
  });
});

function handle(ws, m) {
  if (m.t === 'create') {
    if (ws.ctx) return;
    const room = new Room(newCode());
    rooms.set(room.code, room);
    const r = room.addHuman(cleanName(m.name), ws);
    return attach(ws, room, r.seat, r.token);
  }
  if (m.t === 'join') {
    if (ws.ctx) return;
    const room = rooms.get(String(m.code || '').toUpperCase().trim());
    if (!room) return err(ws, 'Ruangan tidak ditemukan');
    const r = room.addHuman(cleanName(m.name), ws);
    if (!r) return err(ws, 'Ruangan penuh');
    return attach(ws, room, r.seat, r.token);
  }
  if (m.t === 'resume') {
    const room = rooms.get(String(m.code || '').toUpperCase());
    const seat = room ? room.seats.findIndex((s) => s && !s.bot && s.token === m.token) : -1;
    if (seat < 0) return ws.send(JSON.stringify({ t: 'left' }));
    const s = room.seats[seat];
    if (s.ws && s.ws !== ws) { s.ws.ctx = null; try { s.ws.close(); } catch {} }
    s.ws = ws; s.connected = true;
    attach(ws, room, seat, s.token);
    return room.afterChange();
  }

  const ctx = ws.ctx;
  if (!ctx) return;
  const { room, seat } = ctx;
  const isHost = room.host === seat;

  switch (m.t) {
    case 'leave': detach(ws, true); return ws.send(JSON.stringify({ t: 'left' }));
    case 'addbot':
      if (!isHost || (room.game && room.game.phase !== 'over')) return;
      room.addBot(); return room.broadcast();
    case 'kick': {
      const i = +m.seat;
      if (!isHost || room.game || !(i >= 0 && i < 4) || i === seat || !room.seats[i]) return;
      const s = room.seats[i];
      if (s.ws) { s.ws.send(JSON.stringify({ t: 'left' })); s.ws.ctx = null; }
      room.seats[i] = null;
      return room.broadcast();
    }
    case 'start': {
      if (!isHost) return err(ws, 'Hanya host yang bisa memulai');
      const e = room.start();
      if (e) err(ws, e);
      return;
    }
    case 'next': {
      const e = room.nextHand();
      if (e) err(ws, e);
      return;
    }
    case 'chat': {
      const text = String(m.text || '').replace(/[<>]/g, '').trim().slice(0, 200);
      if (text) room.chat(seat, text);
      return;
    }
  }

  if (!room.game) return;
  const tile = typeof m.tile === 'string' && TILE_RE.test(m.tile) ? m.tile : null;
  let r;
  switch (m.t) {
    case 'discard': if (tile) r = room.act((g) => g.discard(seat, tile)); break;
    case 'tsumo': r = room.act((g) => g.declareTsumo(seat)); break;
    case 'kong': if (tile) r = room.act((g) => g.declareKong(seat, tile)); break;
    case 'claim': {
      const chi = Array.isArray(m.chi) && m.chi.length === 2 && m.chi.every((t) => typeof t === 'string' && TILE_RE.test(t)) ? m.chi : undefined;
      r = room.act((g) => g.claim(seat, String(m.kind), chi));
      break;
    }
  }
  if (r && r.error) err(ws, r.error);
}

// Keep-alive (penting di balik proxy hosting) + pembersihan ruangan
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    let changed = false;
    for (let i = 0; i < 4; i++) {
      const s = room.seats[i];
      if (!s || s.bot || s.connected) continue;
      const gone = now - s.lastSeen;
      if ((!room.game && gone > 60000) || gone > 600000) { room.removeSeat(i); changed = true; }
    }
    if (room.connectedCount() === 0 && (room.humanCount() === 0 || now - (room.emptySince || (room.emptySince = now)) > 600000)) {
      room.destroy(); rooms.delete(code); continue;
    }
    if (room.connectedCount() > 0) room.emptySince = 0;
    if (changed) room.afterChange();
  }
}, 15000);

server.listen(PORT, () => console.log(`Mahjong online berjalan di http://localhost:${PORT}`));

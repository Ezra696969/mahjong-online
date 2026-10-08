'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, cls, ...kids) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k of kids) if (k != null) e.append(k);
  return e;
}
const WIND = ['東', '南', '西', '北'];
const SEAT_COLOR = ['#e5604d', '#f2c14e', '#5aa9e6', '#a78bfa'];
const FLASH = { pon: 'Pon!', chi: 'Chi!', kong: 'Kong!', tsumo: 'Tsumo!', ron: 'Ron!' };
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- state ----------
let ws = null, room = null, game = null, shownGame = null, you = -1, deadline = null;
let selected = null;            // 'h<i>' | 'drawn'
let order = [];                 // urutan ubin di tanganku (diatur klien)
let absorbed = null;            // {drawId, tile}: ubin ambilan yang sudah diseret masuk ke tangan
let drag = null;                // sedang menyeret
let discardSrc = null;          // {tile, rect}: asal animasi buang
let holds = new Set();          // elemen yang disembunyikan sampai animasinya mendarat
let poolRectBefore = null;
let blockUntil = 0, queued = null, queueTimer = null;
let resultFor = null, chatUnread = 0;
let animOn = !matchMedia('(prefers-reduced-motion: reduce)').matches && lsGet('mjanim') !== 'off';

const store = {
  get() { try { return JSON.parse(sessionStorage.getItem('mj') || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem('mj', JSON.stringify(v)); } catch {} },
  clear() { try { sessionStorage.removeItem('mj'); } catch {} },
};

function send(o) {
  if (ws && ws.readyState === 1) return ws.send(JSON.stringify(o));
  toast('Belum tersambung ke server. Tunggu sebentar lalu coba lagi.');
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ---------- koneksi ----------
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    $('#conn').textContent = 'Menyambung ulang…';
    $('#conn').classList.add('hidden');
    const s = store.get();
    if (s) send({ t: 'resume', code: s.code, token: s.token });
  };
  ws.onclose = () => { $('#conn').classList.remove('hidden'); setTimeout(connect, 1500); };
  ws.onerror = () => { $('#conn').textContent = 'Tidak bisa terhubung ke server game (WebSocket). Mencoba lagi…'; $('#conn').classList.remove('hidden'); };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.t) {
      case 'joined': store.set({ code: m.code, token: m.token }); history.replaceState(null, '', '?room=' + m.code); break;
      case 'state': room = m.room; you = m.you; deadline = m.deadline; incoming(m.game); break;
      case 'left': store.clear(); room = null; shownGame = null; game = null; order = []; history.replaceState(null, '', location.pathname); render(); break;
      case 'error': toast(m.msg); break;
      case 'chat': addChat(m.name, m.text); break;
    }
  };
}

// State masuk; tertunda sementara animasi bagi-ubin berlangsung agar DOM tidak terhapus di tengah animasi.
function incoming(g) {
  const now = Date.now();
  if (g && now < blockUntil) {
    queued = g; clearTimeout(queueTimer);
    queueTimer = setTimeout(() => { const q = queued; queued = null; if (q) apply(q); }, blockUntil - now + 40);
    return;
  }
  queued = null;
  apply(g);
}

const isFresh = (g) => g.phase === 'discard' && g.pool.length === 0 && g.players.every((p) => p.melds.length === 0);

function apply(g) {
  const prev = shownGame;
  const newGid = !!g && (!prev || prev.gid !== g.gid);
  const fresh = !!g && newGid && isFresh(g);
  if (newGid) { holds.clear(); selected = null; absorbed = null; }
  if (g) reconcile(g, newGid, fresh);
  const evs = g && prev && !newGid ? computeEvents(prev, g) : fresh ? [{ t: 'deal' }] : [];
  poolRectBefore = capturePoolRect();
  game = g;
  if (animOn) setHolds(evs, g);
  render();
  shownGame = g;
  if (!g) return;
  const la = g.lastAction;
  if (prev && !newGid && la && (!prev.lastAction || la.id !== prev.lastAction.id) && FLASH[la.kind]) flash(la);
  if (animOn) play(evs, g);
}

// ---------- urutan tangan ----------
function reconcile(g, reset, fresh) {
  const server = g.hand.slice();
  if (absorbed && g.drawn === absorbed.tile && g.draw && g.draw.id === absorbed.drawId) server.push(g.drawn);
  else absorbed = null;
  if (reset) {
    order = fresh ? shuffle(server) : server.slice().sort((a, b) => tileSortKey(a) - tileSortKey(b));
    return;
  }
  const cnt = {};
  server.forEach((t) => { cnt[t] = (cnt[t] || 0) + 1; });
  const next = [];
  for (const t of order) if (cnt[t] > 0) { next.push(t); cnt[t]--; }
  for (const t of server) if (cnt[t] > 0) { next.push(t); cnt[t]--; }
  order = next;
}
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function sortHand() { order.sort((a, b) => tileSortKey(a) - tileSortKey(b)); renderGame(); }
function moveInOrder(from, to) {
  const [t] = order.splice(from, 1);
  order.splice(to > from ? to - 1 : to, 0, t);
  renderGame();
}
function absorbDrawn(to) {
  if (!game.drawn) return;
  order.splice(to, 0, game.drawn);
  absorbed = { drawId: game.draw.id, tile: game.drawn };
  selected = null;
  renderGame();
}

// ---------- event animasi ----------
function computeEvents(prev, g) {
  const evs = [];
  const la = g.lastAction;
  const newAct = la && (!prev.lastAction || la.id !== prev.lastAction.id);
  let delay = 0;
  if (newAct && la.kind === 'discard') { evs.push({ t: 'discard', la, idx: g.pool.length - 1 }); delay = 560; }
  else if (newAct && ['pon', 'chi', 'kong'].includes(la.kind) && g.pool.length < prev.pool.length) {
    evs.push({ t: 'claim', la, mIdx: g.players[la.seat].melds.length - 1 }); delay = 1350;
  }
  if (g.draw && (!prev.draw || g.draw.id !== prev.draw.id) && g.phase === 'discard') evs.push({ t: 'draw', draw: g.draw, delay });
  return evs;
}
const holdDrawn = (g) => 'drawn-' + (g.draw ? g.draw.id : 0);
const holdOpp = (seat, g) => `opp-${seat}-${g && g.draw && g.draw.seat === seat ? g.draw.id : 0}`;
function setHolds(evs, g) {
  for (const e of evs) {
    if (e.t === 'discard') holds.add('pool-' + e.idx);
    else if (e.t === 'claim') holds.add(`meld-${e.la.seat}-${e.mIdx}`);
    else if (e.t === 'draw') holds.add(e.draw.seat === you ? holdDrawn(g) : holdOpp(e.draw.seat, g));
  }
}
function release(id) {
  holds.delete(id);
  $$(`[data-hid="${id}"]`).forEach((x) => { x.style.visibility = ''; });
}
function capturePoolRect() {
  const t = $('.pool .tile:last-child');
  return t ? t.getBoundingClientRect() : null;
}
const wallRect = () => { const w = $('.wall-stack'); return w ? w.getBoundingClientRect() : null; };
function seatRect(seat) {
  const e = seat === you ? $('.hand') : $(`.panel[data-seat="${seat}"] .hidden-hand`);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const w = seat === you ? 46 : 17;
  return { left: r.left + r.width / 2 - w / 2, top: r.top + r.height / 2 - w * 0.65, width: w, height: w * 1.3 };
}

// Terbang: ghost ubin dari rect asal ke rect tujuan (opsional ditahan/pop-up di tengah layar).
function flight({ tile, from, to, hold = 0, big = 2.4, dur = 540, arc = -60, size = 46, rot = 0 }) {
  return new Promise((resolve) => {
    if (!animOn || !from || !to) return resolve();
    const g = makeTile(tile, { cls: 'ghost' });
    g.style.setProperty('--tw', size + 'px');
    const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / size });
    const a = c(from), b = c(to);
    g.style.left = a.x - size / 2 + 'px';
    g.style.top = a.y - (size * 1.3) / 2 + 'px';
    $('#fx').append(g);
    const T = (p, s, r = 0) => `translate(${p.x - a.x}px, ${p.y - a.y}px) scale(${s}) rotate(${r}deg)`;
    let frames, total;
    if (hold > 0) {
      const mid = { x: innerWidth / 2, y: innerHeight / 2 - 20 };
      const t1 = 430, t3 = 480; total = t1 + hold + t3;
      g.classList.add('big');
      frames = [
        { transform: T(a, a.s), offset: 0, easing: 'cubic-bezier(.2,.9,.3,1.25)' },
        { transform: T(mid, big, -5), offset: t1 / total, easing: 'ease-in-out' },
        { transform: T(mid, big, 4), offset: (t1 + hold) / total, easing: 'cubic-bezier(.55,0,.3,1)' },
        { transform: T(b, b.s, rot), offset: 1 },
      ];
    } else {
      total = dur;
      const m = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) + arc };
      frames = [
        { transform: T(a, a.s), offset: 0, easing: 'ease-out' },
        { transform: T(m, Math.max(a.s, b.s) * 1.3, rot / 2), offset: 0.5, easing: 'ease-in' },
        { transform: T(b, b.s, rot), offset: 1 },
      ];
    }
    const done = () => { g.remove(); resolve(); };
    const an = g.animate(frames, { duration: total, fill: 'forwards' });
    an.onfinish = done; an.oncancel = done;
    setTimeout(done, total + 400);
  });
}

function play(evs, g) {
  for (const e of evs) {
    if (e.t === 'deal') playDeal(g);
    else if (e.t === 'discard') playDiscard(e, g);
    else if (e.t === 'claim') playClaim(e, g);
    else if (e.t === 'draw') setTimeout(() => playDraw(e, g), e.delay);
  }
}

function playDeal(g) {
  const zone = $('.center-zone').getBoundingClientRect();
  const cx = zone.left + zone.width / 2, cy = zone.top + zone.height / 2;
  const per = [0, 1, 2, 3].map((s) => (s === you ? $$('.hand .tile') : $$(`.panel[data-seat="${s}"] .hidden-hand .tile`)));
  const list = [];
  for (let r = 0; r < 14; r++) for (let q = 0; q < 4; q++) { const e = per[(g.dealer + q) % 4][r]; if (e) list.push(e); }
  const dr = $('.drawn .tile'); if (dr) list.push(dr);
  list.forEach((e, i) => {
    const r = e.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    e.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.2) rotate(${rnd(-50, 50)}deg)`, opacity: 0 },
      { transform: `translate(${dx * 0.25}px, ${dy * 0.25 - 30}px) scale(1.15) rotate(${rnd(-8, 8)}deg)`, opacity: 1, offset: 0.65 },
      { transform: 'none', opacity: 1 },
    ], { duration: 620, delay: i * 26, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
  });
  blockUntil = Date.now() + list.length * 26 + 700;
}

async function playDiscard(e, g) {
  const id = 'pool-' + e.idx;
  const target = $(`[data-hid="${id}"]`);
  if (!target) return release(id);
  const la = e.la;
  const from = la.seat === you && discardSrc && discardSrc.tile === la.tile ? discardSrc.rect : seatRect(la.seat);
  const rot = parseFloat(getComputedStyle(target).getPropertyValue('--r')) || 0;
  await flight({ tile: la.tile, from, to: target.getBoundingClientRect(), dur: 560, size: 46, rot });
  release(id);
  const t2 = $(`[data-hid="${id}"]`);
  if (t2) t2.classList.add('drop');
}

async function playClaim(e, g) {
  const id = `meld-${e.la.seat}-${e.mIdx}`;
  const meld = $(`[data-hid="${id}"]`);
  const to = meld && meld.firstElementChild ? meld.firstElementChild.getBoundingClientRect() : null;
  await flight({ tile: e.la.tile, from: poolRectBefore, to, hold: 480, big: 2.2, size: 46 });
  release(id);
}

async function playDraw(e, g) {
  if (e.draw.seat === you) {
    const id = holdDrawn(g);
    const to = $(`[data-hid="${id}"]`);
    if (!to) return release(id);
    await flight({ tile: g.drawn, from: wallRect(), to: to.getBoundingClientRect(), hold: 800, big: 2.7, size: 46 });
    release(id);
  } else {
    const id = holdOpp(e.draw.seat, g);
    const to = $(`[data-hid="${id}"]`);
    if (!to) return release(id);
    await flight({ tile: null, from: wallRect(), to: to.getBoundingClientRect(), hold: 300, big: 1.9, size: 46 });
    release(id);
  }
}

function flash(la) {
  const z = $('.center-zone'); if (!z || !room) return;
  const f = h('div', 'flash', `${nameOf(la.seat)}: ${FLASH[la.kind]}`);
  z.append(f);
  setTimeout(() => f.remove(), 1600);
}

// ---------- layar ----------
function show(id) { for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id); }
function render() {
  const inRoom = !!room;
  $('#tbRoom').classList.toggle('hidden', !inRoom);
  $('#btnChat').classList.toggle('hidden', !inRoom);
  $('#btnLeave').classList.toggle('hidden', !inRoom);
  if (!room) { $('#gInfo').textContent = ''; show('home'); $('#overlay').classList.add('hidden'); resultFor = null; $('#chatPanel').classList.add('hidden'); return; }
  $('#gCode').textContent = room.code;
  if (!game) { $('#gInfo').textContent = ''; show('lobby'); renderLobby(); return; }
  show('game'); renderGame();
}

const avatar = (seat, cls = '') => {
  const s = room && room.seats[seat];
  const a = h('div', 'av ' + cls, s ? (s.bot ? '🤖' : s.name.trim().charAt(0).toUpperCase() || '?') : '·');
  a.style.background = SEAT_COLOR[seat];
  return a;
};
const nameOf = (i) => (room && room.seats[i] ? room.seats[i].name : '?');

function renderLobby() {
  $('#lobbyCode').textContent = room.code;
  $('#inviteLink').value = `${location.origin}/?room=${room.code}`;
  const ul = $('#seatList'); ul.innerHTML = '';
  room.seats.forEach((s, i) => {
    const li = h('li', s ? '' : 'empty');
    li.append(avatar(i));
    const nm = h('span', 'nm', s ? s.name : 'Kursi kosong (diisi bot)');
    const tag = h('span', 'tag', s ? [WIND[i], i === room.host ? 'host' : '', i === you ? 'kamu' : '', s.bot ? 'bot' : '', !s.connected ? 'terputus' : ''].filter(Boolean).join(' · ') : WIND[i]);
    li.append(nm, tag);
    if (s && room.host === you && i !== you) {
      const b = h('button', '', 'Keluarkan'); b.onclick = () => send({ t: 'kick', seat: i }); li.append(b);
    }
    ul.append(li);
  });
  const isHost = room.host === you;
  $('#hostBtns').classList.toggle('hidden', !isHost);
  $('#lobbyWait').classList.toggle('hidden', isHost);
  $('#btnAddBot').disabled = room.seats.every(Boolean);
}

function meldEl(m, cls, hid) {
  const d = h('div', 'meld');
  m.tiles.forEach((t, k) => d.append(makeTile(m.concealed && (k === 0 || k === 3) ? null : t, { cls })));
  if (hid) { d.dataset.hid = hid; if (holds.has(hid)) d.style.visibility = 'hidden'; }
  return d;
}

function panelHead(seat, g) {
  const hd = h('div', 'ph');
  const s = room.seats[seat];
  hd.append(avatar(seat, 'sm'), h('span', 'wind', WIND[g.players[seat].wind]), h('span', 'nm', (s ? s.name : '?') + (seat === you ? ' (kamu)' : '')));
  if (seat === g.dealer) { const d = h('span', 'dealer', '庄'); d.title = 'Dealer'; hd.append(d); }
  hd.append(h('span', 'sc', String(g.scores[seat])));
  if (s && !s.bot && !s.connected) hd.append(h('span', 'off', 'terputus'));
  return hd;
}

function renderGame() {
  const g = game;
  $('#gInfo').textContent = `Ronde ${WIND[g.roundWind]} · Sisa ubin ${g.wallLeft}`;
  const table = $('#table'); table.innerHTML = '';
  const waiting = new Set(g.waiting);
  const myTurn = g.phase === 'discard' && g.turn === you;
  const cls = { 2: 'p-top', 3: 'p-left', 1: 'p-right' };

  for (const rel of [2, 3, 1]) {
    const seat = (you + rel) % 4, p = g.players[seat];
    const panel = h('div', `panel ${cls[rel]}` + (g.phase === 'discard' && g.turn === seat ? ' turn' : '') + (waiting.has(seat) ? ' waiting' : ''));
    panel.dataset.seat = seat;
    panel.append(panelHead(seat, g));
    const hh = h('div', 'hidden-hand');
    const n = g.phase === 'over' ? 0 : p.count;
    const oid = holdOpp(seat, g);
    for (let i = 0; i < n; i++) {
      const t = makeTile(null, { cls: 'tiny' });
      if (i === n - 1) { t.dataset.hid = oid; if (holds.has(oid)) t.style.visibility = 'hidden'; }
      hh.append(t);
    }
    panel.append(hh);
    if (p.melds.length) { const ms = h('div', 'melds'); p.melds.forEach((m, i) => ms.append(meldEl(m, 'tiny', `meld-${seat}-${i}`))); panel.append(ms); }
    table.append(panel);
  }

  // tengah meja: tumpukan buangan
  const center = h('div', 'center-zone');
  const hud = h('div', 'hud');
  const wall = h('div', 'wall-stack');
  [[0, 8], [3, 5], [6, 2], [9, -1]].forEach(([x, y]) => { const t = makeTile(null); t.style.left = x + 'px'; t.style.top = y + 'px'; wall.append(t); });
  const info = h('div', ''); info.innerHTML = `Ubin tersisa<b>${g.wallLeft}</b>`;
  hud.append(wall, info);
  center.append(hud);
  const pool = h('div', 'pool');
  const pile = h('div', 'pile');
  pool.append(pile);
  g.pool.forEach((p, i) => {
    const jit = (k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
    const last = !!g.lastDiscard && i === g.pool.length - 1;
    const t = makeTile(p.tile, { cls: 'pool-t' + (last ? ' last' : '') });
    t.style.setProperty('--seat', SEAT_COLOR[p.from]);
    t.style.setProperty('--r', ((jit(1) - 0.5) * 22).toFixed(1) + 'deg');
    t.style.setProperty('--dx', ((jit(2) - 0.5) * 10).toFixed(1) + 'px');
    t.style.setProperty('--dy', ((jit(3) - 0.5) * 10).toFixed(1) + 'px');
    t.dataset.hid = 'pool-' + i;
    if (holds.has('pool-' + i)) t.style.visibility = 'hidden';
    pile.append(t);
  });
  if (myTurn) {
    pool.addEventListener('dragover', (e) => { if (drag) { e.preventDefault(); pool.classList.add('dropok'); } });
    pool.addEventListener('dragleave', () => pool.classList.remove('dropok'));
    pool.addEventListener('drop', (e) => {
      e.preventDefault(); pool.classList.remove('dropok');
      if (drag) { discardSrc = { tile: drag.tile, rect: drag.rect }; send({ t: 'discard', tile: drag.tile }); }
    });
  }
  center.append(pool);
  const chip = h('div', 'turn-chip');
  if (g.phase === 'discard') chip.textContent = myTurn ? 'Giliranmu — buang satu ubin' : `Giliran ${nameOf(g.turn)}`;
  else if (g.phase === 'claim') chip.textContent = `Menunggu klaim: ${g.waiting.map(nameOf).join(', ')}`;
  else chip.textContent = 'Ronde selesai';
  center.append(chip);
  table.append(center);

  // panelku
  const me = h('div', 'panel p-me' + (myTurn ? ' turn' : '') + (waiting.has(you) ? ' waiting' : ''));
  me.dataset.seat = you;
  me.append(panelHead(you, g));
  me.append(buildActions(g));
  const tb = h('div', 'timerbar idle'); const bar = h('i'); tb.append(bar); me.append(tb);
  const mine = myTurn || !!g.claim;
  if (deadline && mine) {
    const remain = Math.max(0, deadline - Date.now());
    tb.classList.remove('idle');
    bar.style.animation = `shrinkbar ${remain}ms linear forwards`;
  }
  const row = h('div', 'myrow');
  const hand = h('div', 'hand');
  const mkHand = (t, i) => handTile(t, i, myTurn);
  order.forEach((t, i) => hand.append(mkHand(t, i)));
  hand.addEventListener('dragover', (e) => { if (drag) e.preventDefault(); });
  hand.addEventListener('drop', (e) => {
    if (!drag || e.target !== hand) return;
    e.preventDefault();
    if (drag.kind === 'hand') moveInOrder(drag.idx, order.length); else absorbDrawn(order.length);
  });
  if (g.drawn && !absorbed) {
    const dw = h('div', 'drawn');
    const dt = drawnTile(g.drawn, myTurn);
    const hid = holdDrawn(g);
    dt.dataset.hid = hid; if (holds.has(hid)) dt.style.visibility = 'hidden';
    dw.append(dt); hand.append(dw);
  }
  row.append(hand);
  const mm = g.players[you].melds;
  if (mm.length) { const ms = h('div', 'melds'); mm.forEach((m, i) => ms.append(meldEl(m, 'small', `meld-${you}-${i}`))); row.append(ms); }
  me.append(row);
  const tools = h('div', 'tools');
  const sb = h('button', '', '↕ Urutkan'); sb.onclick = sortHand;
  tools.append(sb, h('span', '', 'Seret ubin untuk mengatur · klik 2× untuk membuang'));
  me.append(tools);
  table.append(me);

  renderResult(g);
}

function handTile(t, i, myTurn) {
  const el = makeTile(t, { cls: selected === 'h' + i ? 'sel' : '' });
  el.draggable = true;
  el.onclick = () => clickTile(el, 'h' + i, t, myTurn);
  el.addEventListener('dragstart', (e) => {
    drag = { kind: 'hand', idx: i, tile: t, rect: el.getBoundingClientRect() };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t);
    setTimeout(() => el.classList.add('dragging'), 0);
  });
  el.addEventListener('dragend', () => { drag = null; $$('.dropok,.ins-l,.ins-r,.dragging').forEach((x) => x.classList.remove('dropok', 'ins-l', 'ins-r', 'dragging')); });
  el.addEventListener('dragover', (e) => {
    if (!drag) return; e.preventDefault();
    const right = e.offsetX > el.offsetWidth / 2;
    el.classList.toggle('ins-r', right); el.classList.toggle('ins-l', !right);
  });
  el.addEventListener('dragleave', () => el.classList.remove('ins-l', 'ins-r'));
  el.addEventListener('drop', (e) => {
    if (!drag) return; e.preventDefault(); e.stopPropagation();
    const to = i + (e.offsetX > el.offsetWidth / 2 ? 1 : 0);
    if (drag.kind === 'hand') moveInOrder(drag.idx, to); else absorbDrawn(to);
  });
  return el;
}
function drawnTile(t, myTurn) {
  const el = makeTile(t, { cls: selected === 'drawn' ? 'sel' : '' });
  el.draggable = true;
  el.onclick = () => clickTile(el, 'drawn', t, myTurn);
  el.addEventListener('dragstart', (e) => {
    drag = { kind: 'drawn', tile: t, rect: el.getBoundingClientRect() };
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t);
    setTimeout(() => el.classList.add('dragging'), 0);
  });
  el.addEventListener('dragend', () => { drag = null; $$('.dropok,.ins-l,.ins-r,.dragging').forEach((x) => x.classList.remove('dropok', 'ins-l', 'ins-r', 'dragging')); });
  return el;
}
function clickTile(el, key, t, myTurn) {
  if (el.style.visibility === 'hidden') return;
  if (selected === key && myTurn) {
    discardSrc = { tile: t, rect: el.getBoundingClientRect() };
    selected = null;
    send({ t: 'discard', tile: t });
    return;
  }
  selected = key;
  $$('.hand .tile, .drawn .tile').forEach((x) => x.classList.toggle('sel', x === el));
}

function btn(label, cls, fn) { const b = h('button', cls, label); b.onclick = fn; return b; }
function buildActions(g) {
  const bar = h('div', 'actions');
  if (g.claim) {
    const c = g.claim;
    const info = h('div', 'claimtile'); info.append(makeTile(c.tile, { cls: 'small' }), document.createTextNode(`dibuang ${nameOf(c.from)}`));
    bar.append(info);
    if (c.win) bar.append(btn(`Menang! (${c.winInfo.faan} faan)`, 'win', () => send({ t: 'claim', kind: 'win' })));
    if (c.kong) bar.append(btn('Kong', 'kong', () => send({ t: 'claim', kind: 'kong' })));
    if (c.pon) bar.append(btn('Pon', 'pon', () => send({ t: 'claim', kind: 'pon' })));
    for (const pair of c.chi) {
      const nums = [pair[0], pair[1], c.tile].sort((a, b) => a.localeCompare(b)).map((t) => t[1]).join('-');
      bar.append(btn('Chi ' + nums, 'chi', () => send({ t: 'claim', kind: 'chi', chi: pair })));
    }
    bar.append(btn('Lewati', '', () => send({ t: 'claim', kind: 'pass' })));
  } else if (g.actions) {
    if (g.actions.tsumo) bar.append(btn(`Tsumo! (${g.actions.tsumoInfo.faan} faan)`, 'win', () => send({ t: 'tsumo' })));
    for (const t of g.actions.kongs) bar.append(btn('Kong ' + tileName(t), 'kong', () => send({ t: 'kong', tile: t })));
  }
  return bar;
}

// ---------- hasil ----------
function renderResult(g) {
  const ov = $('#overlay');
  if (!g.result) { ov.classList.add('hidden'); resultFor = null; return; }
  ov.classList.remove('hidden');
  if (resultFor === g.gid) return;
  resultFor = g.gid;
  const r = g.result, box = $('#resultBox');
  box.innerHTML = '';
  const win = r.type === 'win';
  const banner = h('div', 'win-banner' + (win ? '' : ' draw'));
  const rule = h('div', 'win-rule'); rule.append(h('i'));
  banner.append(h('div', 'win-label', win ? 'WINNER' : 'DRAW'), rule, h('div', 'win-name', win ? nameOf(r.winner) : 'Ubin habis, tidak ada pemenang'));
  box.append(banner);
  if (r.type === 'win') {
    box.append(h('div', 'sub', r.selfDraw ? 'Menang sendiri (Tsumo)' : `Ron dari ${nameOf(r.from)}`));
    const items = h('div', 'items');
    r.items.forEach((i) => { const d = h('div'); d.append(h('span', '', i.name), h('b', '', String(i.faan))); items.append(d); });
    const tot = h('div'); tot.append(h('b', '', 'Total'), h('b', '', `${r.faan} faan = ${r.pts} poin`)); items.append(tot);
    box.append(items);
  }
  const dl = h('div', 'deltas');
  for (let s = 0; s < 4; s++) {
    const v = r.delta[s];
    const d = h('div');
    d.append(h('div', '', nameOf(s)), h('div', v > 0 ? 'pos' : v < 0 ? 'neg' : '', (v > 0 ? '+' : '') + v), h('div', 'sub', 'Total ' + g.scores[s]));
    dl.append(d);
  }
  box.append(dl);
  const hands = h('div', 'hands');
  for (let s = 0; s < 4; s++) {
    const row = h('div', 'hr' + (r.type === 'win' && r.winner === s ? ' winner' : ''));
    const tiles = h('div', 'tiles'); let marked = false;
    r.hands[s].forEach((t) => {
      const mark = r.type === 'win' && r.winner === s && t === r.tile && !marked; if (mark) marked = true;
      tiles.append(makeTile(t, { cls: 'small' + (mark ? ' win' : '') }));
    });
    row.append(h('div', 'who', nameOf(s)), tiles);
    r.melds[s].forEach((m) => row.append(meldEl(m, 'small')));
    hands.append(row);
  }
  box.append(hands);
  box.append(btn('Ronde berikutnya', 'primary', () => send({ t: 'next' })));
  if (animOn && r.type === 'win' && r.winner === you) confetti();
}
function confetti() {
  const c = $('#confetti'); c.innerHTML = '';
  const colors = ['#f2c14e', '#e5604d', '#5aa9e6', '#7cf0a8', '#a78bfa', '#fff'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('i');
    p.style.left = rnd(0, 100) + '%'; p.style.background = colors[i % colors.length];
    p.style.animationDuration = rnd(2.2, 4.2) + 's'; p.style.animationDelay = rnd(0, 1.2) + 's';
    p.style.transform = `rotate(${rnd(0, 360)}deg)`; p.style.width = rnd(6, 11) + 'px';
    c.append(p);
  }
  setTimeout(() => { c.innerHTML = ''; }, 6500);
}

// ---------- chat ----------
function addChat(name, text) {
  const log = $('#chatLog');
  const d = h('div'); d.append(h('b', '', name + ': '), document.createTextNode(text)); log.append(d); log.scrollTop = log.scrollHeight;
  if ($('#chatPanel').classList.contains('hidden')) { chatUnread++; const bd = $('#chatBadge'); bd.textContent = chatUnread; bd.classList.remove('hidden'); }
}

// ---------- UI umum ----------
function startName() {
  const n = $('#name').value.trim();
  if (!n) { toast('Isi nama dulu'); $('#name').focus(); return null; }
  lsSet('mjname', n);
  return n;
}
$('#name').value = lsGet('mjname') || '';
$('#btnCreate').onclick = () => { const n = startName(); if (n) send({ t: 'create', name: n }); };
$('#btnJoin').onclick = () => {
  const n = startName(); if (!n) return;
  const c = $('#code').value.trim();
  if (c.length !== 4) return toast('Kode ruangan 4 huruf');
  send({ t: 'join', name: n, code: c });
};
$('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
$('#name').addEventListener('keydown', (e) => { if (e.key === 'Enter') ($('#code').value ? $('#btnJoin') : $('#btnCreate')).click(); });
$('#btnCopy').onclick = async () => {
  const v = $('#inviteLink').value;
  try { await navigator.clipboard.writeText(v); } catch { $('#inviteLink').select(); document.execCommand('copy'); }
  toast('Tautan disalin');
};
$('#btnAddBot').onclick = () => send({ t: 'addbot' });
$('#btnStart').onclick = () => send({ t: 'start' });
$('#btnLeave').onclick = () => { if (confirm('Keluar dari ruangan? Kursimu akan diganti bot.')) send({ t: 'leave' }); };
$('#btnLeaveLobby').onclick = () => send({ t: 'leave' });

// Cheatsheet: hanya dibuka/ditutup lewat tombolnya.
$('#btnSheet').onclick = () => {
  const open = !$('#sheet').classList.contains('open');
  $('#sheet').classList.toggle('open', open);
  $('#btnSheet').setAttribute('aria-pressed', String(open));
};
// Help: aturan main.
const setHelp = (on) => { $('#help').classList.toggle('hidden', !on); $('#btnHelp').setAttribute('aria-pressed', String(on)); };
$('#btnHelp').onclick = () => setHelp($('#help').classList.contains('hidden'));
$('#btnHelpClose').onclick = () => setHelp(false);
$('#help').addEventListener('click', (e) => { if (e.target === $('#help')) setHelp(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setHelp(false); });

const syncAnimBtn = () => $('#btnAnim').classList.toggle('off', !animOn);
$('#btnAnim').onclick = () => { animOn = !animOn; lsSet('mjanim', animOn ? 'on' : 'off'); syncAnimBtn(); toast(animOn ? 'Animasi hidup' : 'Animasi mati'); };
syncAnimBtn();

$('#btnChat').onclick = () => {
  const p = $('#chatPanel'); p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) { chatUnread = 0; $('#chatBadge').classList.add('hidden'); $('#chatInput').focus(); }
};
$('#chatForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#chatInput').value.trim(); if (!v) return;
  send({ t: 'chat', text: v }); $('#chatInput').value = '';
};

// dekorasi beranda
$('#logoTile').append(makeTile('d1'));
(function homeBg() {
  const bg = $('#homeBg');
  const pool = ['m1', 'p5', 's9', 'w1', 'd1', 'd2', 'm9', 'p1', 's5', 'w3', 'd3', 'p9'];
  pool.forEach((t, i) => {
    const e = makeTile(t);
    e.style.left = (i * 8.3 + rnd(-2, 2)) + '%';
    e.style.animationDuration = rnd(16, 30) + 's';
    e.style.animationDelay = -rnd(0, 25) + 's';
    bg.append(e);
  });
})();

// keyframes progress timer (dibuat sekali)
const kf = document.createElement('style');
kf.textContent = '@keyframes shrinkbar { from { transform: scaleX(1); } to { transform: scaleX(0); } }';
document.head.append(kf);

// PWA: service worker + tombol Install (Android/Chrome/Edge). iPhone: Bagikan > Add to Home Screen.
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; $('#btnInstall').classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { installEvt = null; $('#btnInstall').classList.add('hidden'); toast('Aplikasi terpasang'); });
$('#btnInstall').onclick = async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice.catch(() => {});
  installEvt = null; $('#btnInstall').classList.add('hidden');
};
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

try { buildSheet(); buildHelp(); } catch (e) { console.error('info.js gagal dimuat', e); }
const qs = new URLSearchParams(location.search).get('room');
if (qs) $('#code').value = qs.toUpperCase().slice(0, 4);

connect();
render();

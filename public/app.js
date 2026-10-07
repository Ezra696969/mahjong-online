'use strict';
const $ = (s) => document.querySelector(s);
const WIND = ['東', '南', '西', '北'];
const FLASH = { pon: 'Pon!', chi: 'Chi!', kong: 'Kong!', tsumo: 'Tsumo! 🎉', ron: 'Ron! 🎉' };

let ws = null, room = null, game = null, you = -1, deadline = null;
let selected = null, lastActionId = 0, chatUnread = 0;

const store = {
  get() { try { return JSON.parse(sessionStorage.getItem('mj') || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem('mj', JSON.stringify(v)); } catch {} },
  clear() { try { sessionStorage.removeItem('mj'); } catch {} },
};
const lastName = () => { try { return localStorage.getItem('mjname') || ''; } catch { return ''; } };

function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), 2800);
}

// ---------- koneksi ----------
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.onopen = () => {
    $('#conn').classList.add('hidden');
    const s = store.get();
    if (s) send({ t: 'resume', code: s.code, token: s.token });
  };
  ws.onclose = () => {
    $('#conn').classList.remove('hidden');
    setTimeout(connect, 1500);
  };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.t) {
      case 'joined': store.set({ code: m.code, token: m.token }); history.replaceState(null, '', '?room=' + m.code); break;
      case 'state':
        room = m.room; game = m.game; you = m.you; deadline = m.deadline;
        render();
        break;
      case 'left': store.clear(); room = game = null; history.replaceState(null, '', location.pathname); render(); break;
      case 'error': toast(m.msg); break;
      case 'chat': addChat(m.name, m.text); break;
    }
  };
}

// ---------- layar ----------
function show(id) {
  for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id);
}
function render() {
  if (!room) { show('home'); $('#overlay').classList.add('hidden'); return; }
  if (!game) { show('lobby'); renderLobby(); return; }
  show('game'); renderGame();
}

function renderLobby() {
  $('#lobbyCode').textContent = room.code;
  $('#inviteLink').value = `${location.origin}/?room=${room.code}`;
  const ul = $('#seatList'); ul.innerHTML = '';
  room.seats.forEach((s, i) => {
    const li = document.createElement('li');
    const w = document.createElement('span'); w.className = 'wind'; w.textContent = WIND[i];
    const nm = document.createElement('span'); nm.className = 'nm';
    const tag = document.createElement('span'); tag.className = 'tag';
    if (s) {
      nm.textContent = s.name;
      tag.textContent = [i === room.host ? 'host' : '', i === you ? 'kamu' : '', s.bot ? 'bot' : '', !s.connected ? 'terputus' : ''].filter(Boolean).join(' · ');
    } else { li.className = 'empty'; nm.textContent = 'Kursi kosong (akan diisi bot)'; }
    li.append(w, nm, tag);
    if (s && room.host === you && i !== you) {
      const b = document.createElement('button'); b.textContent = 'Keluarkan';
      b.onclick = () => send({ t: 'kick', seat: i }); li.append(b);
    }
    ul.append(li);
  });
  const isHost = room.host === you;
  $('#hostBtns').classList.toggle('hidden', !isHost);
  $('#lobbyWait').classList.toggle('hidden', isHost);
  $('#btnAddBot').disabled = room.seats.every(Boolean);
}

const nameOf = (i) => (room.seats[i] ? room.seats[i].name : '?');

function meldEl(m, cls) {
  const d = document.createElement('div'); d.className = 'meld';
  m.tiles.forEach((t, k) => d.append(makeTile(m.concealed && (k === 0 || k === 3) ? null : t, { cls })));
  return d;
}

function playerHeader(seat, g) {
  const h = document.createElement('div'); h.className = 'ph';
  const s = room.seats[seat];
  const w = document.createElement('span'); w.className = 'wind'; w.textContent = WIND[g.players[seat].wind];
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (s ? s.name : '?') + (seat === you ? ' (kamu)' : '');
  const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = g.scores[seat];
  h.append(w, nm);
  if (seat === g.dealer) { const d = document.createElement('span'); d.className = 'dealer'; d.textContent = '庄'; d.title = 'Dealer'; h.append(d); }
  h.append(sc);
  if (s && !s.bot && !s.connected) { const o = document.createElement('span'); o.className = 'off'; o.textContent = 'terputus'; h.append(o); }
  return h;
}

function renderGame() {
  const g = game;
  $('#gCode').textContent = room.code;
  $('#gInfo').textContent = `Ronde ${WIND[g.roundWind]} · Sisa ubin ${g.wallLeft}`;
  const table = $('#table'); table.innerHTML = '';
  const seatAt = (rel) => (you + rel) % 4;
  const cls = { 0: 'p-me', 1: 'p-right', 2: 'p-top', 3: 'p-left' };
  const waiting = new Set(g.waiting);

  // opponent panels
  for (const rel of [2, 3, 1]) {
    const seat = seatAt(rel), p = g.players[seat];
    const panel = document.createElement('div');
    panel.className = `panel ${cls[rel]}` + (g.phase === 'discard' && g.turn === seat ? ' turn' : '') + (waiting.has(seat) ? ' waiting' : '');
    panel.append(playerHeader(seat, g));
    const hh = document.createElement('div'); hh.className = 'hidden-hand';
    const concealedCount = g.phase === 'over' ? 0 : p.count;
    for (let i = 0; i < concealedCount; i++) hh.append(makeTile(null, { cls: 'tiny' }));
    panel.append(hh);
    if (p.melds.length) { const ms = document.createElement('div'); ms.className = 'melds'; p.melds.forEach((m) => ms.append(meldEl(m, 'tiny'))); panel.append(ms); }
    table.append(panel);
  }

  // center: discards
  const center = document.createElement('div'); center.className = 'center-zone';
  const dzone = { 0: 'd-bot', 1: 'd-right', 2: 'd-top', 3: 'd-left' };
  for (const rel of [2, 3, 1, 0]) {
    const seat = seatAt(rel);
    const d = document.createElement('div'); d.className = 'disc ' + dzone[rel];
    g.players[seat].discards.forEach((t, n) => {
      const last = g.lastDiscard && g.lastDiscard.from === seat && g.lastDiscard.n === n;
      d.append(makeTile(t, { cls: 'small' + (last ? ' last' : '') }));
    });
    center.append(d);
  }
  const mid = document.createElement('div'); mid.className = 'mid';
  mid.innerHTML = `<div class="big">${g.wallLeft}</div><div>ubin tersisa</div>`;
  const who = document.createElement('div');
  if (g.phase === 'discard') who.textContent = g.turn === you ? 'Giliran kamu — buang satu ubin' : `Giliran ${nameOf(g.turn)}`;
  else if (g.phase === 'claim') who.textContent = `Menunggu klaim: ${g.waiting.map(nameOf).join(', ')}`;
  mid.append(who);
  center.append(mid);
  table.append(center);

  // flash aksi terakhir
  const la = g.lastAction;
  if (la && la.id !== lastActionId) {
    lastActionId = la.id;
    if (FLASH[la.kind]) {
      const f = document.createElement('div'); f.className = 'flash'; f.textContent = `${nameOf(la.seat)}: ${FLASH[la.kind]}`;
      center.append(f);
    }
  }

  // me
  const me = document.createElement('div');
  me.className = 'panel p-me' + (g.phase === 'discard' && g.turn === you ? ' turn' : '') + (waiting.has(you) ? ' waiting' : '');
  me.append(playerHeader(you, g));
  me.append(buildActions(g));
  const row = document.createElement('div'); row.className = 'myrow';
  const myTurn = g.phase === 'discard' && g.turn === you;
  const hand = document.createElement('div'); hand.className = 'hand';
  const keyOf = (t, i) => `${t}#${i}`;
  g.hand.forEach((t, i) => hand.append(handTile(t, keyOf(t, i), myTurn)));
  if (g.drawn) { const dw = document.createElement('div'); dw.className = 'drawn'; dw.append(handTile(g.drawn, 'drawn', myTurn)); hand.append(dw); }
  row.append(hand);
  const mm = g.players[you].melds;
  if (mm.length) { const ms = document.createElement('div'); ms.className = 'melds'; mm.forEach((m) => ms.append(meldEl(m, 'small'))); row.append(ms); }
  me.append(row);
  table.append(me);

  renderResult(g);
  updateTimer();
}

function handTile(t, key, myTurn) {
  const el = makeTile(t, { cls: selected === key ? 'sel' : '' });
  el.onclick = () => {
    if (selected === key && myTurn) { selected = null; send({ t: 'discard', tile: t }); return; }
    selected = key; renderGame();
  };
  return el;
}

function btn(label, cls, fn) {
  const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; return b;
}
function buildActions(g) {
  const bar = document.createElement('div'); bar.className = 'actions';
  if (g.claim) {
    const c = g.claim;
    const info = document.createElement('div'); info.className = 'claimtile';
    info.append(makeTile(c.tile, { cls: 'small' }), document.createTextNode(`dibuang ${nameOf(c.from)}`));
    bar.append(info);
    if (c.win) bar.append(btn(`Menang! (${c.winInfo.faan} faan)`, 'win', () => send({ t: 'claim', kind: 'win' })));
    if (c.kong) bar.append(btn('Kong', '', () => send({ t: 'claim', kind: 'kong' })));
    if (c.pon) bar.append(btn('Pon', '', () => send({ t: 'claim', kind: 'pon' })));
    for (const pair of c.chi) {
      const tiles = [pair[0], pair[1], c.tile].sort((a, b) => a.localeCompare(b));
      bar.append(btn('Chi ' + tiles.map((t) => t[1]).join('-'), '', () => send({ t: 'claim', kind: 'chi', chi: pair })));
    }
    bar.append(btn('Lewati', '', () => send({ t: 'claim', kind: 'pass' })));
  } else if (g.actions) {
    if (g.actions.tsumo) bar.append(btn(`Tsumo! (${g.actions.tsumoInfo.faan} faan)`, 'win', () => send({ t: 'tsumo' })));
    for (const t of g.actions.kongs) bar.append(btn('Kong ' + tileName(t), '', () => send({ t: 'kong', tile: t })));
  }
  const tm = document.createElement('span'); tm.className = 'timer'; tm.id = 'timer'; bar.append(tm);
  return bar;
}

function updateTimer() {
  const t = $('#timer'); if (!t) return;
  const mine = game && ((game.phase === 'discard' && game.turn === you) || game.claim);
  if (!deadline || !mine) { t.textContent = ''; return; }
  t.textContent = '⏱ ' + Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
setInterval(updateTimer, 500);

// ---------- hasil ----------
function renderResult(g) {
  const ov = $('#overlay');
  if (!g.result) { ov.classList.add('hidden'); return; }
  const r = g.result, box = $('#resultBox');
  box.innerHTML = '';
  const h = document.createElement('h2');
  h.textContent = r.type === 'win' ? `🎉 ${nameOf(r.winner)} menang!` : 'Seri — ubin habis';
  box.append(h);
  if (r.type === 'win') {
    const sub = document.createElement('div'); sub.className = 'sub';
    sub.textContent = r.selfDraw ? 'Menang sendiri (Tsumo)' : `Ron dari ${nameOf(r.from)}`;
    box.append(sub);
    const items = document.createElement('div'); items.className = 'items';
    r.items.forEach((i) => { const d = document.createElement('div'); d.innerHTML = `<span></span><b></b>`; d.children[0].textContent = i.name; d.children[1].textContent = i.faan; items.append(d); });
    const tot = document.createElement('div'); tot.innerHTML = `<span><b>Total</b></span><b></b>`; tot.children[1].textContent = `${r.faan} faan = ${r.pts} poin`;
    items.append(tot); box.append(items);
  }
  const dl = document.createElement('div'); dl.className = 'deltas';
  for (let s = 0; s < 4; s++) {
    const d = document.createElement('div');
    const v = r.delta[s];
    d.innerHTML = `<div></div><div class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}"></div><div class="sub"></div>`;
    d.children[0].textContent = nameOf(s);
    d.children[1].textContent = (v > 0 ? '+' : '') + v;
    d.children[2].textContent = 'Total ' + g.scores[s];
    dl.append(d);
  }
  box.append(dl);
  const hands = document.createElement('div'); hands.className = 'hands';
  for (let s = 0; s < 4; s++) {
    const row = document.createElement('div'); row.className = 'hr' + (r.type === 'win' && r.winner === s ? ' winner' : '');
    const who = document.createElement('div'); who.className = 'who'; who.textContent = nameOf(s);
    const tiles = document.createElement('div'); tiles.className = 'tiles';
    let winMarked = false;
    r.hands[s].forEach((t) => {
      const mark = r.type === 'win' && r.winner === s && t === r.tile && !winMarked;
      if (mark) winMarked = true;
      tiles.append(makeTile(t, { cls: 'small' + (mark ? ' win' : '') }));
    });
    row.append(who, tiles);
    r.melds[s].forEach((m) => row.append(meldEl(m, 'small')));
    hands.append(row);
  }
  box.append(hands);
  const nb = btn('Ronde berikutnya', 'primary', () => send({ t: 'next' }));
  box.append(nb);
  ov.classList.remove('hidden');
}

// ---------- chat ----------
function addChat(name, text) {
  const log = $('#chatLog');
  const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = name + ': ';
  d.append(b, document.createTextNode(text)); log.append(d); log.scrollTop = log.scrollHeight;
  if ($('#chatPanel').classList.contains('hidden')) { chatUnread++; const bd = $('#chatBadge'); bd.textContent = chatUnread; bd.classList.remove('hidden'); }
}

// ---------- event ----------
function startName() {
  const n = $('#name').value.trim();
  if (!n) { toast('Isi nama dulu'); $('#name').focus(); return null; }
  try { localStorage.setItem('mjname', n); } catch {}
  return n;
}
$('#name').value = lastName();
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
  try { await navigator.clipboard.writeText(v); toast('Tautan disalin'); } catch { $('#inviteLink').select(); document.execCommand('copy'); toast('Tautan disalin'); }
};
$('#btnAddBot').onclick = () => send({ t: 'addbot' });
$('#btnStart').onclick = () => send({ t: 'start' });
const leave = () => { if (confirm('Keluar dari ruangan? Kursimu akan diganti bot.')) send({ t: 'leave' }); };
$('#btnLeave').onclick = leave;
$('#btnLeaveLobby').onclick = () => send({ t: 'leave' });
const toggleRules = (on) => $('#rules').classList.toggle('hidden', !on);
$('#btnRules').onclick = $('#btnRules2').onclick = () => toggleRules(true);
$('#btnRulesClose').onclick = () => toggleRules(false);
$('#btnChat').onclick = () => {
  const p = $('#chatPanel'); p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) { chatUnread = 0; $('#chatBadge').classList.add('hidden'); $('#chatInput').focus(); }
};
$('#chatForm').onsubmit = (e) => {
  e.preventDefault();
  const v = $('#chatInput').value.trim(); if (!v) return;
  send({ t: 'chat', text: v }); $('#chatInput').value = '';
};
$('#logoTile').append(makeTile('d1'));
$('#logoTile').className = '';
$('#logoTile').firstChild.classList.add('big');

const qs = new URLSearchParams(location.search).get('room');
if (qs) $('#code').value = qs.toUpperCase().slice(0, 4);

connect();
render();

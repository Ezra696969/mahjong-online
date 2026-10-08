'use strict';
// Logika Mahjong (gaya Hong Kong disederhanakan): 136 ubin, tanpa bunga.
// Server-authoritative: semua aturan divalidasi di sini.

const crypto = require('crypto');

// ---------- Ubin ----------
// Notasi: m1-m9 (Wan), p1-p9 (Pin/lingkaran), s1-s9 (Bambu), w1-w4 (Angin T/S/B/U), d1-d3 (Naga Merah/Hijau/Putih)
function tileIdx(t) {
  const n = +t[1] - 1;
  switch (t[0]) {
    case 'm': return n;
    case 'p': return 9 + n;
    case 's': return 18 + n;
    case 'w': return 27 + n;
    default: return 31 + n;
  }
}
function idxTile(i) {
  if (i < 9) return 'm' + (i + 1);
  if (i < 18) return 'p' + (i - 8);
  if (i < 27) return 's' + (i - 17);
  if (i < 31) return 'w' + (i - 26);
  return 'd' + (i - 30);
}
const TILE_RE = /^([mps][1-9]|w[1-4]|d[1-3])$/;
const sortTiles = (a) => a.sort((x, y) => tileIdx(x) - tileIdx(y));
function countsOf(tiles) {
  const c = new Array(34).fill(0);
  for (const t of tiles) c[tileIdx(t)]++;
  return c;
}
function buildWall() {
  const w = [];
  for (let i = 0; i < 34; i++) for (let k = 0; k < 4; k++) w.push(idxTile(i));
  for (let i = w.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [w[i], w[j]] = [w[j], w[i]];
  }
  return w;
}

// ---------- Deteksi menang ----------
function extractSets(c, i, acc, out) {
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) { out.push(acc.slice()); return; }
  if (c[i] >= 3) {
    c[i] -= 3; acc.push({ type: 'pon', idx: i });
    extractSets(c, i, acc, out);
    acc.pop(); c[i] += 3;
  }
  if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ type: 'chi', idx: i });
    extractSets(c, i, acc, out);
    acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
  }
}
function standardDecomps(c, needSets) {
  const res = [];
  for (let p = 0; p < 34; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    const out = [];
    extractSets(c, 0, [], out);
    c[p] += 2;
    for (const sets of out) if (sets.length === needSets) res.push({ kind: 'std', pair: p, sets });
  }
  return res;
}
const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

// tiles = tile tertutup (termasuk ubin kemenangan); melds = set yang sudah terbuka/kong
function winPatterns(tiles, melds) {
  const need = 4 - melds.length;
  if (tiles.length !== need * 3 + 2) return [];
  const c = countsOf(tiles);
  const out = standardDecomps(c, need);
  if (melds.length === 0) {
    if (c.every((n) => n === 0 || n === 2) && c.filter((n) => n === 2).length === 7) out.push({ kind: 'pairs' });
    if (ORPHANS.every((i) => c[i] >= 1) && ORPHANS.some((i) => c[i] === 2)) out.push({ kind: 'orphans' });
  }
  return out;
}

// ---------- Skor ----------
function scoreWin(patterns, ctx) {
  let best = null;
  const allIdx = ctx.tiles.map(tileIdx);
  for (const m of ctx.melds) for (const t of m.tiles) allIdx.push(tileIdx(t));
  const suits = new Set();
  let hasHonor = false;
  for (const i of allIdx) { if (i < 27) suits.add(Math.floor(i / 9)); else hasHonor = true; }
  const openMelds = ctx.melds.some((m) => m.open);

  for (const p of patterns) {
    const items = [];
    if (p.kind === 'orphans') {
      items.push({ name: 'Tiga Belas Yatim', faan: 13 });
    } else {
      if (suits.size === 0) items.push({ name: 'Semua Honor', faan: 10 });
      else if (suits.size === 1 && !hasHonor) items.push({ name: 'Satu Warna Murni', faan: 6 });
      else if (suits.size === 1) items.push({ name: 'Satu Warna Campur', faan: 3 });

      if (p.kind === 'pairs') {
        items.push({ name: 'Tujuh Pasang', faan: 4 });
      } else {
        const sets = p.sets.slice();
        for (const m of ctx.melds) sets.push({ type: m.type === 'chi' ? 'chi' : 'pon', idx: tileIdx(m.tiles[0]) });
        const isValue = (i) => i >= 31 || i === 27 + ctx.seatWind || i === 27 + ctx.roundWind;
        if (sets.every((s) => s.type === 'chi') && !isValue(p.pair)) items.push({ name: 'Semua Urutan', faan: 1 });
        if (sets.every((s) => s.type === 'pon')) items.push({ name: 'Semua Triplet', faan: 3 });
        let dragonPons = 0;
        for (const s of sets) {
          if (s.type !== 'pon') continue;
          if (s.idx >= 31) { dragonPons++; items.push({ name: 'Triplet Naga', faan: 1 }); }
          if (s.idx === 27 + ctx.seatWind) items.push({ name: 'Triplet Angin Kursi', faan: 1 });
          if (s.idx === 27 + ctx.roundWind) items.push({ name: 'Triplet Angin Ronde', faan: 1 });
        }
        if (dragonPons === 2 && p.pair >= 31) items.push({ name: 'Tiga Naga Kecil', faan: 3 });
        if (dragonPons === 3) items.push({ name: 'Tiga Naga Besar', faan: 6 });
      }
      if (!openMelds) items.push({ name: 'Tangan Tertutup', faan: 1 });
    }
    if (ctx.selfDraw) items.push({ name: 'Menang Sendiri (Tsumo)', faan: 1 });
    if (ctx.kongDraw) items.push({ name: 'Menang dari Ubin Kong', faan: 1 });
    if (ctx.lastTile) items.push({ name: 'Ubin Terakhir', faan: 1 });
    const faan = Math.min(13, items.reduce((a, b) => a + b.faan, 0));
    if (!best || faan > best.faan) best = { faan, items };
  }
  return best;
}
const faanPoints = (f) => Math.min(2 ** f, 256);

// ---------- Game ----------
class Game {
  constructor({ dealer, roundWind, scores }) {
    this.dealer = dealer;
    this.roundWind = roundWind;
    this.scores = scores.slice();
    this.wall = buildWall();
    this.hands = [0, 1, 2, 3].map(() => sortTiles(this.wall.splice(0, 13)));
    this.melds = [[], [], [], []];
    this.discards = [[], [], [], []];
    this.turn = dealer;
    this.phase = 'discard'; // discard | claim | over
    this.pending = null;
    this.lastDiscard = null;
    this.lastDraw = null;
    this.lastAction = null;
    this.actionSeq = 0;
    this.result = null;
    this.gid = crypto.randomBytes(4).toString('hex');
    this.pool = []; // buangan berurutan {tile, from}
    this.drawSeq = 0;
    this.lastDrawInfo = null;
    this._draw(dealer, false);
  }

  get wallLeft() { return Math.max(0, this.wall.length - 14); }
  seatWind(seat) { return (seat - this.dealer + 4) % 4; }
  _note(seat, kind, tile) { this.lastAction = { id: ++this.actionSeq, seat, kind, tile: tile || null }; }

  _draw(seat, fromBack) {
    const t = fromBack ? this.wall.shift() : this.wall.pop();
    this.hands[seat].push(t);
    sortTiles(this.hands[seat]);
    this.lastDraw = { seat, tile: t, kong: !!fromBack };
    this.lastDrawInfo = { id: ++this.drawSeq, seat, kong: !!fromBack };
  }

  _evaluate(seat, winTile) {
    const selfDraw = winTile == null;
    const tiles = selfDraw ? this.hands[seat].slice() : this.hands[seat].concat(winTile);
    const pats = winPatterns(tiles, this.melds[seat]);
    if (!pats.length) return null;
    return scoreWin(pats, {
      tiles, melds: this.melds[seat], selfDraw,
      seatWind: this.seatWind(seat), roundWind: this.roundWind,
      lastTile: this.wallLeft === 0,
      kongDraw: selfDraw && !!(this.lastDraw && this.lastDraw.kong),
    });
  }

  canTsumo(seat) {
    return this.phase === 'discard' && this.turn === seat && !!this.lastDraw && this.lastDraw.seat === seat
      && winPatterns(this.hands[seat], this.melds[seat]).length > 0;
  }

  kongOptions(seat) {
    const out = [];
    const c = countsOf(this.hands[seat]);
    for (let i = 0; i < 34; i++) {
      if (c[i] === 4) out.push(idxTile(i));
      else if (c[i] >= 1 && this.melds[seat].some((m) => m.type === 'pon' && m.tiles[0] === idxTile(i))) out.push(idxTile(i));
    }
    return out;
  }

  // ----- aksi -----
  discard(seat, tile) {
    if (this.phase !== 'discard' || this.turn !== seat) return { error: 'Bukan giliran Anda' };
    const i = this.hands[seat].indexOf(tile);
    if (i < 0) return { error: 'Ubin tidak ada di tangan' };
    this.hands[seat].splice(i, 1);
    this.discards[seat].push(tile);
    this.pool.push({ tile, from: seat });
    this.lastDiscard = { tile, from: seat, n: this.discards[seat].length - 1 };
    this.lastDraw = null;
    this._note(seat, 'discard', tile);
    this._openClaims(seat, tile);
    return { ok: true };
  }

  _openClaims(from, tile) {
    const opts = {};
    for (let k = 1; k <= 3; k++) {
      const s = (from + k) % 4;
      const hand = this.hands[s];
      const o = {};
      const c = hand.filter((t) => t === tile).length;
      const info = this._evaluate(s, tile);
      if (info) { o.win = true; o.winInfo = info; }
      if (c >= 2) o.pon = true;
      if (c >= 3 && this.wallLeft > 0) o.kong = true;
      if (k === 1 && tile[0] !== 'w' && tile[0] !== 'd') {
        const i = tileIdx(tile), r = i % 9, chi = [];
        const has = (x) => hand.includes(idxTile(x));
        if (r >= 2 && has(i - 2) && has(i - 1)) chi.push([idxTile(i - 2), idxTile(i - 1)]);
        if (r >= 1 && r <= 7 && has(i - 1) && has(i + 1)) chi.push([idxTile(i - 1), idxTile(i + 1)]);
        if (r <= 6 && has(i + 1) && has(i + 2)) chi.push([idxTile(i + 1), idxTile(i + 2)]);
        if (chi.length) o.chi = chi;
      }
      if (Object.keys(o).length) opts[s] = o;
    }
    if (!Object.keys(opts).length) { this._nextTurn((from + 1) % 4); return; }
    this.phase = 'claim';
    this.pending = { tile, from, opts, choice: {} };
  }

  pendingSeats() {
    if (this.phase !== 'claim') return [];
    return Object.keys(this.pending.opts).map(Number).filter((s) => !this.pending.choice[s]);
  }

  claim(seat, kind, chi) {
    if (this.phase !== 'claim') return { error: 'Tidak ada klaim saat ini' };
    const o = this.pending.opts[seat];
    if (!o) return { error: 'Anda tidak bisa mengklaim' };
    if (this.pending.choice[seat]) return { error: 'Sudah memilih' };
    if (kind === 'chi') {
      if (!o.chi || !Array.isArray(chi)) return { error: 'Chi tidak valid' };
      const ok = o.chi.find((p) => p[0] === chi[0] && p[1] === chi[1]);
      if (!ok) return { error: 'Chi tidak valid' };
    } else if (kind !== 'pass' && !o[kind]) return { error: 'Klaim tidak valid' };
    if (!['pass', 'win', 'pon', 'kong', 'chi'].includes(kind)) return { error: 'Klaim tidak valid' };
    this.pending.choice[seat] = { kind, chi };
    if (this.pendingSeats().length === 0) this._resolve();
    return { ok: true };
  }

  _resolve() {
    const { from, tile, choice } = this.pending;
    const order = [1, 2, 3].map((k) => (from + k) % 4);
    const pick = (kind) => order.find((s) => choice[s] && choice[s].kind === kind);
    let s;
    if ((s = pick('win')) != null) return this._win(s, from, tile);
    if ((s = pick('kong')) != null) return this._takeKong(s, from, tile);
    if ((s = pick('pon')) != null) return this._takePon(s, from, tile);
    if ((s = pick('chi')) != null) return this._takeChi(s, from, tile, choice[s].chi);
    this._nextTurn((from + 1) % 4);
  }

  _removeFromHand(seat, tile, n) {
    for (let k = 0; k < n; k++) this.hands[seat].splice(this.hands[seat].indexOf(tile), 1);
  }
  _claimed(from) {
    this.discards[from].pop();
    this.pool.pop();
    this.lastDiscard = null;
    this.pending = null;
    this.phase = 'discard';
  }
  _takePon(s, from, tile) {
    this._removeFromHand(s, tile, 2);
    this.melds[s].push({ type: 'pon', tiles: [tile, tile, tile], open: true, from });
    this._claimed(from);
    this.turn = s; this.lastDraw = null;
    this._note(s, 'pon', tile);
  }
  _takeKong(s, from, tile) {
    this._removeFromHand(s, tile, 3);
    this.melds[s].push({ type: 'kong', tiles: [tile, tile, tile, tile], open: true, from });
    this._claimed(from);
    this.turn = s;
    this._note(s, 'kong', tile);
    this._draw(s, true);
  }
  _takeChi(s, from, tile, pair) {
    this._removeFromHand(s, pair[0], 1);
    this._removeFromHand(s, pair[1], 1);
    this.melds[s].push({ type: 'chi', tiles: sortTiles([pair[0], pair[1], tile]), open: true, from });
    this._claimed(from);
    this.turn = s; this.lastDraw = null;
    this._note(s, 'chi', tile);
  }

  declareKong(seat, tile) {
    if (this.phase !== 'discard' || this.turn !== seat) return { error: 'Bukan giliran Anda' };
    if (this.wallLeft <= 0) return { error: 'Ubin habis' };
    if (!this.kongOptions(seat).includes(tile)) return { error: 'Kong tidak valid' };
    const n = this.hands[seat].filter((t) => t === tile).length;
    if (n === 4) {
      this._removeFromHand(seat, tile, 4);
      this.melds[seat].push({ type: 'kong', tiles: [tile, tile, tile, tile], open: false, concealed: true });
    } else {
      const m = this.melds[seat].find((x) => x.type === 'pon' && x.tiles[0] === tile);
      this._removeFromHand(seat, tile, 1);
      m.type = 'kong'; m.tiles = [tile, tile, tile, tile];
    }
    this._note(seat, 'kong', tile);
    this._draw(seat, true);
    return { ok: true };
  }

  declareTsumo(seat) {
    if (!this.canTsumo(seat)) return { error: 'Belum bisa menang' };
    this._win(seat, null, this.lastDraw.tile);
    return { ok: true };
  }

  _nextTurn(seat) {
    this.pending = null;
    if (this.wallLeft <= 0) return this._end({ type: 'draw', delta: [0, 0, 0, 0] });
    this.turn = seat;
    this.phase = 'discard';
    this._draw(seat, false);
  }

  _win(seat, from, tile) {
    const selfDraw = from === null;
    const info = this._evaluate(seat, selfDraw ? null : tile);
    if (!selfDraw) {
      this.hands[seat].push(tile);
      sortTiles(this.hands[seat]);
      this.discards[from].pop();
      this.pool.pop();
      this.lastDiscard = null;
    }
    const pts = faanPoints(info.faan);
    const delta = [0, 0, 0, 0];
    if (selfDraw) {
      for (let s = 0; s < 4; s++) if (s !== seat) { delta[s] = -pts; delta[seat] += pts; }
    } else {
      delta[from] = -2 * pts;
      delta[seat] = 2 * pts;
    }
    this._note(seat, selfDraw ? 'tsumo' : 'ron', tile);
    this._end({ type: 'win', winner: seat, from, tile, selfDraw, faan: info.faan, pts, items: info.items, delta });
  }

  _end(result) {
    this.phase = 'over';
    this.pending = null;
    for (let s = 0; s < 4; s++) this.scores[s] += result.delta[s];
    result.hands = this.hands.map((h) => h.slice());
    result.melds = this.melds.map((m) => m.map((x) => ({ ...x, tiles: x.tiles.slice() })));
    result.dealerStays = result.type === 'draw' || result.winner === this.dealer;
    this.result = result;
  }

  // ----- Bot -----
  _isValueIdx(seat, i) { return i >= 31 || i === 27 + this.seatWind(seat) || i === 27 + this.roundWind; }

  botPickDiscard(seat) {
    const hand = this.hands[seat];
    const c = countsOf(hand);
    const suitCount = [0, 0, 0];
    for (let i = 0; i < 27; i++) suitCount[Math.floor(i / 9)] += c[i];
    let best = hand[0], bestScore = Infinity;
    for (const t of new Set(hand)) {
      const i = tileIdx(t);
      let sc = 0;
      if (c[i] >= 3) sc += 7; else if (c[i] === 2) sc += 4;
      if (i < 27) {
        const r = i % 9;
        for (const d of [-2, -1, 1, 2]) {
          if (r + d < 0 || r + d > 8 || !c[i + d]) continue;
          sc += Math.abs(d) === 1 ? 2 : 1;
        }
        if (r > 0 && r < 8) sc += 0.6;
        sc += suitCount[Math.floor(i / 9)] * 0.25;
      } else if (c[i] === 1) {
        sc += this._isValueIdx(seat, i) ? 1 : -1.5;
      }
      sc += Math.random() * 0.5;
      if (sc < bestScore) { bestScore = sc; best = t; }
    }
    return best;
  }

  // Satu langkah bot untuk seat tertentu. Mengembalikan hasil aksi atau null jika tidak ada yang bisa dilakukan.
  botMove(seat) {
    if (this.phase === 'discard' && this.turn === seat) {
      if (this.canTsumo(seat)) return this.declareTsumo(seat);
      const ks = this.kongOptions(seat);
      if (ks.length && this.wallLeft > 0 && Math.random() < 0.5) {
        const r = this.declareKong(seat, ks[0]);
        if (r.ok) return r;
      }
      return this.discard(seat, this.botPickDiscard(seat));
    }
    if (this.phase === 'claim' && this.pendingSeats().includes(seat)) {
      const o = this.pending.opts[seat];
      const tile = this.pending.tile;
      const value = this._isValueIdx(seat, tileIdx(tile));
      let kind = 'pass', chi;
      if (o.win) kind = 'win';
      else if (o.kong && value) kind = 'kong';
      else if (o.pon && (value || Math.random() < 0.3)) kind = 'pon';
      else if (o.chi && Math.random() < 0.15) { kind = 'chi'; chi = o.chi[0]; }
      return this.claim(seat, kind, chi);
    }
    return null;
  }

  // Dipakai pengujian: jalankan semua keputusan dengan bot sampai selesai.
  autoPlay() {
    let guard = 0;
    while (this.phase !== 'over' && guard++ < 5000) {
      if (this.phase === 'discard') this.botMove(this.turn);
      else for (const s of this.pendingSeats()) this.botMove(s);
    }
    return this.result;
  }

  // ----- Tampilan per pemain -----
  view(seat) {
    const over = this.phase === 'over';
    const drawnTile = this.phase === 'discard' && this.lastDraw && this.lastDraw.seat === seat ? this.lastDraw.tile : null;
    const hand = this.hands[seat].slice();
    if (drawnTile) hand.splice(hand.lastIndexOf(drawnTile), 1);
    const v = {
      gid: this.gid,
      you: seat,
      phase: this.phase,
      turn: this.turn,
      dealer: this.dealer,
      roundWind: this.roundWind,
      wallLeft: this.wallLeft,
      wallTotal: this.wall.length, // ubin di tembok termasuk 14 ubin mati (untuk gambar tembok)
      scores: this.scores,
      players: [0, 1, 2, 3].map((s) => ({
        count: this.hands[s].length,
        melds: this.melds[s].map((m) => ({ type: m.type, tiles: m.tiles, open: !!m.open, concealed: !!m.concealed })),
        discards: this.discards[s],
        wind: this.seatWind(s),
      })),
      hand,
      drawn: drawnTile,
      actions: null,
      claim: null,
      waiting: this.pendingSeats(),
      pool: this.pool,
      draw: this.lastDrawInfo,
      lastDiscard: this.lastDiscard,
      lastAction: this.lastAction,
      result: over ? this.result : null,
    };
    if (this.phase === 'discard' && this.turn === seat) {
      const tsumo = this.canTsumo(seat);
      v.actions = {
        tsumo,
        tsumoInfo: tsumo ? this._evaluate(seat, null) : null,
        kongs: this.wallLeft > 0 ? this.kongOptions(seat) : [],
      };
    }
    if (this.phase === 'claim' && this.pending.opts[seat] && !this.pending.choice[seat]) {
      const o = this.pending.opts[seat];
      v.claim = { tile: this.pending.tile, from: this.pending.from, win: !!o.win, winInfo: o.winInfo || null, pon: !!o.pon, kong: !!o.kong, chi: o.chi || [] };
    }
    return v;
  }
}

module.exports = { Game, winPatterns, scoreWin, faanPoints, tileIdx, idxTile, countsOf, TILE_RE, sortTiles };

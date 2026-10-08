'use strict';
const assert = require('assert');
const { Game, winPatterns, scoreWin } = require('../game');

const T = (s) => s.trim().split(/\s+/);

// --- deteksi menang ---
assert(winPatterns(T('m1 m2 m3 m4 m5 m6 p7 p8 p9 s2 s2 s2 w1 w1'), []).length > 0, '4 set + pasangan');
assert(winPatterns(T('m1 m1 p3 p3 s5 s5 w1 w1 w2 w2 d1 d1 d2 d2'), []).some((p) => p.kind === 'pairs'), 'tujuh pasang');
assert(winPatterns(T('m1 m9 p1 p9 s1 s9 w1 w2 w3 w4 d1 d2 d3 d3'), []).some((p) => p.kind === 'orphans'), '13 yatim');
assert.strictEqual(winPatterns(T('m1 m2 m4 m5 m6 p7 p8 p9 s2 s2 s2 w1 w1 w3'), []).length, 0, 'bukan menang');
const pon = { type: 'pon', tiles: ['d1', 'd1', 'd1'], open: true };
assert(winPatterns(T('m1 m2 m3 p7 p8 p9 s2 s2 s2 w1 w1'), [pon]).length > 0, 'dengan meld');
assert.strictEqual(winPatterns(T('m1 m1 m1 m2 m3'), []).length, 0, 'jumlah ubin salah');

// --- skor ---
const ctx = (tiles, extra = {}) => ({ tiles, melds: [], selfDraw: false, seatWind: 1, roundWind: 0, lastTile: false, kongDraw: false, ...extra });
let t = T('m1 m2 m3 m4 m5 m6 m7 m8 m9 m2 m3 m4 m5 m5');
let s = scoreWin(winPatterns(t, []), ctx(t));
assert.strictEqual(s.faan, 8); // murni 6 + urutan 1 + tertutup 1
assert(s.items.some((i) => i.name === 'Satu Warna Murni'));
assert(s.items.some((i) => i.name === 'Semua Urutan'));
t = T('m1 m1 m1 p2 p2 p2 s3 s3 s3 d1 d1 d1 w1 w1');
s = scoreWin(winPatterns(t, []), ctx(t, { selfDraw: true }));
assert(s.items.some((i) => i.name === 'Semua Triplet'));
assert(s.items.some((i) => i.name === 'Menang Sendiri (Tsumo)'));
assert(s.items.some((i) => i.name === 'Triplet Naga'));

// --- simulasi permainan penuh ---
let wins = 0, draws = 0;
for (let n = 0; n < 400; n++) {
  const g = new Game({ dealer: n % 4, roundWind: 0, scores: [500, 500, 500, 500] });
  const r = g.autoPlay();
  assert(r, 'game harus selesai');
  assert.strictEqual(r.delta.reduce((a, b) => a + b, 0), 0, 'skor harus nol-sum');
  assert.strictEqual(g.scores.reduce((a, b) => a + b, 0), 2000);
  if (r.type === 'win') {
    wins++;
    assert(r.faan >= 0 && r.pts >= 1);
    const full = r.hands[r.winner];
    assert(winPatterns(full, r.melds[r.winner]).length > 0, 'tangan pemenang harus valid');
    assert.strictEqual(full.length + r.melds[r.winner].reduce((a, m) => a + m.tiles.length, 0) - r.melds[r.winner].filter((m) => m.type === 'kong').length, 14);
  } else draws++;
  // jumlah ubin total tetap 136
  const total = g.wall.length + g.hands.flat().length + g.discards.flat().length + g.melds.flat().reduce((a, m) => a + m.tiles.length, 0);
  assert.strictEqual(total, 136, 'total ubin 136');
  assert.strictEqual(g.pool.length, g.discards.flat().length, 'pool konsisten dengan buangan');
  assert(g.drawSeq >= 1 && g.gid.length === 8);
}
console.log(`OK: 400 permainan simulasi (${wins} menang, ${draws} seri)`);

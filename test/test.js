'use strict';
const assert = require('assert');
const { Game, winPatterns, scoreWin, isFlower } = require('../game');
const { Room } = require('../room');

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

// --- skor bunga ---
t = T('m1 m2 m3 m4 m5 m6 m7 m8 m9 p2 p3 p4 s5 s5');
let base = scoreWin(winPatterns(t, []), ctx(t)).faan;
let withF = scoreWin(winPatterns(t, []), ctx(t, { flowers: ['f2', 'n2', 'f1'] }));
assert.strictEqual(withF.faan, base + 2, 'bunga & musim kursi Selatan (seatWind 1)'); // f2 dan n2 = 2 faan, f1 tidak
assert(withF.items.some((i) => i.name === 'Bunga Kursi') && withF.items.some((i) => i.name === 'Musim Kursi'));
assert.strictEqual(scoreWin(winPatterns(t, []), ctx(t, { flowers: ['f1', 'f2', 'f3', 'f4'] })).faan, base + 1 + 2, 'empat bunga + bunga kursi');
assert.strictEqual(scoreWin(winPatterns(t, []), ctx(t, { flowers: ['f1','f2','f3','f4','n1','n2','n3','n4'] })).faan, Math.min(13, base + 2 + 8), 'delapan bunga');

// --- dadu penentu bandar ---
for (let n = 0; n < 200; n++) {
  const r = new Room('TEST'); r.seats[1] = { name: 'A', bot: false, connected: true, token: 'x' }; r.host = 1;
  r.start();
  const [a, b] = r.dice;
  assert(a >= 1 && a <= 6 && b >= 1 && b <= 6);
  assert.strictEqual(r.game.dealer, (1 + a + b - 1) % 4, 'bandar = hitung dari host');
  assert.deepStrictEqual(r.game.view(1).dice, [a, b]);
  r.clearTimers();
  r.game.phase = 'over'; r.game.result = { dealerStays: true }; r.game.scores = [500,500,500,500]; r.nextHand();
  assert.strictEqual(r.game.view(1).dice, null, 'dadu hanya di ronde pertama');
  r.clearTimers();
}

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
  // jumlah ubin total tetap 144
  const total = g.wall.length + g.hands.flat().length + g.discards.flat().length + g.flowers.flat().length + g.melds.flat().reduce((a, m) => a + m.tiles.length, 0);
  assert(g.hands.flat().every((t) => !isFlower(t)), 'bunga tidak boleh di tangan');
  assert.strictEqual(total, 144, 'total ubin 144');
  assert.strictEqual(g.pool.length, g.discards.flat().length, 'pool konsisten dengan buangan');
  assert(g.drawSeq >= 1 && g.gid.length === 8);
}
let flowerGames = 0;
for (let n = 0; n < 100; n++) { const g = new Game({ dealer: n % 4, roundWind: 0, scores: [500, 500, 500, 500] }); if (g.flowers.flat().length) flowerGames++; g.hands.forEach((h, i) => assert.strictEqual(h.length, i === g.dealer ? 14 : 13, 'jumlah ubin tangan awal')); }
assert(flowerGames > 50, 'sebagian besar ronde memiliki bunga');
// --- tombol siap ---
function mkRoom(n) {
  const r = new Room('RDY'); r.readyGraceMs = 120;
  for (let i = 0; i < n; i++) r.seats[i] = { name: 'H' + i, bot: false, connected: true, token: 't' + i, lastSeen: Date.now() };
  r.host = 0; r.start(); r.clearTimers();
  r.game.phase = 'over'; r.game.result = { dealerStays: true }; r.game.scores = [500, 500, 500, 500];
  return r;
}
{
  const r = mkRoom(2); const g1 = r.game.gid;
  r.setReady(0); assert.strictEqual(r.game.gid, g1, 'belum mulai: pemain 1 belum siap');
  assert.deepStrictEqual([...r.ready], [0]); assert(r.readyAt > Date.now() - 5);
  r.setReady(0); assert.strictEqual(r.game.gid, g1, 'menekan dua kali tidak menghitung dua');
  r.setReady(1); assert.notStrictEqual(r.game.gid, g1, 'semua siap -> ronde baru'); assert.strictEqual(r.ready.size, 0);
  r.clearTimers(); clearTimeout(r.readyTimer);
  const r2 = mkRoom(2); const g2 = r2.game.gid;
  r2.seats[1].connected = false; r2.setReady(0);
  assert.notStrictEqual(r2.game.gid, g2, 'pemain terputus tidak menahan ronde'); r2.clearTimers(); clearTimeout(r2.readyTimer);
  const r3 = mkRoom(2); r3.setReady(0); // r3 menunggu pemain 1 sampai masa tenggang habis
  const g3 = r3.game.gid;
  assert.strictEqual(r3.setReady(0), null);
  assert.notStrictEqual(typeof r3.setReady(9), 'undefined');
  setTimeout(() => { assert.notStrictEqual(r3.game.gid, g3, 'masa tenggang habis -> ronde baru'); r3.clearTimers(); clearTimeout(r3.readyTimer); console.log('OK: tombol siap'); }, 250);
}

console.log(`OK: 400 permainan simulasi (${wins} menang, ${draws} seri)`);

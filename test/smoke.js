// Uji integrasi: 2 pemain manusia + 2 bot melalui WebSocket (server harus jalan di PORT)
const WebSocket = require('ws');
const URL = `ws://localhost:${process.env.PORT || 3000}`;
const mk = () => new Promise((res) => { const ws = new WebSocket(URL); ws.msgs = []; ws.on('message', (d) => { const m = JSON.parse(d); ws.last = m.t === 'state' ? m : ws.last; ws.msgs.push(m); }); ws.on('open', () => res(ws)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const send = (ws, o) => ws.send(JSON.stringify(o));
(async () => {
  const a = await mk(), b = await mk();
  send(a, { t: 'create', name: 'Ani' });
  await sleep(200);
  const code = a.msgs.find((m) => m.t === 'joined').code;
  send(b, { t: 'join', name: 'Budi', code });
  await sleep(200);
  console.log('lobi:', b.last.room.seats.map((s) => s && s.name));
  send(b, { t: 'start' }); await sleep(200);
  console.log('non-host start ditolak:', b.msgs.some((m) => m.t === 'error'));
  send(a, { t: 'start' }); await sleep(300);
  const ga = a.last.game, gb = b.last.game;
  console.log('tangan A', ga.hand.length + (ga.drawn ? 1 : 0), 'tangan B', gb.hand.length, 'B tak melihat tangan A:', !('hand' in { ...gb.players[0] }));
  // mainkan 40 detik: kedua manusia selalu membuang / pass
  let acts = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 25000) {
    for (const [ws, seat] of [[a, 0], [b, 1]]) {
      const g = ws.last.game; if (!g || g.phase === 'over') continue;
      if (g.claim) { send(ws, { t: 'claim', kind: g.claim.win ? 'win' : 'pass' }); acts++; }
      else if (g.phase === 'discard' && g.turn === seat) { if (g.actions.tsumo) send(ws, { t: 'tsumo' }); else send(ws, { t: 'discard', tile: g.drawn || g.hand[0] }); acts++; }
    }
    if (a.last.game.phase === 'over') break;
    await sleep(120);
  }
  const g = a.last.game;
  console.log('phase akhir:', g.phase, 'aksi manusia:', acts, g.result ? g.result.type : '');
  console.log('error diterima:', [...a.msgs, ...b.msgs].filter((m) => m.t === 'error').map((m) => m.msg));
  if (g.phase === 'over') { send(a, { t: 'next' }); await sleep(300); console.log('hand berikut dimulai, dealer', a.last.game.dealer, 'phase', a.last.game.phase); }
  // reconnect
  const token = a.msgs.find((m) => m.t === 'joined').token;
  a.terminate(); await sleep(300);
  const a2 = await mk(); send(a2, { t: 'resume', code, token }); await sleep(300);
  console.log('resume berhasil:', a2.msgs.some((m) => m.t === 'joined') && !!a2.last);
  process.exit(0);
})();

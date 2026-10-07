'use strict';
const crypto = require('crypto');
const { Game } = require('./game');

const BOT_NAMES = ['Bot Budi', 'Bot Sari', 'Bot Dewi', 'Bot Agus', 'Bot Rina', 'Bot Joko'];
const HUMAN_TURN_MS = 45000;
const HUMAN_CLAIM_MS = 20000;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a));

class Room {
  constructor(code) {
    this.code = code;
    this.seats = [null, null, null, null]; // {name, bot, token, ws, connected, lastSeen}
    this.host = -1;
    this.game = null;
    this.scores = [500, 500, 500, 500];
    this.dealer = 0;
    this.rotations = 0;
    this.timers = [];
    this.deadline = null;
    this.handsPlayed = 0;
  }

  // ----- kursi -----
  humanCount() { return this.seats.filter((s) => s && !s.bot).length; }
  connectedCount() { return this.seats.filter((s) => s && !s.bot && s.connected).length; }
  isAuto(i) { const s = this.seats[i]; return !s || s.bot || !s.connected; }

  addHuman(name, ws) {
    let i = this.seats.findIndex((s) => !s);
    if (i < 0 && this.game) i = this.seats.findIndex((s) => s && s.bot); // ambil alih kursi bot saat game berjalan
    if (i < 0) return null;
    const token = crypto.randomBytes(12).toString('hex');
    this.seats[i] = { name, bot: false, token, ws, connected: true, lastSeen: Date.now() };
    if (this.host < 0) this.host = i;
    return { seat: i, token };
  }

  addBot() {
    const i = this.seats.findIndex((s) => !s);
    if (i < 0) return false;
    const used = new Set(this.seats.filter(Boolean).map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot';
    this.seats[i] = { name, bot: true, connected: true };
    return true;
  }

  // Pemain keluar. Saat game berjalan kursi diganti bot.
  removeSeat(i) {
    const s = this.seats[i];
    if (!s) return;
    this.seats[i] = this.game ? { name: s.name.replace(/ \(bot\)$/, '') + ' (bot)', bot: true, connected: true } : null;
    if (this.host === i) this.host = this.seats.findIndex((x) => x && !x.bot);
    if (this.humanCount() === 0) this.host = -1;
  }

  // ----- permainan -----
  start() {
    if (this.game && this.game.phase !== 'over') return 'Game sudah berjalan';
    for (let i = 0; i < 4; i++) if (!this.seats[i]) this.addBot();
    this.newHand();
    return null;
  }

  newHand() {
    this.game = new Game({ dealer: this.dealer, roundWind: Math.floor(this.rotations / 4) % 4, scores: this.scores });
    this.handsPlayed++;
    this.afterChange();
  }

  nextHand() {
    const g = this.game;
    if (!g || g.phase !== 'over') return 'Belum selesai';
    this.scores = g.scores.slice();
    if (!g.result.dealerStays) { this.dealer = (this.dealer + 1) % 4; this.rotations++; }
    this.newHand();
    return null;
  }

  // Jalankan aksi game, lalu siarkan & jadwalkan ulang
  act(fn) {
    const r = fn(this.game);
    this.afterChange();
    return r;
  }

  afterChange() {
    this.broadcast();
    this.schedule();
  }

  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }
  after(ms, fn) { this.timers.push(setTimeout(fn, ms)); }

  schedule() {
    this.clearTimers();
    this.deadline = null;
    const g = this.game;
    if (!g || g.phase === 'over') return;
    if (g.phase === 'discard') {
      const s = g.turn;
      if (this.isAuto(s)) this.after(rand(700, 1300), () => this.act((gm) => gm.botMove(s)));
      else {
        this.deadline = Date.now() + HUMAN_TURN_MS;
        this.after(HUMAN_TURN_MS, () => this.act((gm) => gm.botMove(s)));
      }
    } else if (g.phase === 'claim') {
      const waiting = g.pendingSeats();
      const humans = waiting.filter((s) => !this.isAuto(s));
      for (const s of waiting.filter((x) => this.isAuto(x))) this.after(rand(500, 1100), () => this.act((gm) => gm.botMove(s)));
      if (humans.length) {
        this.deadline = Date.now() + HUMAN_CLAIM_MS;
        this.after(HUMAN_CLAIM_MS, () => this.act((gm) => { for (const s of humans) gm.claim(s, 'pass'); }));
      }
    }
  }

  // ----- tampilan -----
  roomView() {
    return {
      code: this.code,
      host: this.host,
      started: !!this.game,
      handsPlayed: this.handsPlayed,
      seats: this.seats.map((s) => (s ? { name: s.name, bot: !!s.bot, connected: !!s.connected } : null)),
    };
  }

  send(i, msg) {
    const s = this.seats[i];
    if (s && s.ws && s.ws.readyState === 1) s.ws.send(JSON.stringify(msg));
  }

  broadcast() {
    const room = this.roomView();
    for (let i = 0; i < 4; i++) {
      const s = this.seats[i];
      if (!s || s.bot) continue;
      this.send(i, {
        t: 'state', you: i, room,
        game: this.game ? this.game.view(i) : null,
        deadline: this.deadline,
        scores: this.game ? null : this.scores,
      });
    }
  }

  chat(from, text) {
    const name = this.seats[from] ? this.seats[from].name : '?';
    for (let i = 0; i < 4; i++) if (this.seats[i] && !this.seats[i].bot) this.send(i, { t: 'chat', from, name, text });
  }

  destroy() { this.clearTimers(); }
}

module.exports = { Room };

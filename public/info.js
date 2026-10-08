// Isi Cheatsheet (hanya info ubin) dan Help (aturan: Starting & Play).
function tilesRow(list, cls = 'small') {
  const d = document.createElement('div');
  d.className = 'tiles-row';
  list.forEach((t) => d.append(makeTile(t, { cls })));
  return d;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function buildSheet() {
  const body = document.getElementById('sheetBody');
  body.innerHTML = '';
  body.append(el('h3', '', 'Cheatsheet ubin'));
  body.append(el('p', 'sub', '136 ubin = 34 jenis × 4. Tekan tombol Cheatsheet lagi untuk menutup.'));

  const grid = el('div', 'sheet-grid');
  const head = el('div', 'sg-row sg-head');
  head.append(el('div', 'sg-label', ''));
  for (let n = 1; n <= 9; n++) head.append(el('div', 'sg-n', String(n)));
  grid.append(head);
  const rows = [
    ['Koin', 'Pin / Lingkaran', 'p'],
    ['Bambu', 'Sou', 's'],
    ['Karakter', 'Wan / Angka', 'm'],
  ];
  for (const [name, sub, suit] of rows) {
    const r = el('div', 'sg-row');
    const lab = el('div', 'sg-label');
    lab.append(el('b', '', name), el('span', '', sub));
    r.append(lab);
    for (let n = 1; n <= 9; n++) r.append(makeTile(suit + n, { cls: 'small' }));
    grid.append(r);
  }
  body.append(grid);

  const honor = el('div', 'sheet-honor');
  honor.append(el('div', 'sh-title', 'Honor'));
  const dr = el('div', 'sh-block');
  dr.append(el('div', 'sh-sub', 'Naga'));
  dr.append(tilesRow(['d1', 'd2', 'd3']));
  dr.append(el('div', 'sh-cap', 'Merah 中 · Hijau 發 · Putih 白'));
  const wd = el('div', 'sh-block');
  wd.append(el('div', 'sh-sub', 'Angin'));
  wd.append(tilesRow(['w1', 'w2', 'w3', 'w4']));
  wd.append(el('div', 'sh-cap', 'Timur 東 · Selatan 南 · Barat 西 · Utara 北'));
  honor.append(dr, wd);
  body.append(honor);

  body.append(el('p', 'sub note', 'Ubin Bunga & Musim (ada di gambar referensi) tidak dipakai di versi ini.'));
}

function buildHelp() {
  const b = document.getElementById('helpBody');
  b.innerHTML = '';
  b.append(el('h2', '', 'Help — Cara bermain'));

  const sec = (title, items, ordered = true) => {
    b.append(el('h3', '', title));
    const l = el(ordered ? 'ol' : 'ul', 'helplist');
    items.forEach((it) => { const li = document.createElement('li'); li.innerHTML = it; l.append(li); });
    b.append(l);
  };

  sec('Starting (disiapkan otomatis oleh game)', [
    'Ubin dikocok lalu disusun menjadi tembok persegi (17 ubin panjang, 2 tingkat).',
    'Dadu menentukan dealer (<b>Timur</b>). Di game ini host memulai sebagai Timur, lalu dealer bergilir.',
    'Dadu juga menentukan dari mana tembok dibuka — game mengocok dan membagi sendiri.',
    'Timur mengambil 4 ubin, lalu pemain berikutnya bergantian 4 ubin, sampai tiap pemain punya 12.',
    'Tiap pemain mengambil 1 ubin lagi sehingga memegang <b>13 ubin</b>. Dealer langsung mengambil ubin ke-14 dan memulai.',
  ]);

  sec('Play', [
    'Selama masih ada ubin di tembok, <b>ambil 1 ubin lalu buang 1 ubin</b>. (14 ubin terakhir tidak diambil; bila sisa 0 ronde seri.)',
    'Ubin yang dibuang boleh diklaim siapa pun untuk <b>Mahjong (menang)</b>, <b>Pong</b>, atau <b>Kong</b>, atau oleh pemain di sebelah kanan pembuang (yang bermain sesudahnya) untuk <b>Chow</b>. Pong, Kong, dan Chow dari klaim ditaruh terbuka menghadap atas.',
    'Bila kamu mengambil ubin ke-4 yang sama: jika kamu punya Pong terbuka kamu boleh menambahnya jadi <b>Kong</b>. Jika keempatnya ada di tanganmu, kamu boleh mendeklarasi <b>Kong tertutup</b> (2 terbuka, 2 tertutup). Setiap Kong, ambil ubin pengganti dari ujung belakang tembok.',
    'Ronde berakhir saat ada yang <b>Mahjong</b> (4 set + 1 pasang), atau bila ubin tidak bisa diambil lagi.',
    'Skor dihitung otomatis. Dealer berpindah ke kanan bila dealer tidak menang; bila dealer menang atau ronde seri, dealer tetap.',
  ]);

  b.append(el('h3', '', 'Prioritas klaim'));
  const pr = el('div', 'prio');
  pr.innerHTML = '<b>Mahjong</b> <span>›</span> <b>Kong / Pong</b> <span>›</span> <b>Chow</b>';
  b.append(pr);
  b.append(el('p', 'sub', 'Bila dua orang sama-sama menang, yang duduk paling dekat setelah pembuang yang dihitung.'));

  b.append(el('h3', '', 'Istilah'));
  const terms = el('div', 'terms');
  const t1 = el('div', 'term');
  t1.append(tilesRow(['p3', 'p4', 'p5'], 'small'), el('b', '', 'Chow / Chi'), el('span', '', '3 angka berurutan satu jenis. Hanya dari buangan pemain sebelummu.'));
  const t2 = el('div', 'term');
  t2.append(tilesRow(['m5', 'm5', 'm5'], 'small'), el('b', '', 'Pong / Pon'), el('span', '', '3 ubin persis sama. Boleh dari buangan siapa pun.'));
  const t3 = el('div', 'term');
  t3.append(tilesRow(['s7', 's7', 's7', 's7'], 'small'), el('b', '', 'Kong'), el('span', '', '4 ubin persis sama; ambil 1 ubin pengganti.'));
  terms.append(t1, t2, t3);
  b.append(terms);

  sec('Mengontrol game', [
    'Klik ubin sekali untuk memilih, klik lagi untuk membuang. Atau <b>seret</b> ubin ke tumpukan di tengah meja.',
    'Ubin tidak diurutkan otomatis. Klik <b>Urutkan</b> atau <b>seret ubin</b> untuk mengatur sendiri (ubin yang baru diambil bisa diseret ke tanganmu).',
    'Warna sisi bawah ubin di tumpukan tengah = pemain yang membuangnya (sama dengan warna avatar).',
    'Waktu giliran 45 detik; bila habis, bot memainkan giliranmu.',
  ], false);

  b.append(el('h3', '', 'Skor (faan)'));
  const tb = document.createElement('table');
  tb.className = 'faan';
  [
    ['Tangan tertutup (tanpa Pon/Chi terbuka)', '1'],
    ['Menang sendiri (Tsumo)', '1'],
    ['Semua Urutan', '1'],
    ['Triplet Naga / Angin Kursi / Angin Ronde (per set)', '1'],
    ['Semua Triplet · Satu Warna Campur · Tiga Naga Kecil', '3'],
    ['Tujuh Pasang', '4'],
    ['Satu Warna Murni · Tiga Naga Besar', '6'],
    ['Semua Honor', '10'],
    ['Tiga Belas Yatim', '13'],
    ['Ubin kong / ubin terakhir', '+1'],
  ].forEach(([a, c]) => {
    const tr = document.createElement('tr');
    tr.append(el('td', '', a), el('td', '', c));
    tb.append(tr);
  });
  b.append(tb);
  b.append(el('p', 'sub', 'Poin = 2^faan (maks. 256). Tsumo: tiap lawan membayar penuh. Ron: pembuang membayar 2×. Semua mulai dengan 500 poin.'));
}

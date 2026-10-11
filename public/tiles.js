// Menggambar ubin Mahjong sebagai SVG (tanpa gambar eksternal).
const TILE_FONT = "'Noto Sans CJK SC','Microsoft YaHei','PingFang SC','SimHei','Heiti SC',sans-serif";
const C_BLUE = '#1c5aa6', C_RED = '#c0392b', C_GREEN = '#1f8a4c', C_DARK = '#16232b';
const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const PIN_LAYOUT = {
  2: [[30, 21], [30, 57]],
  3: [[15, 15], [30, 39], [45, 63]],
  4: [[18, 22], [42, 22], [18, 56], [42, 56]],
  5: [[18, 22], [42, 22], [30, 39], [18, 56], [42, 56]],
  6: [[18, 17], [42, 17], [18, 39], [42, 39], [18, 61], [42, 61]],
  7: [[15, 13], [30, 21], [45, 29], [18, 50], [42, 50], [18, 66], [42, 66]],
  8: [[18, 13], [42, 13], [18, 31], [42, 31], [18, 49], [42, 49], [18, 67], [42, 67]],
  9: [[14, 15], [30, 15], [46, 15], [14, 39], [30, 39], [46, 39], [14, 63], [30, 63], [46, 63]],
};
const PIN_R = { 2: 11, 3: 9, 4: 10, 5: 9, 6: 9, 7: 7, 8: 7.5, 9: 8 };
function pinColor(n, k) {
  if (n === 5 && k === 2) return C_RED;
  if (n === 7 && k < 3) return C_GREEN;
  if (n === 9 && k >= 3 && k < 6) return C_RED;
  if (n === 6 && k % 2 === 1) return C_GREEN;
  if (n === 8 && k % 2 === 1) return C_GREEN;
  return C_BLUE;
}
function pinDot(x, y, r, col) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${col}" stroke-width="2.6"/>` +
    `<circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${col}"/>`;
}

const STICK_LAYOUT = {
  2: { h: 26, p: [[30, 20], [30, 58]] },
  3: { h: 26, p: [[30, 19], [20, 57], [40, 57]] },
  4: { h: 26, p: [[20, 20], [40, 20], [20, 58], [40, 58]] },
  5: { h: 26, p: [[20, 20], [40, 20], [30, 39], [20, 58], [40, 58]] },
  6: { h: 26, p: [[14, 20], [30, 20], [46, 20], [14, 58], [30, 58], [46, 58]] },
  7: { h: 22, p: [[30, 14], [14, 42], [30, 42], [46, 42], [14, 66], [30, 66], [46, 66]] },
  8: { h: 28, p: [[12, 22], [24, 22], [36, 22], [48, 22], [12, 56], [24, 56], [36, 56], [48, 56]] },
  9: { h: 22, p: [[14, 14], [30, 14], [46, 14], [14, 39], [30, 39], [46, 39], [14, 64], [30, 64], [46, 64]] },
};
function stick(x, y, h, col) {
  const w = 7;
  return `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="${col}" stroke="#0e4a29" stroke-width="0.8"/>` +
    `<line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y - h / 6}" y2="${y - h / 6}" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>` +
    `<line x1="${x - w / 2}" x2="${x + w / 2}" y1="${y + h / 6}" y2="${y + h / 6}" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>`;
}

// Bunga (f1-f4: Plum, Anggrek, Krisan, Bambu) dan Musim (n1-n4: Semi, Panas, Gugur, Dingin)
const FLOWER_COL = ['#e0527f', '#9b5fd0', '#f0a021', '#2f9a55'];
function petals(cx, cy, r, col, n, rot) {
  let out = '';
  for (let k = 0; k < n; k++) {
    const a = rot + (360 / n) * k;
    out += `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.62}" ry="${r}" fill="${col}" stroke="#0000002a" stroke-width="0.8" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  return out;
}
function flowerArt(n) {
  let art;
  if (n === 4) { // bambu
    art = '<rect x="28" y="10" width="5" height="46" rx="2" fill="#2f9a55" stroke="#0e4a29" stroke-width="0.8"/>' +
      '<line x1="28" x2="33" y1="26" y2="26" stroke="#fff" stroke-width="1.4"/><line x1="28" x2="33" y1="40" y2="40" stroke="#fff" stroke-width="1.4"/>' +
      '<path d="M33 22 Q46 14 50 20 Q42 26 33 22Z" fill="#3fb86c"/><path d="M28 36 Q16 28 11 34 Q20 40 28 36Z" fill="#3fb86c"/>';
  } else {
    art = petals(30, 30, n === 3 ? 12 : 11, FLOWER_COL[n - 1], n === 3 ? 10 : 5, n === 2 ? 36 : 0) +
      '<circle cx="30" cy="30" r="6" fill="#ffd84a" stroke="#a8760a" stroke-width="1"/>';
  }
  return art + `<text x="30" y="71" text-anchor="middle" font-size="15" font-weight="800" fill="#c0392b" font-family="${TILE_FONT}">${n}</text>`;
}
function seasonArt(n) {
  let art;
  if (n === 1) {
    art = '<path d="M30 52 L30 30" stroke="#2f9a55" stroke-width="3"/>' +
      '<path d="M30 34 Q14 30 12 14 Q28 14 30 34Z" fill="#5cc77a" stroke="#0e4a29" stroke-width="0.8"/>' +
      '<path d="M30 40 Q46 36 48 20 Q32 20 30 40Z" fill="#3fb86c" stroke="#0e4a29" stroke-width="0.8"/>';
  } else if (n === 2) {
    art = '<circle cx="30" cy="32" r="11" fill="#ff9d2e" stroke="#b85c00" stroke-width="1.2"/>';
    for (let a = 0; a < 360; a += 45) art += `<line x1="30" y1="14" x2="30" y2="8" stroke="#ff9d2e" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 30 32)"/>`;
  } else if (n === 3) {
    art = '<path d="M30 52 Q10 40 16 18 Q24 22 30 10 Q36 22 44 18 Q50 40 30 52Z" fill="#e07a1f" stroke="#7a3d00" stroke-width="1"/>' +
      '<path d="M30 52 L30 22" stroke="#7a3d00" stroke-width="1.4"/>';
  } else {
    art = '';
    for (const a of [0, 60, 120]) art += `<g transform="rotate(${a} 30 32)"><line x1="30" y1="12" x2="30" y2="52" stroke="#4aa3e8" stroke-width="3" stroke-linecap="round"/><path d="M25 17 L30 22 L35 17 M25 47 L30 42 L35 47" stroke="#4aa3e8" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  }
  return art + `<text x="30" y="71" text-anchor="middle" font-size="15" font-weight="800" fill="#1f7a45" font-family="${TILE_FONT}">${n}</text>`;
}

const _svgCache = {};
function tileSVG(t) {
  if (_svgCache[t]) return _svgCache[t];
  const suit = t[0], n = +t[1];
  let body = '';
  if (suit === 'm') {
    body = `<text x="30" y="35" text-anchor="middle" font-size="32" font-weight="700" fill="${C_DARK}" font-family="${TILE_FONT}">${NUM_CN[n - 1]}</text>` +
      `<text x="30" y="68" text-anchor="middle" font-size="28" font-weight="700" fill="${C_RED}" font-family="${TILE_FONT}">萬</text>`;
  } else if (suit === 'p') {
    if (n === 1) {
      body = `<circle cx="30" cy="39" r="20" fill="#fff" stroke="${C_BLUE}" stroke-width="3"/>` +
        `<circle cx="30" cy="39" r="13" fill="none" stroke="${C_RED}" stroke-width="3"/>` +
        `<circle cx="30" cy="39" r="6" fill="${C_GREEN}"/>`;
    } else PIN_LAYOUT[n].forEach(([x, y], k) => { body += pinDot(x, y, PIN_R[n], pinColor(n, k)); });
  } else if (suit === 's') {
    if (n === 1) {
      body = `<ellipse cx="30" cy="46" rx="12" ry="16" fill="${C_GREEN}" stroke="#0e4a29" stroke-width="1"/>` +
        `<circle cx="30" cy="25" r="8" fill="${C_GREEN}" stroke="#0e4a29" stroke-width="1"/>` +
        `<polygon points="37,24 45,27 37,29" fill="${C_RED}"/><circle cx="32" cy="23" r="1.6" fill="#fff"/>` +
        `<path d="M22 58 Q18 70 14 72 M30 62 Q30 72 30 74 M38 58 Q42 70 46 72" stroke="${C_RED}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M20 42 Q30 50 40 42" stroke="${C_RED}" stroke-width="2.2" fill="none"/>`;
    } else {
      const { h, p } = STICK_LAYOUT[n];
      p.forEach(([x, y], k) => {
        const red = (n === 5 && k === 2) || (n === 7 && k === 0) || (n === 9 && k >= 3 && k < 6);
        body += stick(x, y, h, red ? C_RED : C_GREEN);
      });
    }
  } else if (suit === 'f') {
    body = flowerArt(n);
  } else if (suit === 'n') {
    body = seasonArt(n);
  } else if (suit === 'w') {
    body = `<text x="30" y="55" text-anchor="middle" font-size="46" font-weight="700" fill="${C_DARK}" font-family="${TILE_FONT}">${'東南西北'[n - 1]}</text>`;
  } else if (n === 1) {
    body = `<text x="30" y="56" text-anchor="middle" font-size="48" font-weight="700" fill="${C_RED}" font-family="${TILE_FONT}">中</text>`;
  } else if (n === 2) {
    body = `<text x="30" y="56" text-anchor="middle" font-size="46" font-weight="700" fill="${C_GREEN}" font-family="${TILE_FONT}">發</text>`;
  } else {
    body = `<rect x="11" y="13" width="38" height="52" rx="4" fill="none" stroke="${C_BLUE}" stroke-width="3.5"/>` +
      `<rect x="17" y="19" width="26" height="40" rx="2" fill="none" stroke="${C_BLUE}" stroke-width="1.5"/>`;
  }
  return (_svgCache[t] = `<svg viewBox="0 0 60 78" xmlns="http://www.w3.org/2000/svg">${body}</svg>`);
}

const SUIT_ORDER = { m: 0, p: 1, s: 2, w: 3, d: 4, f: 5, n: 6 };
const tileSortKey = (t) => SUIT_ORDER[t[0]] * 10 + +t[1];

const TILE_NAMES ={ m: 'Wan', p: 'Pin', s: 'Bambu', w: 'Angin', d: 'Naga' };
function tileName(t) {
  if (t[0] === 'w') return 'Angin ' + ['Timur', 'Selatan', 'Barat', 'Utara'][+t[1] - 1];
  if (t[0] === 'f') return 'Bunga ' + ['Plum', 'Anggrek', 'Krisan', 'Bambu'][+t[1] - 1];
  if (t[0] === 'n') return 'Musim ' + ['Semi', 'Panas', 'Gugur', 'Dingin'][+t[1] - 1];
  if (t[0] === 'd') return 'Naga ' + ['Merah', 'Hijau', 'Putih'][+t[1] - 1];
  return t[1] + ' ' + TILE_NAMES[t[0]];
}

function makeTile(t, opts = {}) {
  const d = document.createElement('div');
  d.className = 'tile' + (opts.cls ? ' ' + opts.cls : '');
  if (t == null) d.classList.add('back');
  else { d.innerHTML = tileSVG(t); d.dataset.tile = t; d.title = tileName(t); }
  return d;
}

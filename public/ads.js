// Iklan: slot tetap + pengatur frekuensi iklan di sela ronde. Semua pengaturan ada di ADS_CONFIG.
//
// mode:
//   'off'     : tidak ada iklan sama sekali (default, aman untuk produksi sebelum AdSense disetujui)
//   'demo'    : iklan tiruan untuk menguji tampilan dan frekuensi (juga bisa lewat ?ads=demo pada URL)
//   'adsense' : iklan sungguhan Google AdSense / H5 Games Ads (isi adsenseClient dan slots di bawah)
//
// Pemain "bebas iklan": localStorage mjadfree = '1' (atau ?noads=1). Nanti dihubungkan ke pembelian/dukungan.
const ADS_CONFIG = {
  mode: 'off',
  adsenseClient: '',                                   // contoh: 'ca-pub-0000000000000000' setelah situs disetujui
  slots: { home: '', lobby: '', result: '', gutter: '' }, // ID unit iklan AdSense per penempatan
  interstitial: {
    firstRound: 3,      // ronde 1-2 bebas iklan; iklan pertama setelah ronde ke-3 selesai
    everyRounds: 3,     // lalu tiap 3 ronde
    minGapMs: 180000,   // jarak minimal antar iklan (3 menit)
    maxPerSession: 5,   // batas per sesi browser
    skipAfterMs: 5000,  // tombol Lewati muncul setelah 5 detik
  },
  gutterMinWidth: 1500, // lebar layar minimum agar iklan 160x600 muncul di kiri/kanan meja
};

const Ads = (() => {
  const C = ADS_CONFIG;
  const q = new URLSearchParams(location.search);
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  if (q.get('ads')) ss.set('mjads', q.get('ads'));
  if (q.get('noads')) ls.set('mjadfree', q.get('noads') === '1' ? '1' : '0');
  const mode = () => ss.get('mjads') || C.mode;
  const adFree = () => ls.get('mjadfree') === '1';
  const active = () => mode() !== 'off' && !adFree();

  // statistik sesi untuk pengatur frekuensi
  const st = () => { try { return JSON.parse(ss.get('mjadst') || '{"rounds":0,"sinceAd":0,"shown":0,"last":0}'); } catch { return { rounds: 0, sinceAd: 0, shown: 0, last: 0 }; } };
  const save = (v) => ss.set('mjadst', JSON.stringify(v));

  let adsenseLoaded = false;
  function loadAdsense() {
    if (adsenseLoaded || mode() !== 'adsense' || !C.adsenseClient) return;
    adsenseLoaded = true;
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(C.adsenseClient);
    document.head.append(s);
  }

  // Isi semua elemen [data-adslot] di dalam root (atau seluruh dokumen).
  function mount(root = document) {
    root.querySelectorAll('[data-adslot]').forEach((el) => {
      el.innerHTML = '';
      if (!active()) { el.hidden = true; return; }
      el.hidden = false;
      const label = document.createElement('span'); label.className = 'adlabel'; label.textContent = 'Iklan';
      el.append(label);
      if (mode() === 'adsense' && C.adsenseClient && C.slots[el.dataset.adslot]) {
        loadAdsense();
        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle'; ins.style.display = 'block'; ins.style.width = '100%'; ins.style.height = '100%';
        ins.dataset.adClient = C.adsenseClient; ins.dataset.adSlot = C.slots[el.dataset.adslot];
        ins.dataset.adFormat = 'auto'; ins.dataset.fullWidthResponsive = 'true';
        el.append(ins);
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      } else if (mode() === 'demo') {
        const d = document.createElement('div'); d.className = 'adtext';
        d.innerHTML = '<b>Iklan contoh</b><br>slot: ' + el.dataset.adslot;
        el.append(d);
      } else el.hidden = true; // mode adsense tanpa konfigurasi: sembunyikan, jangan tampilkan kotak kosong
    });
  }

  // Iklan 160x600 di kiri/kanan meja hanya bila layar cukup lebar dan sedang di layar game.
  function layout(screen) {
    const on = active() && screen === 'game' && innerWidth >= C.gutterMinWidth;
    document.body.classList.toggle('has-gutters', on);
    document.querySelectorAll('.adgut').forEach((e) => { e.hidden = !on; });
  }

  function roundFinished() {
    const s = st(); s.rounds++; s.sinceAd++; save(s);
  }
  function interstitialDue() {
    if (!active()) return false;
    const s = st(), I = C.interstitial;
    return s.rounds >= I.firstRound && s.sinceAd >= I.everyRounds && s.shown < I.maxPerSession && Date.now() - s.last >= I.minGapMs;
  }
  function markShown() { const s = st(); s.shown++; s.sinceAd = 0; s.last = Date.now(); save(s); }

  // Menampilkan iklan layar penuh di jeda antar ronde. Selalu selesai (resolve) meski iklan gagal tampil.
  function showInterstitial() {
    return new Promise((resolve) => {
      markShown();
      if (mode() === 'adsense') {
        // H5 Games Ads (butuh persetujuan Google): jeda iklan 'next' di antara ronde.
        if (typeof window.adBreak === 'function') {
          let done = false; const fin = () => { if (!done) { done = true; resolve(); } };
          try { window.adBreak({ type: 'next', name: 'round-end', adBreakDone: fin }); } catch { fin(); }
          setTimeout(fin, 15000);
        } else resolve();
        return;
      }
      // demo: kotak iklan tiruan dengan tombol Lewati setelah beberapa detik
      const m = document.getElementById('adModal');
      if (!m) return resolve();
      const skipMs = C.interstitial.skipAfterMs;
      m.innerHTML = '<div class="adm-card"><div class="adm-label">Iklan</div><div class="adm-box"><b>Iklan layar penuh (contoh)</b><br>Iklan nyata muncul di sini setelah disetujui.</div><div class="adm-bar"><i></i></div><button id="adSkip" disabled></button></div>';
      m.hidden = false;
      const bar = m.querySelector('.adm-bar i'), btn = m.querySelector('#adSkip');
      bar.style.animation = 'adbar ' + skipMs + 'ms linear forwards';
      let left = Math.ceil(skipMs / 1000);
      btn.textContent = 'Lewati dalam ' + left;
      const iv = setInterval(() => { left--; btn.textContent = left > 0 ? 'Lewati dalam ' + left : 'Lewati'; }, 1000);
      const close = () => { clearInterval(iv); m.hidden = true; m.innerHTML = ''; resolve(); };
      setTimeout(() => { btn.disabled = false; btn.textContent = 'Lewati'; btn.onclick = close; }, skipMs);
      setTimeout(close, skipMs + 20000); // pengaman
    });
  }

  return { config: C, active, adFree, mount, layout, roundFinished, interstitialDue, showInterstitial, state: st };
})();

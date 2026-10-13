// Render contoh ubin di halaman statis: <span class="tl" data-t="m1 m2 m3"></span>
document.querySelectorAll('.tl').forEach((el) => {
  const row = document.createElement('div');
  row.className = 'tiles-row';
  el.dataset.t.trim().split(/\s+/).forEach((t) => row.append(t === 'back' ? makeTile(null) : makeTile(t)));
  el.replaceWith(row);
});

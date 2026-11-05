// 매거진 펼쳐보기(3D 책넘김) — 기존 insta-ui.js 의 openBook 을 독립 모듈로 옮긴 것.
// 카드 2장이 한 펼침면. 표지는 오른쪽에 혼자 놓이고, 한 장씩 3D로 넘어갑니다. (스타일: style.css .book-viewer)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const copyCanvas = src => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };

export function openBook(pages, title, startIndex = 0, opener = document.activeElement) {
  if (document.querySelector('.book-viewer') || !pages.length) return;
  const n = pages.length, count = Math.ceil(n / 2);
  const v = document.createElement('div'); v.className = 'book-viewer';
  v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', '매거진 펼쳐보기');
  v.innerHTML = '<div class="book-top"><div><span class="book-title"></span><small></small></div><button class="book-close" aria-label="닫기">✕</button></div><div class="book-stage"><div class="book"></div></div><div class="book-nav"><button class="bprev" aria-label="이전 페이지">‹</button><div class="dots"></div><button class="bnext" aria-label="다음 페이지">›</button></div><p class="book-hint">페이지를 클릭하거나 ← → 키, 스와이프로 넘겨보세요 · Esc 닫기</p>';
  v.querySelector('.book-title').textContent = title;
  v.querySelector('.book-top small').textContent = `PICK MAGAZINE · ${n}페이지`;
  const book = v.querySelector('.book'), dots = v.querySelector('.dots');
  const leaves = [];
  for (let k = 0; k < count; k++) {
    const leaf = document.createElement('div'); leaf.className = 'leaf';
    for (const [side, src] of [['front', pages[2 * k]], ['back', pages[2 * k + 1]]]) {
      const face = document.createElement('div'); face.className = 'face ' + side + (src ? '' : ' blank');
      if (src) face.append(copyCanvas(src));
      leaf.append(face);
    }
    book.append(leaf); leaves.push(leaf);
  }
  dots.innerHTML = '<i></i>'.repeat(count + 1);
  let f = 0;
  const setZ = () => leaves.forEach((l, k) => { if (!l.classList.contains('turning')) l.style.zIndex = k < f ? k + 1 : count - k; });
  function layout() {
    leaves.forEach((l, k) => l.classList.toggle('flipped', k < f));
    book.style.transform = `translateX(${f === 0 ? -25 : f === count ? 25 : 0}%)`;
    [...dots.children].forEach((d, k) => { d.className = k === f ? 'on' : ''; });
    v.querySelector('.bprev').disabled = f === 0; v.querySelector('.bnext').disabled = f === count;
  }
  function turn(d) {
    const nf = f + d; if (nf < 0 || nf > count) return;
    const leaf = leaves[d > 0 ? f : f - 1]; f = nf;
    leaf.classList.add('turning'); leaf.style.zIndex = count + 2; setZ(); layout();
    clearTimeout(leaf.timer); leaf.timer = setTimeout(() => { leaf.classList.remove('turning'); setZ(); }, 900);
  }
  function size() {
    const w = Math.max(120, Math.min((innerWidth - 40) / 2, (innerHeight - 250) * 0.8, 440));
    book.style.width = 2 * w + 'px'; book.style.height = 1.25 * w + 'px';
  }
  function close() {
    removeEventListener('keydown', onKey, true); removeEventListener('resize', size);
    v.classList.add('closing'); setTimeout(() => v.remove(), 280); opener?.focus?.();
  }
  function onKey(e) {
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { turn(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { turn(-1); e.preventDefault(); }
    e.stopPropagation();
  }
  v.querySelector('.book-close').onclick = close;
  v.querySelector('.bprev').onclick = () => turn(-1);
  v.querySelector('.bnext').onclick = () => turn(1);
  let start = null;
  book.addEventListener('pointerdown', e => { start = e.clientX; });
  book.addEventListener('pointerup', e => {
    if (start === null) return; const dx = e.clientX - start; start = null;
    if (Math.abs(dx) > 45) return turn(dx < 0 ? 1 : -1);
    const r = book.getBoundingClientRect(); turn(e.clientX > r.left + r.width / 2 ? 1 : -1);
  });
  v.addEventListener('click', e => { if (e.target === v) close(); });
  addEventListener('keydown', onKey, true); addEventListener('resize', size);
  size(); setZ(); layout(); document.body.append(v); v.querySelector('.book-close').focus();
  // 보던 카드가 있는 펼침면까지 넘겨 둡니다.
  const target = Math.ceil(Math.max(0, startIndex) / 2);
  if (!reduce) for (let k = 0; k < target; k++) setTimeout(() => turn(1), 650 + k * 170);
  else { f = target; setZ(); layout(); }
}

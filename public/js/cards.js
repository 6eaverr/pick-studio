// 기존 Canvas 렌더러(drawCard)로 DB 매거진의 카드를 그립니다.
import { drawCard } from '/renderer.js';
import { toContent } from '/shared/magazine-content.js';

function placeholder(canvas, message) {
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efefef'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#737373'; ctx.font = '600 40px "PICK Pretendard", sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(message.slice(0, 40), 540, 675);
  return canvas;
}

// 사진을 못 불러오면 사진 없이, 글이 너무 길면 안내 화면으로 대신 그립니다(목록·미리보기가 멈추지 않게).
export async function drawContentCard(canvas, content, index) {
  try {
    return await drawCard(canvas, content, index);
  } catch (err) {
    if (content.cards[index]?.image) {
      const noPhoto = { ...content, cards: content.cards.map((c, i) => (i === index ? { ...c, image: '' } : c)) };
      try { return await drawCard(canvas, noPhoto, index); } catch { /* 아래 안내 화면 */ }
    }
    return placeholder(canvas, err.message || '카드를 그리지 못했습니다');
  }
}

export function drawMagazineCard(canvas, magazine, index = 0) {
  return drawContentCard(canvas, toContent(magazine), index);
}

// 모든 카드를 순서대로 그려 canvas 배열로. onPage(i, canvas) 로 한 장씩 다 그릴 때마다 알려 줌(먼저 보여 주기용)
export async function drawAllCards(magazine, onPage) {
  const content = toContent(magazine);
  const pages = [];
  for (let i = 0; i < content.cards.length; i++) {
    const c = document.createElement('canvas');
    c.setAttribute('aria-label', `${i + 1}번째 카드`);
    pages.push(await drawContentCard(c, content, i));
    onPage?.(i, c);
  }
  return pages;
}

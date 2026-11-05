// DB 모양(Magazine + Card + Source) → 기존 렌더러·말투 검사기가 쓰는 원고(content) 모양
// 서버(말투 검사 API)와 브라우저(카드 미리보기·내보내기)가 같이 씁니다.
//   headline → title, footer → note, photoUrl → image, outlet → publisher
export function toContent(magazine) {
  const cards = [...(magazine.cards || [])].sort((a, b) => a.order - b.order);
  return {
    keyword: magazine.keyword || '',
    category: magazine.category || 'MUSIC CURATION',
    theme: magazine.theme || 'paper',
    template: magazine.template || 'classic',
    caption: magazine.caption || '',
    hashtags: [],
    cards: cards.map((c, i) => ({
      id: c.id,
      label: c.label || '',
      title: c.headline || '',
      body: c.body || '',
      note: c.footer || '',
      image: c.photoUrl || '',
      layout: c.layout || (i === 0 ? 'cover' : 'story'),
    })),
    sources: (magazine.sources || []).map(s => ({ id: String(s.id), title: s.title, url: s.url, publisher: s.outlet, verified: !!s.verified })),
  };
}

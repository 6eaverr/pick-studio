import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProject, titleFrom } from '../lib/legacy-map.mjs';

const project = (status, extra = {}) => ({
  id: 'x', status, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z',
  content: {
    keyword: '검정치마', category: 'MUSIC CURATION', theme: 'cobalt', template: 'playlist', caption: '첫 줄', hashtags: ['#인디밴드'],
    cards: Array.from({ length: 6 }, (_, i) => ({ label: 'L', title: i ? `제목${i}` : 'EVERYTHING만 듣고\n[이 밴드 안다고 하지 마]', body: 'b', note: 'n', image: '', layout: i ? 'story' : 'cover' })),
    sources: [{ id: 's1', title: 't', url: 'https://example.com/a', publisher: '뉴시스', date: '', evidence: '' }],
    ...extra,
  },
});

test('표지 제목에서 괄호·줄바꿈을 빼고 60자 이내로', () => {
  assert.equal(titleFrom(project('draft').content), 'EVERYTHING만 듣고 이 밴드 안다고 하지 마');
  assert.ok(titleFrom({ cards: [{ title: 'a'.repeat(100) }] }).length <= 60);
});

test('필드 이름 변환: title→headline, note→footer, image→photoUrl, publisher→outlet', () => {
  const m = mapProject(project('draft'));
  assert.deepEqual(Object.keys(m.cards[0]).sort(), ['body', 'footer', 'headline', 'label', 'layout', 'order', 'photoUrl']);
  assert.equal(m.cards[0].photoUrl, null);
  assert.equal(m.cards[5].order, 5);
  assert.equal(m.sources[0].outlet, '뉴시스');
  assert.equal(m.magazine.theme, 'cobalt');
  assert.match(m.magazine.caption, /#인디밴드/);
});

test('상태 변환과 출처 확인 여부', () => {
  assert.equal(mapProject(project('draft')).magazine.status, 'DRAFT');
  assert.equal(mapProject(project('draft')).sources[0].verified, false);
  assert.equal(mapProject(project('uncertain')).magazine.status, 'PUBLISHED');
  assert.equal(mapProject(project('published')).sources[0].verified, true);
});

test('5~8장 밖이면 경고', () => {
  const p = project('draft');
  p.content.cards = p.content.cards.slice(0, 3);
  assert.equal(mapProject(p).warnings.length, 1);
});

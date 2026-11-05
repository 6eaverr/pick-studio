import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_FLOW, nextStatus, transitionProblem, approvalBlockers, statusAfterEdit, canExport } from '../shared/status-rules.js';
import { toContent } from '../shared/magazine-content.js';
import { lintCards } from '../shared/voice.js';
import { checkStatusChange } from '../validators/magazine.validator.mjs';

const verified = [{ outlet: '뉴시스', verified: true }, { outlet: '멜론', verified: true }];

// ── 상태 전환 ──
test('정해진 순서로 한 칸씩만 앞으로 갈 수 있다', () => {
  assert.equal(transitionProblem('DRAFT', 'REVIEW'), null);
  assert.equal(transitionProblem('REVIEW', 'APPROVED', { sources: verified }), null);
  assert.equal(transitionProblem('APPROVED', 'PUBLISHED', { sources: verified }), null);
});

test('모든 건너뛰기·되돌리기·제자리 전환은 거부 (INVALID_TRANSITION)', () => {
  for (const from of STATUS_FLOW) {
    for (const to of STATUS_FLOW) {
      if (to === nextStatus(from)) continue;
      const p = transitionProblem(from, to, { sources: verified });
      assert.equal(p?.code, 'INVALID_TRANSITION', `${from} → ${to}`);
    }
  }
});

test('거부 메시지가 이유와 다음 단계를 알려 준다', () => {
  assert.match(transitionProblem('DRAFT', 'APPROVED').message, /건너뛸 수 없습니다.*REVIEW/);
  assert.match(transitionProblem('APPROVED', 'DRAFT').message, /되돌릴 수 없습니다/);
  assert.match(transitionProblem('PUBLISHED', 'DRAFT').message, /게시 완료 후에는/);
});

test('없는 상태값은 VALIDATION_ERROR', () => {
  assert.equal(transitionProblem('DRAFT', 'DONE').code, 'VALIDATION_ERROR');
  assert.throws(() => checkStatusChange({ body: { status: 'approved' } }), { code: 'VALIDATION_ERROR' });
  assert.throws(() => checkStatusChange({ body: {} }), { code: 'VALIDATION_ERROR' });
});

// ── 승인 조건 ──
test('승인: 출처가 없으면 거부', () => {
  const p = transitionProblem('REVIEW', 'APPROVED', { sources: [] });
  assert.equal(p.code, 'APPROVAL_BLOCKED');
  assert.deepEqual(p.reasons, ['출처가 1개 이상 필요합니다.']);
});

test('승인: 확인 안 된 출처가 하나라도 있으면 거부하고 이름을 알려 줌', () => {
  const p = transitionProblem('REVIEW', 'APPROVED', { sources: [{ outlet: '뉴시스', verified: true }, { outlet: '공식 SNS', verified: false }] });
  assert.equal(p.code, 'APPROVAL_BLOCKED');
  assert.match(p.message, /확인하지 않은 출처가 1개.*공식 SNS/);
});

test('게시(PUBLISHED)로 갈 때도 출처 조건을 다시 확인', () => {
  assert.equal(transitionProblem('APPROVED', 'PUBLISHED', { sources: [{ outlet: 'x', verified: false }] }).code, 'APPROVAL_BLOCKED');
});

test('approvalBlockers: 조건을 다 채우면 빈 배열', () => {
  assert.deepEqual(approvalBlockers(verified), []);
  assert.equal(approvalBlockers([]).length, 1);
});

// ── 수정 시 상태 ──
test('APPROVED 에서 수정하면 REVIEW 로 되돌림, PUBLISHED 는 잠금, 나머지는 그대로', () => {
  assert.deepEqual(statusAfterEdit('APPROVED'), { locked: false, status: 'REVIEW', reverted: true });
  assert.equal(statusAfterEdit('PUBLISHED').locked, true);
  assert.deepEqual(statusAfterEdit('DRAFT'), { locked: false, status: 'DRAFT', reverted: false });
  assert.deepEqual(statusAfterEdit('REVIEW'), { locked: false, status: 'REVIEW', reverted: false });
});

test('내보내기는 APPROVED 이상만', () => {
  assert.deepEqual(STATUS_FLOW.filter(canExport), ['APPROVED', 'PUBLISHED']);
});

// ── DB → 원고 변환 + 말투 검사 ──
test('toContent: 필드 이름을 렌더러·검사기 모양으로 바꾸고 order 순으로 정렬', () => {
  const c = toContent({
    keyword: 'k', theme: 'cobalt', template: 'playlist', caption: 'cap',
    cards: [{ id: 2, order: 1, headline: 'B', body: 'b', footer: 'f', photoUrl: null, layout: 'story' }, { id: 1, order: 0, headline: 'A', body: '', footer: '', photoUrl: '/assets/x.jpg', layout: 'cover' }],
    sources: [{ id: 9, outlet: '뉴시스', title: 't', url: 'https://x.com', verified: true }],
  });
  assert.deepEqual(c.cards.map(x => x.title), ['A', 'B']);
  assert.equal(c.cards[0].image, '/assets/x.jpg');
  assert.equal(c.cards[1].note, 'f');
  assert.equal(c.sources[0].publisher, '뉴시스');
  assert.equal(c.theme, 'cobalt');
});

test('말투 검사: 변환한 원고로 0~100점과 카드별 지적이 나온다', () => {
  const cards = ['날씨의 요정 다음엔\n뭘 들을까', '시작은', '둘째', '셋째', '마무리'].map((headline, order) => ({ id: order + 1, order, headline, body: order ? '다양한 매력을 선사합니다. 들어보세요.' : '', footer: '' }));
  const r = lintCards(toContent({ cards, caption: '' }));
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.ok(r.issues.some(x => x.card === 0 && x.id === 'weakq'));
  assert.ok(r.issues.some(x => x.card === 1 && x.id === 'abstract'));
});

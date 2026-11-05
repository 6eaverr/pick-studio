import { getMagazine, changeStatus as changeStatusService } from '../services/magazine.service.mjs';
import { parseId } from '../validators/common.mjs';
import { notFound } from '../lib/http-error.mjs';
import { toContent } from '../shared/magazine-content.js';
import { lintCards } from '../shared/voice.js';
import { approvalBlockers, nextStatus } from '../shared/status-rules.js';

const ISSUE_FIELDS = ['field', 'id', 'label', 'fix', 'weight', 'match'];
const slim = issue => Object.fromEntries(ISSUE_FIELDS.filter(k => issue[k] !== undefined).map(k => [k, issue[k]]));

// GET /api/magazines/:id/voice → 카드별 지적 사항 + 매거진 전체 0~100점 (로그인 사용자 누구나)
export async function voice(req, res) {
  const magazine = await getMagazine(parseId(req.params.id));
  if (!magazine) throw notFound('매거진을 찾을 수 없습니다.');
  const content = toContent(magazine);
  const { score, issues } = lintCards(content);
  res.json({
    magazineId: magazine.id,
    score,
    cards: content.cards.map((c, i) => ({ cardId: c.id, order: i, issues: issues.filter(x => x.card === i).map(slim) })),
    overall: issues.filter(x => x.card === -1).map(slim), // 캡션·전체 문체
    // 검토 화면용: 다음 단계와 승인 불가 사유
    review: { status: magazine.status, next: nextStatus(magazine.status), approvalBlockers: approvalBlockers(magazine.sources) },
  });
}

// PATCH /api/magazines/:id/status  { status } (작성자만)
export async function changeStatus(req, res) {
  const { magazine, from } = await changeStatusService(req.magazine.id, req.body.status);
  res.json({ magazine, from, to: magazine.status });
}

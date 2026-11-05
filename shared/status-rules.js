// 검토·승인 흐름 규칙 (서버가 강제하고, 검토 화면은 같은 함수로 "승인 불가 사유"를 미리 보여 줍니다)
//
//   DRAFT → REVIEW → APPROVED → PUBLISHED   (한 칸씩 앞으로만, 건너뛰기·되돌리기 불가)
//   APPROVED 조건: 출처 1개 이상 + 모든 출처 verified=true
//   APPROVED 상태에서 내용(카드·제목·캡션 등)을 고치면 자동으로 REVIEW 로 되돌아감
//   PUBLISHED 는 내용 수정 불가(삭제만 가능)

export const STATUS_FLOW = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'];

export const STATUS_LABEL = {
  DRAFT: '작성 중',
  REVIEW: '검토 중',
  APPROVED: '승인 완료',
  PUBLISHED: '게시 완료',
};

// 지금 상태에서 갈 수 있는 다음 상태 (없으면 null)
export function nextStatus(current) {
  const i = STATUS_FLOW.indexOf(current);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

// 승인(APPROVED)을 막는 사유 목록. 빈 배열이면 승인 가능.
export function approvalBlockers(sources = []) {
  const reasons = [];
  if (!sources.length) reasons.push('출처가 1개 이상 필요합니다.');
  const unverified = sources.filter(s => !s.verified);
  if (unverified.length) reasons.push(`확인하지 않은 출처가 ${unverified.length}개 있습니다: ${unverified.map(s => s.outlet || s.publisher || s.title).slice(0, 3).join(', ')}${unverified.length > 3 ? ' 외' : ''}`);
  return reasons;
}

// from → to 전환 검사. 문제가 없으면 null, 있으면 { code, message, reasons }
export function transitionProblem(from, to, { sources = [] } = {}) {
  if (!STATUS_FLOW.includes(to)) {
    return { code: 'VALIDATION_ERROR', message: `status 는 ${STATUS_FLOW.join(', ')} 중 하나여야 합니다.`, reasons: [] };
  }
  if (from === to) {
    return { code: 'INVALID_TRANSITION', message: `이미 ${STATUS_LABEL[to]}(${to}) 상태입니다.`, reasons: [] };
  }
  const expected = nextStatus(from);
  if (to !== expected) {
    const why = STATUS_FLOW.indexOf(to) < STATUS_FLOW.indexOf(from) ? '되돌릴 수 없습니다' : '단계를 건너뛸 수 없습니다';
    const hint = expected ? ` 다음 단계는 ${STATUS_LABEL[expected]}(${expected})입니다.` : ' 게시 완료 후에는 상태를 바꿀 수 없습니다.';
    return { code: 'INVALID_TRANSITION', message: `${from} → ${to}: ${why}.${hint}`, reasons: [] };
  }
  // PUBLISHED 로 갈 때도 다시 확인 (승인 이후 출처가 바뀌었으면 이미 REVIEW 로 돌아가 있지만, 한 번 더 지킴)
  if (to === 'APPROVED' || to === 'PUBLISHED') {
    const reasons = approvalBlockers(sources);
    if (reasons.length) return { code: 'APPROVAL_BLOCKED', message: `승인할 수 없습니다. ${reasons.join(' ')}`, reasons };
  }
  return null;
}

// 내용 수정 시 상태 처리: PUBLISHED 는 수정 거부, APPROVED 는 REVIEW 로
export function statusAfterEdit(current) {
  if (current === 'PUBLISHED') return { locked: true, status: current, reverted: false };
  if (current === 'APPROVED') return { locked: false, status: 'REVIEW', reverted: true };
  return { locked: false, status: current, reverted: false };
}

// 내보내기(카드 이미지 ZIP)는 APPROVED 이상만
export const canExport = status => status === 'APPROVED' || status === 'PUBLISHED';

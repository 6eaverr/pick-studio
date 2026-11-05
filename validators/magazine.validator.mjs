import { validate, invalid, checkFields, lengthBetween, isHttpUrl, isString, parseId } from './common.mjs';
import { CARD_MIN, CARD_MAX, SOURCE_MAX, MAGAZINE_TYPES, MAGAZINE_STATUSES, TEMPLATE_IDS, THEMES, LAYOUTS, PHOTO_URL_RE } from '../lib/rules.mjs';

const oneOf = (list, name) => v => list.includes(v) || `${name}은(는) ${list.join(', ')} 중 하나여야 합니다.`;
const len = (min, max, name) => v => lengthBetween(v, min, max) || (min ? `${name}은(는) ${min}~${max}자로 입력하세요.` : `${name}은(는) ${max}자 이하로 입력하세요.`);

// ── 필드 규칙 ──
export const MAGAZINE_RULES = {
  title: len(1, 60, '제목'),
  keyword: len(1, 160, '키워드'),
  type: oneOf(MAGAZINE_TYPES, '종류(type)'),
  template: oneOf(TEMPLATE_IDS, '템플릿'),
  theme: oneOf(THEMES, '색상 테마'),
  category: len(0, 40, '머리글 라벨'),
  caption: len(0, 2200, '캡션'),
};
export const CARD_RULES = {
  label: len(0, 40, '라벨'),
  headline: len(1, 64, '제목(headline)'),
  body: len(0, 260, '본문'),
  footer: len(0, 100, '하단 문구'),
  photoUrl: v => v === null || v === '' || (isString(v) && PHOTO_URL_RE.test(v)) || '사진은 업로드한 파일(/assets/…)만 쓸 수 있습니다.',
  layout: oneOf(LAYOUTS, '레이아웃'),
};
export const SOURCE_RULES = {
  outlet: len(1, 100, '매체명(outlet)'),
  title: len(1, 180, '출처 제목'),
  url: v => isHttpUrl(v) || '출처 url 형식이 올바르지 않습니다(http/https 주소).',
  verified: v => typeof v === 'boolean' || 'verified 는 true 또는 false 여야 합니다.',
};

// 상태는 검토·승인 흐름(PATCH /api/magazines/:id/status)으로만 바꿉니다.
function rejectStatus(body) {
  if (body?.status !== undefined) throw invalid('상태 변경은 PATCH /api/magazines/:id/status 를 사용하세요.');
}

function checkCardCount(cards) {
  if (!Array.isArray(cards) || cards.length < CARD_MIN || cards.length > CARD_MAX) throw invalid(`카드는 ${CARD_MIN}~${CARD_MAX}장이어야 합니다.`);
}

// ── 요청별 검사 ──
export function checkCreateMagazine({ body }) {
  rejectStatus(body);
  checkFields(body, MAGAZINE_RULES, { required: ['title', 'keyword'] });
  checkCardCount(body.cards);
  body.cards.forEach((c, i) => checkFields(c, CARD_RULES, { required: ['headline'], label: `${i + 1}장: ` }));
  if (body.sources !== undefined) {
    if (!Array.isArray(body.sources) || body.sources.length > SOURCE_MAX) throw invalid(`출처는 ${SOURCE_MAX}개 이하의 배열이어야 합니다.`);
    body.sources.forEach((s, i) => checkFields(s, SOURCE_RULES, { required: ['outlet', 'title', 'url'], label: `출처 ${i + 1}: ` }));
  }
}

export function checkUpdateMagazine({ body }) {
  rejectStatus(body);
  if (body?.cards !== undefined || body?.sources !== undefined) throw invalid('카드·출처는 각각의 API로 수정하세요.');
  checkFields(body, MAGAZINE_RULES);
  if (!Object.keys(MAGAZINE_RULES).some(k => body[k] !== undefined)) throw invalid('수정할 값이 없습니다.');
}

export function checkListQuery({ query = {} }) {
  if (query.q !== undefined && (!isString(query.q) || query.q.length > 100)) throw invalid('검색어는 100자 이하로 입력하세요.');
  if (query.status !== undefined && !MAGAZINE_STATUSES.includes(query.status)) throw invalid(`status 는 ${MAGAZINE_STATUSES.join(', ')} 중 하나여야 합니다.`);
  if (query.type !== undefined && !MAGAZINE_TYPES.includes(query.type)) throw invalid(`type 은 ${MAGAZINE_TYPES.join(', ')} 중 하나여야 합니다.`);
  if (query.mine !== undefined && !['0', '1', 'true', 'false'].includes(query.mine)) throw invalid('mine 은 1 또는 0 이어야 합니다.');
  for (const k of ['page', 'limit']) {
    if (query[k] !== undefined && !/^\d{1,4}$/.test(query[k])) throw invalid(`${k} 는 숫자여야 합니다.`);
  }
}

export function checkCreateCard({ body }) {
  checkFields(body, CARD_RULES, { required: ['headline'] });
}

export function checkUpdateCard({ body }) {
  checkFields(body, CARD_RULES);
  if (!Object.keys(CARD_RULES).some(k => body[k] !== undefined)) throw invalid('수정할 값이 없습니다.');
}

export function checkReorder({ body }) {
  const ids = body?.cardIds;
  if (!Array.isArray(ids) || ids.length < CARD_MIN || ids.length > CARD_MAX || !ids.every(id => Number.isSafeInteger(id) && id > 0)) {
    throw invalid(`cardIds 는 카드 id(정수) ${CARD_MIN}~${CARD_MAX}개의 배열이어야 합니다.`);
  }
  if (new Set(ids).size !== ids.length) throw invalid('cardIds 에 중복된 id가 있습니다.');
}

export function checkCreateSource({ body }) {
  checkFields(body, SOURCE_RULES, { required: ['outlet', 'title', 'url'] });
}

// verified 를 보내면 그 값으로, 안 보내면 현재 값의 반대로 토글
export function checkPatchSource({ body = {} }) {
  checkFields(body ?? {}, { verified: SOURCE_RULES.verified });
}

export function checkStatusChange({ body }) {
  if (!MAGAZINE_STATUSES.includes(body?.status)) throw invalid(`status 는 ${MAGAZINE_STATUSES.join(', ')} 중 하나여야 합니다.`);
}

export const validateIdParam = validate(req => { parseId(req.params.id); });
export const validateStatusChange = validate(checkStatusChange);
export const validateCreateMagazine = validate(checkCreateMagazine);
export const validateUpdateMagazine = validate(checkUpdateMagazine);
export const validateListQuery = validate(checkListQuery);
export const validateCreateCard = validate(checkCreateCard);
export const validateUpdateCard = validate(checkUpdateCard);
export const validateReorder = validate(checkReorder);
export const validateCreateSource = validate(checkCreateSource);
export const validatePatchSource = validate(checkPatchSource);

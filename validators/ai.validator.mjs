import { validate, invalid, checkFields, lengthBetween, isString } from './common.mjs';
import { CARD_MIN, CARD_MAX, MAGAZINE_TYPES, TEMPLATE_IDS } from '../lib/rules.mjs';
import { AI_MODELS, HOOKS } from '../services/ai.service.mjs';

const MODEL_IDS = AI_MODELS.map(m => m.id);

// POST /api/ai/generate { keyword, model, count?, type?, template?, hook? }
export function checkGenerate({ body }) {
  checkFields(body, {
    keyword: v => lengthBetween(v, 1, 160) || '키워드는 1~160자로 입력하세요.',
    model: v => MODEL_IDS.includes(v) || `model 은 ${MODEL_IDS.join(', ')} 중 하나여야 합니다.`,
    count: v => (Number.isInteger(v) && v >= CARD_MIN && v <= CARD_MAX) || `카드 장수는 ${CARD_MIN}~${CARD_MAX} 사이 정수여야 합니다.`,
    type: v => MAGAZINE_TYPES.includes(v) || `type 은 ${MAGAZINE_TYPES.join(', ')} 중 하나여야 합니다.`,
    template: v => TEMPLATE_IDS.includes(v) || '알 수 없는 템플릿입니다.',
    hook: v => HOOKS.includes(v) || `hook 은 ${HOOKS.join(', ')} 중 하나여야 합니다.`,
  }, { required: ['keyword', 'model'] });
}

export function checkJobId({ params }) {
  if (!isString(params.id) || !/^[0-9a-f-]{36}$/.test(params.id)) throw invalid('잘못된 작업 id 입니다.');
}

export const validateGenerate = validate(checkGenerate);
export const validateJobId = validate(checkJobId);

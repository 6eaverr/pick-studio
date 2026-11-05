// 서비스 규칙에 쓰는 상수 (검증·서비스·화면이 같은 값을 쓰도록 한곳에 둠)
import { templates } from '../public/templates.js';

export const CARD_MIN = 5;
export const CARD_MAX = 8;
export const SOURCE_MAX = 30;

export const MAGAZINE_TYPES = ['CURATION', 'ISSUE'];
export const MAGAZINE_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED'];

export const TEMPLATE_IDS = ['classic', ...templates.map(t => t.id)];
export const THEMES = ['paper', 'midnight', 'cobalt'];
export const LAYOUTS = ['cover', 'story', 'type', 'end'];

// 카드 사진은 이 서버에 올린 파일만 (외부 이미지는 Canvas 내보내기에서 막히므로)
export const PHOTO_URL_RE = /^\/assets\/[\w.-]+$/;

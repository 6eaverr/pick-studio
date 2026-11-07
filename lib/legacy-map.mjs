// 기존 data/projects.json 의 project 하나를 새 DB 구조(Magazine + Card[] + Source[])로 바꿉니다.
// DB에 접근하지 않는 순수 함수라서 테스트와 --dry-run 에서 그대로 씁니다.
import { finalCaption } from './content.mjs';

const STATUS = {
  draft: 'DRAFT',
  approved: 'APPROVED',
  publishing: 'PUBLISHED',
  uncertain: 'PUBLISHED',
  published: 'PUBLISHED',
};

// 표지 제목에서 [강조] 괄호와 줄바꿈을 빼고 60자로 자릅니다.
export function titleFrom(content) {
  const raw = content.cards?.[0]?.title || content.keyword || '제목 없음';
  return raw.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) || '제목 없음';
}

export function typeFrom(content) {
  return /NEWS|ISSUE|뉴스|이슈|소식/i.test(`${content.category || ''} ${content.mode || ''}`) ? 'ISSUE' : 'CURATION';
}

export function mapProject(project) {
  const c = project.content;
  const status = STATUS[project.status] || 'DRAFT';
  // 기존 승인 절차(사실 확인 체크 포함)를 통과한 원고의 출처만 확인 완료로 옮깁니다.
  const verified = status === 'APPROVED' || status === 'PUBLISHED';
  const warnings = [];
  if (c.cards.length < 5 || c.cards.length > 8) warnings.push(`카드 ${c.cards.length}장 (새 규칙 5~8장 밖)`);
  if (verified && !c.sources.length) warnings.push('승인·게시 상태인데 출처가 없음');

  const mapped = mapContent(c, { status, verified });
  return {
    warnings,
    ...mapped,
    magazine: {
      ...mapped.magazine,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt || project.createdAt),
    },
  };
}

// 원고(content: 기존 JSON·AI 생성 결과 모양) → { magazine, cards, sources }
// AI 원고 생성(services/ai.service.mjs)과 기존 데이터 가져오기가 같이 씁니다.
export function mapContent(c, { status = 'DRAFT', verified = false, type } = {}) {
  return {
    magazine: {
      title: titleFrom(c),
      keyword: c.keyword,
      type: type || typeFrom(c),
      template: c.template || 'classic',
      status,
      // 해시태그 필드가 없어지므로 게시용 최종 캡션(본문 + 해시태그 5개)으로 합쳐서 보관
      caption: finalCaption(c),
      theme: c.theme || 'paper',
      category: c.category || 'MUSIC CURATION',
    },
    cards: c.cards.map((card, i) => ({
      order: i,
      label: card.label || '',
      headline: card.title,
      body: card.body || '',
      footer: card.note || '',
      photoUrl: card.image || null,
      layout: card.layout || (i === 0 ? 'cover' : 'story'),
    })),
    sources: c.sources.map(s => ({
      outlet: s.publisher || '',
      title: s.title,
      url: s.url,
      verified,
    })),
  };
}

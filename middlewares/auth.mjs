import { unauthorized, badRequest, forbidden, notFound } from '../lib/http-error.mjs';
import { parseId } from '../validators/common.mjs';
import { findMagazineOwner } from '../services/magazine.service.mjs';
import { findCardOwner } from '../services/card.service.mjs';
import { findSourceOwner } from '../services/source.service.mjs';

// 로그인한 사용자만 통과 (아니면 401)
export function isLoggedIn(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  next(unauthorized('로그인이 필요합니다.'));
}

// 로그인하지 않은 사용자만 통과 (회원가입·로그인 중복 방지, 아니면 400)
export function isNotLoggedIn(req, res, next) {
  if (!req.isAuthenticated?.()) return next();
  next(badRequest('이미 로그인되어 있습니다. 먼저 로그아웃하세요.', 'ALREADY_LOGGED_IN'));
}

// 경로의 :id 로 대상(매거진·카드·출처)을 찾아 "그 매거진의 작성자 = 로그인 사용자"인지 확인
//   없으면 404, 다른 사용자면 403. 통과하면 req.magazine = { id, authorId, status } 와 대상 id를 넣어 둡니다.
// loaders 는 테스트에서 DB 없이 바꿔 끼울 수 있게 인자로 받습니다.
export const ownerLoaders = {
  magazine: async id => {
    const m = await findMagazineOwner(id);
    return m && { magazine: m };
  },
  card: async id => {
    const c = await findCardOwner(id);
    return c && { magazine: c.magazine, card: { id: c.id, magazineId: c.magazineId } };
  },
  source: async id => {
    const s = await findSourceOwner(id);
    return s && { magazine: s.magazine, source: { id: s.id, magazineId: s.magazineId } };
  },
};

const LABEL = { magazine: '매거진', card: '카드', source: '출처' };

export function isOwner(kind, loaders = ownerLoaders) {
  if (!loaders[kind]) throw new Error(`isOwner: 알 수 없는 대상 ${kind}`);
  return async (req, res, next) => {
    try {
      if (!req.user) throw unauthorized();
      const id = parseId(req.params.id);
      const found = await loaders[kind](id);
      if (!found) throw notFound(`${LABEL[kind]}을(를) 찾을 수 없습니다.`);
      if (found.magazine.authorId !== req.user.id) throw forbidden('본인이 작성한 매거진만 수정·삭제할 수 있습니다.', 'NOT_OWNER');
      Object.assign(req, found);
      next();
    } catch (e) {
      next(e);
    }
  };
}

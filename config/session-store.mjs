import session from 'express-session';
import { prisma } from '../services/prisma.mjs';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const expiryOf = sess => (sess?.cookie?.expires ? new Date(sess.cookie.expires) : new Date(Date.now() + WEEK));

// express-session 저장소를 Supabase(PostgreSQL)의 sessions 테이블로.
// Vercel 처럼 요청마다 서버가 바뀌어도, 로컬에서 서버를 재시작해도 로그인이 유지됩니다.
export class PrismaSessionStore extends session.Store {
  constructor() {
    super();
    this.lastPrune = 0;
    this.touched = new Map(); // sid → 마지막 만료 연장 시각 (매 요청 DB 쓰기를 줄이기 위해 1시간에 한 번만)
  }

  get(sid, cb) {
    prisma.session.findUnique({ where: { sid } }).then(row => {
      if (!row || row.expiresAt < new Date()) return cb(null, null);
      cb(null, JSON.parse(row.data));
    }, cb);
  }

  set(sid, sess, cb) {
    const data = JSON.stringify(sess);
    const expiresAt = expiryOf(sess);
    prisma.session.upsert({ where: { sid }, create: { sid, data, expiresAt }, update: { data, expiresAt } })
      .then(() => { this.touched.set(sid, Date.now()); cb?.(null); }, e => cb?.(e));
    this.prune();
  }

  destroy(sid, cb) {
    this.touched.delete(sid);
    prisma.session.deleteMany({ where: { sid } }).then(() => cb?.(null), e => cb?.(e));
  }

  touch(sid, sess, cb) {
    if (Date.now() - (this.touched.get(sid) || 0) < HOUR) return cb?.(null);
    this.touched.set(sid, Date.now());
    prisma.session.updateMany({ where: { sid }, data: { expiresAt: expiryOf(sess) } }).then(() => cb?.(null), e => cb?.(e));
  }

  // 만료된 세션 정리 (서버 인스턴스마다 1시간에 한 번)
  prune() {
    if (Date.now() - this.lastPrune < HOUR) return;
    this.lastPrune = Date.now();
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  }
}

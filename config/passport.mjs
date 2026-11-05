import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { verifyCredentials, findPublicById } from '../services/user.service.mjs';

// passport-local: 이메일 + 비밀번호로 로그인
// 세션에는 사용자 id만 저장하고, 요청마다 DB에서 공개 정보(id·email·nickname)를 다시 읽습니다.
export function configurePassport() {
  passport.use(new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
    try {
      const user = await verifyCredentials(email, password);
      if (!user) return done(null, false, { message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      done(null, user);
    } catch (e) {
      done(e);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      done(null, (await findPublicById(id)) || false); // 탈퇴 등으로 없으면 로그아웃 상태
    } catch (e) {
      done(e);
    }
  });
  return passport;
}

import bcrypt from 'bcrypt';
import { prisma } from './prisma.mjs';
import { conflict } from '../lib/http-error.mjs';

const SALT_ROUNDS = 12;
// 응답·세션에 싣는 필드 (password 해시는 절대 포함하지 않음)
export const PUBLIC_USER = { id: true, email: true, nickname: true, createdAt: true };

// 존재하지 않는 이메일로 로그인해도 비교 시간이 비슷하도록 쓰는 더미 해시
const DUMMY_HASH = bcrypt.hashSync('pick-studio-dummy-password', SALT_ROUNDS);

export const normalizeEmail = email => String(email).trim().toLowerCase();

export function findPublicById(id) {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER });
}

export async function createUser({ email, password, nickname }) {
  const normalized = normalizeEmail(email);
  if (await prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })) {
    throw conflict('이미 가입된 이메일입니다.', 'EMAIL_TAKEN');
  }
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    return await prisma.user.create({
      data: { email: normalized, password: hash, nickname: nickname.trim() },
      select: PUBLIC_USER,
    });
  } catch (e) {
    // 동시에 같은 이메일로 가입한 경우(unique 제약 위반)
    if (e.code === 'P2002') throw conflict('이미 가입된 이메일입니다.', 'EMAIL_TAKEN');
    throw e;
  }
}

// 이메일·비밀번호가 맞으면 공개 사용자 정보, 아니면 null
export async function verifyCredentials(email, password) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  const ok = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !ok) return null;
  const { password: _hash, ...publicUser } = user;
  return publicUser;
}

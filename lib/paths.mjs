// 프로젝트 경로 (앱·서비스가 같은 위치를 쓰도록 한곳에서 계산)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = process.env.PICK_DATA_DIR || path.join(ROOT, 'data');
export const ASSETS = path.join(DATA, 'assets'); // 업로드한 카드 사진 (/assets/<sha256>.<확장자>)

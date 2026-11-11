// Vercel 서버리스 진입점: 같은 Express 앱을 그대로 내보냅니다(로컬은 server.mjs 가 listen).
// 화면·정적 파일(public/)은 Vercel CDN 이 직접 주고, 나머지 요청은 vercel.json 의 rewrite 로 여기로 옵니다.
import { createApp } from '../app.mjs';

export default createApp();

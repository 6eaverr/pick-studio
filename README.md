# PICK Studio — 음악 카드뉴스 매거진 다중 사용자 웹 서비스

고급웹프로그래밍 기말 프로젝트. 1인용 로컬 편집 프로그램이던 PICK Studio(인스타그램 음악 매거진 카드뉴스 편집실)를 **여러 사용자가 가입해 각자 매거진을 만들고, 검토·승인 후 카드 이미지를 내보내는 웹 서비스**로 바꿨습니다.

- 서버: Node.js 22+ · Express 5 (routes / controllers / services / middlewares / validators 분리)
- DB: Prisma 6 + Supabase(PostgreSQL)
- 인증: passport-local + express-session, 비밀번호는 bcrypt 해시
- 화면: HTML · CSS · JavaScript(React 없음). 모든 데이터는 `fetch` 로 API 를 불러와 그립니다.
- 고유 기능: **AI 말투 검사기**, **검토·승인 흐름(서버가 규칙 강제)**, **Canvas 카드 이미지 ZIP 내보내기**, (확장) **AI 원고 생성**

---

## 1. 실행 방법

### 준비물
- Node.js **22.9 이상** (개발: 24)
- Supabase 프로젝트 1개 (무료 플랜으로 충분)

### 1) 설치
```bash
npm install
```
`postinstall` 에서 `prisma generate` 가 함께 실행됩니다.

### 2) `.env` 만들기
`.env.example` 을 `.env` 로 복사한 뒤 값을 채웁니다. **`.env` 는 `.gitignore` 에 들어 있어 커밋되지 않습니다.**

```dotenv
# 앱 실행용: Supabase → Connect → Transaction pooler (포트 6543), 끝에 ?pgbouncer=true
DATABASE_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true"
# 마이그레이션용: Session pooler 또는 Direct (포트 5432)
DIRECT_URL="postgresql://postgres.PROJECT_REF:DB_PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
# 세션 쿠키 서명용 임의 문자열
SESSION_SECRET="node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" 로 만든 값"
```

DB 비밀번호는 아래 명령으로 넣으면 화면에 `*` 로만 보이고, 특수문자도 URL 인코딩되어 안전하게 들어갑니다(**영문 입력 상태**에서 입력).
```bash
npm run db:password
```

### 3) 테이블 만들기 (Prisma 마이그레이션)
```bash
npm run db:deploy        # 저장소의 prisma/migrations 를 그대로 적용 (처음 설치)
npm run db:check         # 연결 확인: 테이블별 행 수 출력
```
스키마를 바꿀 때는 `npm run db:migrate -- --name 변경이름` (= `prisma migrate dev`).

### 4) 서버 실행
```bash
npm start                # http://127.0.0.1:4317
npm run dev              # 파일이 바뀌면 자동 재시작
```
`PORT`, `HOST` 환경 변수로 바꿀 수 있습니다. 처음 접속하면 로그인 화면이 나오고, 회원가입 후 바로 쓸 수 있습니다.

### 5) (선택) 기존 로컬 데이터 가져오기
이전 버전의 `data/projects.json` 원고를 내 계정의 매거진으로 옮깁니다. 같은 원고는 다시 실행해도 중복으로 들어가지 않습니다.
```bash
npm run db:import -- --dry-run                 # 미리보기 (DB 에 쓰지 않음)
npm run db:import -- --email 내계정@example.com  # 먼저 회원가입한 계정으로
```

### 6) 테스트
```bash
npm test          # DB 없이 도는 단위·HTTP 테스트 (72개, 1초 이내)
npm run test:db   # 실제 DB + HTTP 통합 테스트: 승인 흐름·소유자 검사 (테스트 계정은 끝나면 삭제)
```

### 그 밖의 명령
| 명령 | 하는 일 |
|---|---|
| `npm run db:studio` | Prisma Studio 로 DB 보기 |
| `npm run legacy` | 개편 전 1인용 앱 실행 (포트 4318, `data/projects.json` 사용) |

---

## 2. 화면

| 화면 | 주소 | 내용 |
|---|---|---|
| 로그인 · 회원가입 | `/login.html`, `/signup.html` | 이메일 형식·비밀번호 8자 이상을 화면에서 먼저 안내하고 서버가 최종 검사. 로그인 후 원래 보던 화면으로 복귀 |
| 매거진 목록 | `/magazines.html` | 기존 보관함(책장) UI. 검색창(제목·키워드) + 상태·종류 필터 + 내 매거진만, 📖 3D 펼쳐보기 |
| 매거진 상세 | `/magazine.html?id=` | Canvas 카드 미리보기·썸네일·플립북, 캡션·출처·말투 점수. **본인 글일 때만** 수정·검토·내보내기·삭제 버튼 |
| 매거진 등록 · 수정 | `/edit.html`, `/edit.html?id=` | 기존 카드 편집실(미리보기·필름스트립·탭·실시간 말투 검사). 카드 추가·삭제·순서, 사진 올리기, 출처, 자동 저장. 새 매거진 화면에 **AI로 초안 만들기** |
| 검토 · 승인 | `/review.html?id=` | 단계 표시, **출처 확인 체크**, **상태 변경 버튼**, **승인 불가 사유**, 카드별 말투 지적 |
| 내보내기 | `/export.html?id=` | 1080×1350 JPG 미리보기 → ZIP(카드 + caption.txt). 승인 전에는 잠금 |

- 로그인하지 않고 위 화면(로그인·회원가입 제외)을 열면 서버가 `/login.html?next=원래주소` 로 보냅니다(`middlewares/pages.mjs`). API 가 401 을 받으면 화면도 로그인으로 이동합니다(`public/js/api.js`).
- 휴대폰 폭(375px)에서도 가로 스크롤 없이 쓸 수 있습니다.

---

## 3. 데이터 모델 (`prisma/schema.prisma`)

```
User 1 ──< N Magazine 1 ──< N Card
                      └──< N Source
```

| 모델 | 필드 |
|---|---|
| **User** | id, email(unique), password(bcrypt 해시), nickname, createdAt |
| **Magazine** | id, title(≤60), keyword, type(`CURATION`\|`ISSUE`), template, status(`DRAFT`\|`REVIEW`\|`APPROVED`\|`PUBLISHED`), caption, createdAt, updatedAt, authorId → User |
| **Card** | id, order, label, headline, body, footer, photoUrl, magazineId → Magazine (**onDelete: Cascade**) |
| **Source** | id, outlet, title, url, verified(boolean), magazineId → Magazine (**onDelete: Cascade**) |

요구사항 외에 추가한 필드 3개: 기존 Canvas 렌더러가 지금과 같은 카드를 그리는 데 필요합니다.
`Card.layout`(cover·story·type·end), `Magazine.theme`(paper·midnight·cobalt), `Magazine.category`(카드 머리글 라벨).

---

## 4. API

모든 오류는 `{ "message": "...", "code": "..." }` 형식입니다. 🔒 = 로그인 필요(아니면 401), 👤 = 작성자만(아니면 403 `NOT_OWNER`, 없으면 404).

### 인증
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/auth/signup` | `{email, password, nickname}` → 201 `{user}` (가입 후 바로 로그인). 중복 이메일 409 `EMAIL_TAKEN` |
| POST | `/auth/login` | `{email, password}` → 200 `{user}`. 틀리면 401 `INVALID_CREDENTIALS` |
| POST | `/auth/logout` 🔒 | 세션 삭제 + 쿠키 제거 |
| GET | `/auth/me` 🔒 | 로그인 사용자 `{user}` |

### 매거진
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/magazines` 🔒 | 목록. `?q=`(제목·키워드 검색) `?status=` `?type=` `?mine=1` `?page=` `?limit=` → `{total, page, limit, magazines[]}` (표지 카드 1장 + 개수, `isOwner`) |
| GET | `/api/magazines/:id` 🔒 | 상세(카드 순서대로·출처·작성자·`isOwner`) |
| POST | `/api/magazines` 🔒 | `{title, keyword, type?, template?, theme?, category?, caption?, cards[5~8], sources?}` → 201, 항상 DRAFT |
| PUT | `/api/magazines/:id` 🔒👤 | 일부 필드 수정 → `{magazine, reverted}`. `status`·`cards` 는 받지 않음 |
| DELETE | `/api/magazines/:id` 🔒👤 | 204 (카드·출처 함께 삭제) |

### 카드
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/magazines/:id/cards` 🔒👤 | 맨 뒤에 추가 → 201. 9장째는 400 `CARD_LIMIT` |
| PUT | `/api/cards/:id` 🔒👤 | 수정 |
| DELETE | `/api/cards/:id` 🔒👤 | 삭제 후 순서 재정렬. 4장이 되면 400 `CARD_LIMIT` |
| PATCH | `/api/magazines/:id/cards/order` 🔒👤 | `{cardIds:[...]}` 전체 카드를 원하는 순서로. 빠지거나 남의 카드면 400 `INVALID_ORDER` |

### 출처
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/magazines/:id/sources` 🔒👤 | `{outlet, title, url}` → 201, `verified=false` 로 시작 |
| PATCH | `/api/sources/:id` 🔒👤 | `{verified: true/false}`, 본문 없으면 토글 |
| DELETE | `/api/sources/:id` 🔒👤 | 삭제 |

### 고유 기능
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/magazines/:id/voice` 🔒 | 말투 검사: 카드별 지적 + 전체 0~100점 + 다음 단계·승인 불가 사유 |
| PATCH | `/api/magazines/:id/status` 🔒👤 | `{status}` 한 칸씩만. 400 `INVALID_TRANSITION` / `APPROVAL_BLOCKED` |
| POST | `/api/magazines/:id/export` 🔒👤 | `{images:[JPEG data URL…]}` → ZIP(`01.jpg`…, `caption.txt`). APPROVED 미만 403 `EXPORT_NOT_ALLOWED`, 장수·형식·크기 오류 400 `INVALID_EXPORT` |
| POST | `/api/uploads` 🔒 | 이미지 파일 그대로(Content-Type image/jpeg·png·webp) → 201 `{url:'/assets/<sha256>.jpg'}`. 실제 바이트로 형식 확인, 8MB 초과 413 |
| GET | `/api/ai/status` 🔒 | 이 서버 PC 에서 쓸 수 있는 AI 모델 |
| POST | `/api/ai/generate` 🔒 | `{keyword, model, count?, type?, template?, hook?}` → 202 `{job}`. 실행 중이면 409 `AI_BUSY`, 로그인 안 된 모델 503 `AI_UNAVAILABLE` |
| GET | `/api/ai/jobs/:id` 🔒 | 작업 상태 `running`·`done(magazineId)`·`error` (만든 사람만, 아니면 404) |
| GET | `/api/health` | 서버 동작 확인 |

공통: 잘못된 JSON 400 `INVALID_JSON`, 입력 검증 실패 400 `VALIDATION_ERROR`, 잘못된 id 400 `INVALID_ID`, 없는 경로 404 `NOT_FOUND`, DB 연결 실패 503 `DB_UNAVAILABLE`, 다른 사이트에서 보낸 변경 요청 403 `FORBIDDEN_ORIGIN`.

---

## 5. 고유 기능 규칙 (서버가 강제)

### 말투 검사기
`shared/voice.js` 하나를 **서버(`GET /voice`)와 브라우저(편집 중 실시간)가 같이 import** 합니다. 광고식 권유("~해보세요"), 예고하는 소개문, 빈 수식어, 뜬 비유("결·온도·여운"), 번역투, 면책 문구, 발매일·크레딧 나열, 긴 본문, 제목↔본문 중복, 문장 끝이 전부 "~요"인 경우 등을 카드마다 찾아 고치는 법과 함께 보여 주고 0~100점을 매깁니다.

### 검토·승인 흐름 (`shared/status-rules.js`)
1. `DRAFT → REVIEW → APPROVED → PUBLISHED` **한 칸씩 앞으로만**. 건너뛰기·되돌리기·제자리는 400 `INVALID_TRANSITION`.
2. **APPROVED 조건**: 출처 1개 이상 + 모든 출처 `verified=true`. 아니면 400 `APPROVAL_BLOCKED`(이유에 미확인 출처 이름). PUBLISHED 로 갈 때도 다시 확인.
3. **APPROVED 에서 내용을 고치면 자동으로 REVIEW**: 제목·캡션·키워드·템플릿 등 매거진 정보, 카드 추가·수정·삭제·순서, 출처 추가·삭제·확인 해제. 응답의 `reverted: true` 로 화면이 안내. 값이 실제로 안 바뀐 저장은 승인을 풀지 않음.
4. **PUBLISHED 는 수정 불가**(400 `PUBLISHED_LOCKED`), 삭제만 가능. 거부된 수정은 트랜잭션째 취소.
5. 같은 함수를 검토 화면도 import 해서 "승인 불가 사유"를 미리 보여 주지만, 최종 판단은 항상 서버.

### 카드 이미지 내보내기
브라우저가 기존 `public/renderer.js`(`drawCard`, 템플릿 6종·얼굴 중심 크롭 포함)로 1080×1350 JPG 를 그리고 → 서버가 **작성자·APPROVED 이상(본문을 읽기 전에 확인)**, 장수 = 카드 수, 실제 JPEG 인지, **SOF 마커에서 읽은 크기가 1080×1350 인지** 검사 → `01.jpg…0N.jpg + caption.txt` ZIP 으로 돌려줍니다.

### (확장) AI 원고 생성
기존 `lib/` 의 웹 조사·원고 작성(Codex / Claude Code CLI) → 셀프 리뷰 → 서버 규칙 검사 → 카드 5~8장 맞춤 → 곡별 사진 매칭을 그대로 쓰고, 결과를 **요청한 사용자의 매거진(DRAFT, 출처는 모두 미확인)** 으로 저장합니다. 한 번에 하나씩 실행합니다.
> **주의**: 이 서버 PC 에 로그인된 Codex(ChatGPT) / Claude Code **구독 CLI** 를 씁니다(API 키·추가 과금 없음). 다른 서버에 배포하면 AI 생성만 동작하지 않고, 나머지 기능은 그대로 동작합니다. Claude 는 `claude auth login`, ChatGPT 는 `AI 연결.cmd` 로 로그인합니다.

---

## 6. 요구사항 ↔ 구현 위치

| 요구사항 | 구현 위치 |
|---|---|
| Express 서버 (기존 직접 라우팅 전환) | `app.mjs`(앱 팩토리), `server.mjs`(실행), 기존 서버는 `legacy/server.mjs` |
| Prisma + Supabase | `prisma/schema.prisma`, `prisma/migrations/`, `services/prisma.mjs` |
| passport-local + express-session + bcrypt | `config/passport.mjs`, `config/session.mjs`, `services/user.service.mjs`(bcrypt 12) |
| HTML·CSS·JS + fetch | `public/*.html`, `public/js/*.js`(`api.js` 의 fetch 래퍼), `public/css/studio.css` |
| User·Magazine·Card·Source, 1:N, Cascade | `prisma/schema.prisma` |
| projects.json → DB 마이그레이션 스크립트 | `scripts/migrate-json.mjs`, `lib/legacy-map.mjs` (`npm run db:import`) |
| 폴더 분리 routes/controllers/middlewares/validators/services/prisma | 같은 이름 폴더. routes = 경로 연결만, controllers = 요청·응답, services = DB 접근 |
| 공통 에러 `{message, code}` + 404 | `middlewares/error.mjs`, `lib/http-error.mjs` |
| 입력 검증 (이메일, 비밀번호 8자, 제목 1~60, 카드 5~8, url, status·type) | `validators/auth.validator.mjs`, `validators/magazine.validator.mjs`, `validators/common.mjs`, `lib/rules.mjs` |
| isLoggedIn / isOwner (남의 데이터 403) | `middlewares/auth.mjs` |
| 인증 API 4개 | `routes/auth.routes.mjs`, `controllers/auth.controller.mjs` |
| 매거진 API (검색·필터·mine) | `routes/magazine.routes.mjs`, `controllers/magazine.controller.mjs`, `services/magazine.service.mjs` |
| 카드 API (순서 변경 포함) | `routes/card.routes.mjs`, `controllers/card.controller.mjs`, `services/card.service.mjs` |
| 출처 API (verified 토글) | `routes/source.routes.mjs`, `controllers/source.controller.mjs`, `services/source.service.mjs` |
| 말투 검사기 공용 모듈 + `GET /voice` | `shared/voice.js`, `shared/magazine-content.js`, `controllers/review.controller.mjs` |
| 검토·승인 흐름 `PATCH /status`, 승인 조건, 수정 시 REVIEW | `shared/status-rules.js`, `services/magazine.service.mjs`(`changeStatus`, `beginEdit`/`finishEdit`) |
| 카드 이미지 ZIP 내보내기 (APPROVED 이상, 아니면 403) | `controllers/export.controller.mjs`, `lib/export.mjs`, `lib/images.mjs`, `public/js/export.js` |
| (확장) AI 원고 생성 → DB 저장 | `services/ai.service.mjs`, `controllers/ai.controller.mjs`, `routes/ai.routes.mjs`, `public/js/edit.js` |
| 화면 6개 + 비로그인 리다이렉트 + 본인 글 아닌 경우 버튼 숨김 | `public/*.html`, `middlewares/pages.mjs`, `public/js/magazine.js`(`isOwner`) |
| 기존 템플릿 6종·Canvas 렌더러·3D 책넘김 재사용 | `public/templates.js`, `public/template-renderer.js`, `public/renderer.js`, `public/js/flipbook.js`(기존 `insta-ui.js` 의 openBook), `public/js/cards.js` |
| .env 에만 비밀 정보, .gitignore | `.env.example`, `.gitignore`, `scripts/set-db-password.mjs` |
| 테스트: 승인 흐름 규칙·소유자 검사 | `tests/status.test.mjs`, `tests/magazine.test.mjs`(isOwner), `tests/db/flow.db.test.mjs`(실제 DB) |

---

## 7. 폴더 구조

```
app.mjs, server.mjs          Express 앱 / 실행
config/                      passport, session 설정
routes/                      경로 연결만
controllers/                 요청 → 서비스 호출 → 응답
services/                    DB 접근(Prisma), 사진 저장, AI 작업
middlewares/                 auth(isLoggedIn·isOwner), error, security, pages
validators/                  입력 검증
shared/                      서버·브라우저 공용: 말투 검사기, 승인 규칙, DB→원고 변환
lib/                         규칙 상수, 에러, 내보내기, 기존 AI·렌더링 관련 모듈
prisma/                      스키마, 마이그레이션
public/                      화면(HTML·CSS·JS), 렌더러, 템플릿, 폰트
scripts/                     DB 확인, 비밀번호 입력, projects.json 가져오기
tests/                       단위·HTTP 테스트 (tests/db: 실제 DB 통합 테스트)
legacy/                      개편 전 1인용 앱(서버·화면·README) — npm run legacy
```

---

## 8. 보안 메모

- 비밀번호는 bcrypt 해시만 저장하고 응답·세션·로그에 싣지 않습니다. 없는 이메일과 틀린 비밀번호는 같은 메시지·비슷한 시간으로 응답합니다.
- 세션 쿠키: `httpOnly`, `SameSite=Lax`, 운영(`NODE_ENV=production`)에서는 `secure`. 로그인할 때 세션 id 를 새로 발급합니다.
- 상태를 바꾸는 요청은 같은 출처(Origin)만 허용합니다(CSRF 방어). CSP·`X-Frame-Options` 등 기존 보안 헤더 유지.
- 사용자 입력은 화면에 넣을 때 모두 escape 합니다. 사진은 확장자가 아니라 실제 바이트로 형식을 확인하고, 내용 해시를 파일 이름으로 씁니다.
- DB 접속 정보·세션 시크릿은 `.env` 에만 둡니다. DB 연결 오류는 접속 주소를 응답·로그에 남기지 않습니다.
- Supabase 프로젝트는 **Data API 를 끈 상태**로 만들었습니다(테이블이 공개 REST API 로 노출되지 않음).

## 9. 알려진 한계

- **세션 저장소는 메모리(MemoryStore)** 라서 서버를 재시작하면 다시 로그인해야 합니다. 서버 한 대에서 쓰는 수업용 구성입니다.
- AI 작업 상태도 메모리에 있어서, 서버 재시작 시 진행 중이던 작업 정보는 사라집니다(만들어진 매거진은 DB 에 남음).
- 업로드한 사진은 서버 디스크(`data/assets/`)에 저장됩니다. 여러 서버로 배포하려면 Supabase Storage 같은 공용 저장소가 필요합니다.
- `npm audit` 의 high 3건은 개발용 `prisma` CLI 의 설정 로더(`deepmerge-ts`)에서 나오며, 앱 실행 코드에는 포함되지 않습니다. 고치려면 Prisma 7 로 올려야 해서(설정 방식 변경) 6 을 유지했습니다.
- 프로젝트 폴더가 OneDrive 안에 있으면 `node_modules` 까지 동기화되어 느려질 수 있습니다.

## 10. 개편하면서 빠지거나 바뀐 기능

[`docs/changes-from-legacy.md`](docs/changes-from-legacy.md) 에 정리했습니다. 개편 전 버전은 git `main` 브랜치 첫 커밋, `backup/2026-11-04-before-final/`, `npm run legacy` 로 그대로 볼 수 있습니다.

## 출처 · 라이선스

- 카드 글꼴: [Pretendard](https://github.com/orioncactus/pretendard) v1.3.9 (SIL OFL, `public/assets/Pretendard-LICENSE.txt`)
- 얼굴 인식 크롭: MediaPipe Tasks Vision (`public/vendor/mediapipe/LICENSE.txt`)
- 카드 사진은 사용 권한을 확인한 뒤 게시하세요. 공개 열람 가능과 재사용 허가는 다릅니다.

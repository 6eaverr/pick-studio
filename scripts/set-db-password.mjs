// .env 의 DB 주소에 Supabase DB 비밀번호를 넣습니다.
//   npm run db:password
// - 입력한 글자는 화면에 * 로만 보이고, 어디에도 출력·기록하지 않습니다.
// - 특수문자가 있어도 주소가 깨지지 않게 URL 인코딩해서 넣습니다.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = '.env';
const PLACEHOLDERS = ['[YOUR-PASSWORD]', 'DB_PASSWORD'];
const KEYS = ['DATABASE_URL', 'DIRECT_URL'];

function askHidden(question) {
  return new Promise(resolve => {
    const input = process.stdin;
    if (!input.isTTY) { console.error('터미널에서 직접 실행해 주세요.'); process.exit(1); }
    process.stdout.write(question);
    let value = '';
    input.setRawMode(true); input.setEncoding('utf8'); input.resume();
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          input.setRawMode(false); input.pause(); input.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') { process.stdout.write('\n취소했습니다.\n'); process.exit(130); } // Ctrl+C
        if (ch === '\u007f' || ch === '\b') { if (value) { value = value.slice(0, -1); process.stdout.write('\b \b'); } continue; }
        if (ch < ' ') continue;
        value += ch; process.stdout.write('*');
      }
    };
    input.on('data', onData);
  });
}

let env;
try { env = readFileSync(FILE, 'utf8'); } catch { console.error('.env 파일이 없습니다. 프로젝트 폴더에서 실행하세요.'); process.exit(1); }

const lines = env.split(/\r?\n/);
// postgresql://사용자:비밀번호@호스트 의 비밀번호 부분 (예시 문구든, 이전에 넣은 값이든 새 값으로 바꿉니다)
const PASSWORD_PART = /^(\w+="?postgres(?:ql)?:\/\/[^:/@]+:)([^@]*)(@)/;
const targets = lines.map((l, i) => ({ l, i })).filter(({ l }) => KEYS.some(k => l.startsWith(k + '=')) && PASSWORD_PART.test(l));
if (!targets.length) { console.error('.env 에서 DATABASE_URL / DIRECT_URL 주소를 찾지 못했습니다.'); process.exit(1); }
const replacing = targets.some(({ l }) => !PLACEHOLDERS.some(p => l.includes(p)));
if (replacing) console.log('이미 들어 있는 비밀번호를 새 값으로 바꿉니다.');

const pw = await askHidden('Supabase DB 비밀번호: ');
if (!pw) { console.error('비어 있습니다. 다시 실행하세요.'); process.exit(1); }
const again = await askHidden('한 번 더 입력: ');
if (pw !== again) { console.error('두 번 입력한 값이 다릅니다. 다시 실행하세요.'); process.exit(1); }

const encoded = encodeURIComponent(pw);
for (const { i } of targets) {
  lines[i] = lines[i].replace(PASSWORD_PART, (_, head, _old, at) => head + encoded + at);
}
writeFileSync(FILE, lines.join('\n'));
console.log(`저장했습니다 (${targets.length}줄). 이제 Claude에게 "넣었어"라고 알려 주세요.`);

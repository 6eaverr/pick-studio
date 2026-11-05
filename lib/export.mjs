// 카드 이미지 내보내기 규칙 (DB 없이 테스트할 수 있는 순수 함수)
// 브라우저가 기존 renderer.js(drawCard)로 그린 1080×1350 JPG 를 보내면, 서버가 하나씩 검사한 뒤 ZIP 으로 묶습니다.
import { makeZip } from './zip.mjs';
import { jpegSize } from './images.mjs';
import { badRequest } from './http-error.mjs';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const MAX_IMAGE = 8 * 1024 * 1024;
const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/;

// images: data:image/jpeg;base64,... 배열 → Buffer 배열. 문제가 있으면 400 INVALID_EXPORT
export function decodeExportImages(images, cardCount) {
  const fail = message => badRequest(message, 'INVALID_EXPORT');
  if (!Array.isArray(images)) throw fail('images 배열이 필요합니다.');
  if (images.length !== cardCount) throw fail(`카드 ${cardCount}장의 이미지가 모두 필요합니다(받은 이미지 ${images.length}장).`);
  return images.map((v, i) => {
    const m = typeof v === 'string' && v.match(DATA_URL);
    if (!m) throw fail(`${i + 1}장: JPEG 이미지(data URL)만 받을 수 있습니다.`);
    const bytes = Buffer.from(m[1], 'base64');
    if (bytes.length > MAX_IMAGE) throw fail(`${i + 1}장: 이미지가 8MB를 넘습니다.`);
    const size = jpegSize(bytes);
    if (!size) throw fail(`${i + 1}장: JPEG 파일을 읽을 수 없습니다.`);
    if (size.width !== CARD_WIDTH || size.height !== CARD_HEIGHT) throw fail(`${i + 1}장: 카드 크기는 ${CARD_WIDTH}×${CARD_HEIGHT} 이어야 합니다(받은 크기 ${size.width}×${size.height}).`);
    return bytes;
  });
}

// ZIP 구성: 01.jpg … 0N.jpg + caption.txt
export function buildExportZip(magazine, jpegs) {
  const files = jpegs.map((bytes, i) => [`${String(i + 1).padStart(2, '0')}.jpg`, bytes]);
  files.push(['caption.txt', Buffer.from(String(magazine.caption || '').replace(/\r?\n/g, '\r\n'), 'utf8')]);
  return makeZip(files);
}

// 다운로드 파일 이름: pick-<id>-<제목>.zip (윈도 파일명에 못 쓰는 문자 제거)
export function exportFileName(magazine) {
  const safe = String(magazine.title || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return `pick-${magazine.id}${safe ? '-' + safe : ''}.zip`;
}

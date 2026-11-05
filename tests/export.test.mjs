import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeExportImages, buildExportZip, exportFileName } from '../lib/export.mjs';
import { jpegSize } from '../lib/images.mjs';
import { saveImage } from '../services/asset.service.mjs';

// 최소 JPEG 머리(SOI + APP0 + SOF0)로 가로·세로만 담은 가짜 JPEG
function fakeJpeg(width, height) {
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Buffer.from([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}
const dataUrl = buf => `data:image/jpeg;base64,${buf.toString('base64')}`;
const card = () => dataUrl(fakeJpeg(1080, 1350));
const E = { status: 400, code: 'INVALID_EXPORT' };

test('jpegSize: SOF 마커에서 가로·세로를 읽는다', () => {
  assert.deepEqual(jpegSize(fakeJpeg(1080, 1350)), { width: 1080, height: 1350 });
  assert.equal(jpegSize(Buffer.from('not a jpeg')), null);
});

test('내보내기: 카드 수만큼의 1080×1350 JPEG 만 통과', () => {
  const out = decodeExportImages([card(), card(), card(), card(), card()], 5);
  assert.equal(out.length, 5);
  assert.ok(Buffer.isBuffer(out[0]));
});

test('내보내기: 장수가 다르면 거부', () => {
  assert.throws(() => decodeExportImages([card(), card()], 5), E);
  assert.throws(() => decodeExportImages(undefined, 5), E);
});

test('내보내기: JPEG 가 아니거나 크기가 다르면 거부', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.throws(() => decodeExportImages([png, card(), card(), card(), card()], 5), E);
  assert.throws(() => decodeExportImages([dataUrl(fakeJpeg(1080, 1080)), card(), card(), card(), card()], 5), { message: /1080×1350/ });
  assert.throws(() => decodeExportImages([dataUrl(Buffer.from('garbage')), card(), card(), card(), card()], 5), E);
});

test('ZIP: 01.jpg~ 순서 + caption.txt', () => {
  const zip = buildExportZip({ caption: '첫 줄\n둘째 줄' }, [fakeJpeg(1080, 1350), fakeJpeg(1080, 1350)]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50); // ZIP 시그니처
  const text = zip.toString('latin1');
  assert.ok(text.includes('01.jpg') && text.includes('02.jpg') && text.includes('caption.txt'));
  assert.ok(zip.includes(Buffer.from('첫 줄\r\n둘째 줄', 'utf8')));
});

test('파일 이름: 윈도에서 못 쓰는 문자 제거', () => {
  assert.equal(exportFileName({ id: 3, title: 'A/B: "C"?' }), 'pick-3-AB C.zip');
  assert.equal(exportFileName({ id: 4, title: '' }), 'pick-4.zip');
});

test('사진 업로드: 이미지가 아니면 400 INVALID_IMAGE (파일 저장 안 함)', () => {
  assert.throws(() => saveImage(Buffer.from('hello')), { status: 400, code: 'INVALID_IMAGE' });
  assert.throws(() => saveImage(Buffer.alloc(0)), { code: 'INVALID_IMAGE' });
  assert.throws(() => saveImage({}), { code: 'INVALID_IMAGE' });
});

// 이미지 파일 검사 (확장자·Content-Type 이 아니라 실제 바이트로 판단)
import { imageType } from './network.mjs';

export { imageType };

// JPEG 의 실제 가로·세로 (SOF 마커). JPEG 이 아니거나 읽을 수 없으면 null
export function jpegSize(bytes) {
  if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = bytes.readUInt16BE(i + 2);
    // SOF0~SOF15 (DHT·JPG·DAC 제외)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

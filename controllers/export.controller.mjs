import { getMagazine } from '../services/magazine.service.mjs';
import { decodeExportImages, buildExportZip, exportFileName } from '../lib/export.mjs';
import { canExport } from '../shared/status-rules.js';
import { forbidden, notFound } from '../lib/http-error.mjs';

// 본문을 읽기 전에 상태부터 확인: APPROVED·PUBLISHED 가 아니면 403 (큰 이미지 본문을 받지 않음)
export function requireExportable(req, res, next) {
  if (!canExport(req.magazine.status)) {
    return next(forbidden('승인 완료(APPROVED) 이후의 매거진만 내보낼 수 있습니다. 검토·승인을 먼저 진행하세요.', 'EXPORT_NOT_ALLOWED'));
  }
  next();
}

// POST /api/magazines/:id/export  { images: ['data:image/jpeg;base64,...', ...] } → ZIP 파일
export async function exportZip(req, res) {
  const magazine = await getMagazine(req.magazine.id);
  if (!magazine) throw notFound('매거진을 찾을 수 없습니다.');
  // 이미지를 그리는 동안 상태가 바뀌었을 수 있으니 한 번 더 확인
  if (!canExport(magazine.status)) throw forbidden('승인 완료(APPROVED) 이후의 매거진만 내보낼 수 있습니다.', 'EXPORT_NOT_ALLOWED');
  const jpegs = decodeExportImages(req.body?.images, magazine.cards.length);
  const zip = buildExportZip(magazine, jpegs);
  const name = exportFileName(magazine);
  res.set({
    'Content-Type': 'application/zip',
    'Content-Length': zip.length,
    'Content-Disposition': `attachment; filename="pick-${magazine.id}.zip"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'no-store',
  });
  res.end(zip);
}

import { saveImage, findImage, ASSET_NAME_RE } from '../services/asset.service.mjs';

// POST /api/uploads  (본문 = 이미지 파일 그대로, Content-Type: image/jpeg|png|webp) → 201 { url }
export async function upload(req, res) {
  const url = await saveImage(req.body);
  res.status(201).json({ url });
}

// GET /assets/:name  — DB 에 저장된 카드 사진. 이름이 내용 해시라 내용이 바뀌지 않으므로 오래 캐시.
// DB 에 없으면 다음 단계(로컬 data/assets → public/assets 로고·글꼴)로 넘김
export async function serveAsset(req, res, next) {
  if (!ASSET_NAME_RE.test(req.params.name) || !process.env.DATABASE_URL) return next();
  try {
    const asset = await findImage(req.params.name);
    if (!asset) return next();
    res.set({ 'Content-Type': asset.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'Content-Length': asset.bytes.length });
    res.end(Buffer.from(asset.bytes));
  } catch {
    next();
  }
}

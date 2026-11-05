import { saveImage } from '../services/asset.service.mjs';

// POST /api/uploads  (본문 = 이미지 파일 그대로, Content-Type: image/jpeg|png|webp) → 201 { url }
export function upload(req, res) {
  const url = saveImage(req.body);
  res.status(201).json({ url });
}

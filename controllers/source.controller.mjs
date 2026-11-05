import * as sources from '../services/source.service.mjs';
import { pick } from '../validators/common.mjs';

// POST /api/magazines/:id/sources → 201 (verified=false 로 시작)
export async function create(req, res) {
  res.status(201).json(await sources.addSource(req.magazine.id, pick(req.body, ['outlet', 'title', 'url'])));
}

// PATCH /api/sources/:id  { verified?: boolean } — 생략하면 토글
export async function patch(req, res) {
  res.json(await sources.setVerified(req.source.id, req.source.magazineId, req.body?.verified));
}

// DELETE /api/sources/:id → 200 { magazine }
export async function remove(req, res) {
  res.json(await sources.deleteSource(req.source.id, req.source.magazineId));
}

import { ai } from '../services/ai.service.mjs';

// GET /api/ai/status → 사용 가능한 모델 (서버 PC 의 Claude Code / Codex 로그인 상태)
export async function status(req, res) {
  res.json(await ai.status());
}

// POST /api/ai/generate → 202 { job }  (뒤에서 진행, /api/ai/jobs/:id 로 확인)
export async function generate(req, res) {
  const { keyword, model, count = 6, type = 'CURATION', template = 'playlist', hook = 'balanced' } = req.body;
  const job = await ai.start(req.user.id, { keyword: keyword.trim(), model, count, type, template, hook });
  res.status(202).location(`/api/ai/jobs/${job.id}`).json({ job });
}

// GET /api/ai/jobs/:id → { job }  (status: running | done(magazineId) | error)
export function job(req, res) {
  res.json({ job: ai.get(req.user.id, req.params.id) });
}

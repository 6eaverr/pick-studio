// 서버 동작 확인용
export function health(req, res) {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
}

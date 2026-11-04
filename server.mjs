import { createApp } from './app.mjs';

const port = Number(process.env.PORT) || 4317;
const host = process.env.HOST || '127.0.0.1';

createApp().listen(port, host, err => {
  if (err) {
    console.error(err.code === 'EADDRINUSE' ? `포트 ${port}가 이미 사용 중입니다. 실행 중인 PICK Studio를 종료하거나 PORT를 바꾸세요.` : err.message);
    process.exit(1);
  }
  console.log(`PICK Studio: http://${host}:${port}`);
});

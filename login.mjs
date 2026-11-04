import {connectAI} from './lib/login.mjs';
try{
  process.exitCode=await connectAI({statusOnly:process.argv.includes('--status'),device:process.argv.includes('--device-auth')});
}catch(error){
  console.error(`AI 연결 오류: ${error.message}`);
  process.exitCode=1;
}

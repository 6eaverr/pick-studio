import {spawn} from 'node:child_process';
import {findCodex,codexStatus} from './codex.mjs';

export async function connectAI({status=codexStatus,run=runLogin,log=console.log,statusOnly=false,device=false}={}){
  const before=await status();
  if(!before.installed){log('연결 실패: Codex 실행 프로그램을 찾을 수 없습니다. Codex 설치 상태를 확인해주세요.');return 1;}
  if(before.loggedIn&&before.method==='ChatGPT'){
    log('AI 연결 완료: ChatGPT 계정이 연결되어 있습니다. PICK의 연결 설정에서 상태를 새로고침하세요.');return 0;
  }
  if(statusOnly){log(before.loggedIn?'현재 API 키 방식입니다. AI 연결.cmd로 ChatGPT 로그인을 진행하세요.':'아직 AI에 연결되지 않았습니다. AI 연결.cmd를 실행해 로그인하세요.');return 1;}
  log('ChatGPT 로그인을 시작합니다. 브라우저에서 로그인이 끝날 때까지 이 창을 닫지 마세요.');
  log('브라우저가 열리지 않으면 아래에 표시되는 로그인 주소를 복사해 열어주세요.');
  if(device)log('기기 코드 로그인은 ChatGPT 보안 설정에서 허용되어 있어야 합니다.');
  const result=await run(device);
  if(result.error){log(`로그인 프로그램 실행 실패: ${result.error.message}`);return 1;}
  if(result.code!==0){log(`로그인이 완료되지 않았습니다 (종료 코드: ${result.code??'중단'}). 위 오류를 확인해주세요.`);return 1;}
  const after=await status();
  if(!after.loggedIn||after.method!=='ChatGPT'){
    log('로그인 창은 종료되었지만 ChatGPT 연결을 확인하지 못했습니다. 다시 로그인해주세요.');return 1;
  }
  log('AI 연결 완료: PICK의 연결 설정에서 상태를 새로고침한 뒤 키워드를 입력하세요.');return 0;
}

function runLogin(device){
  return new Promise(resolve=>{
    const child=spawn(findCodex(),device?['login','--device-auth']:['login'],{stdio:'inherit',windowsHide:false});
    child.once('error',error=>resolve({error}));
    child.once('close',code=>resolve({code}));
  });
}

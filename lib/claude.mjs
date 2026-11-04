import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { makePrompt, schema, validateContent } from './content.mjs';
const exec=promisify(execFile);
// UI 모델 값 → Claude Code CLI 별칭. 별칭은 계정에서 쓸 수 있는 최신 모델로 연결됩니다.
export const claudeModels={'claude-opus':'opus','claude-sonnet':'sonnet','claude-haiku':'haiku'};
export function findClaude(){
  if(process.env.PICK_CLAUDE_PATH&&existsSync(process.env.PICK_CLAUDE_PATH))return process.env.PICK_CLAUDE_PATH;
  const candidates=[
    path.join(process.env.APPDATA||'','npm','node_modules','@anthropic-ai','claude-code','bin','claude.exe'),
    path.join(process.env.USERPROFILE||'','.local','bin','claude.exe'),
    path.join(process.env.LOCALAPPDATA||'','Programs','claude','claude.exe'),
  ];
  return candidates.find(existsSync)||(process.platform==='win32'?'claude.exe':'claude');
}
// 구독 로그인만 사용하도록 API 키 환경 변수를 제거합니다. 예상치 못한 API 과금을 막기 위함입니다.
function subscriptionEnv(){const env={...process.env};delete env.ANTHROPIC_API_KEY;delete env.ANTHROPIC_AUTH_TOKEN;return env;}
export async function claudeStatus(){
  try{
    const {stdout}=await exec(findClaude(),['auth','status'],{windowsHide:true,timeout:15000,env:subscriptionEnv()});
    const s=JSON.parse(stdout);
    return {installed:true,loggedIn:s.loggedIn===true,method:s.authMethod==='claude.ai'?'Claude 구독':(s.authMethod||'unknown'),plan:s.subscriptionType||''};
  }catch(e){return {installed:e.code!=='ENOENT',loggedIn:false,method:'unknown',plan:''};}
}
async function assertReady(){
  const status=await claudeStatus();
  if(!status.installed)throw new Error('Claude Code를 찾을 수 없습니다. 설치 후 다시 시도하거나 PICK_CLAUDE_PATH에 claude.exe 경로를 설정하세요.');
  if(!status.loggedIn)throw new Error('Claude 로그인이 필요합니다. 터미널에서 claude auth login 을 실행해 Claude 계정으로 로그인하세요.');
  if(status.method!=='Claude 구독')throw new Error('Claude가 구독 계정이 아닌 방식으로 연결되어 있습니다. 추가 API 비용 없이 사용하려면 claude auth login 으로 Claude 계정에 로그인하세요.');
}
export function claudeArgs(alias,outputSchema,tools){
  if(!Object.values(claudeModels).includes(alias))throw new Error('지원하지 않는 AI 모델입니다.');
  return ['-p','--model',alias,'--output-format','stream-json','--verbose','--json-schema',JSON.stringify(outputSchema),
    '--tools',tools.join(','),...(tools.length?['--allowedTools',tools.join(',')]:[]),'--permission-mode','dontAsk',
    '--no-session-persistence','--setting-sources',''];
}
// Claude Code를 비대화형으로 한 번 실행하고 구조화 출력(JSON)을 돌려줍니다.
export async function runClaude({prompt,outputSchema,alias='sonnet',tools=[],cwd,timeoutMs=600000,onEvent=()=>{}}){
  await assertReady();
  return new Promise((resolve,reject)=>{
    const proc=spawn(findClaude(),claudeArgs(alias,outputSchema,tools),{cwd,windowsHide:true,stdio:['pipe','pipe','pipe'],env:subscriptionEnv()});
    let buffer='',stderr='',result=null,ended=false;
    const timer=setTimeout(()=>{proc.kill();finish(new Error(`작업이 ${Math.round(timeoutMs/60000)}분을 초과했습니다. 다시 시도하세요.`));},timeoutMs);
    function finish(err,value){if(ended)return;ended=true;clearTimeout(timer);err?reject(err):resolve(value);}
    proc.on('error',()=>finish(new Error('Claude Code를 실행하지 못했습니다. 설치와 로그인 상태를 확인하세요.')));
    proc.stdout.on('data',b=>{
      buffer+=b.toString();const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){try{const event=JSON.parse(line);if(event.type==='result')result=event;else onEvent(event);}catch{}}
      if(buffer.length>1000000)buffer='';
    });
    proc.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-2000);});
    proc.on('close',code=>{
      if(ended)return;
      if(!result||result.is_error||result.subtype!=='success'){
        const detail=(typeof result?.result==='string'&&result.result)||stderr.trim();
        return finish(new Error(`Claude 실행에 실패했습니다. 사용량·로그인·네트워크를 확인하고 다시 시도하세요.${detail?` (${detail.slice(0,200)})`:''}${code?` [종료 코드 ${code}]`:''}`));
      }
      try{finish(null,result.structured_output??JSON.parse(result.result));}catch(e){finish(new Error(`결과를 읽지 못했습니다: ${e.message}`));}
    });
    proc.stdin.on('error',()=>{});proc.stdin.end(prompt);
  });
}
export async function generate(keyword,count,mode,model,workdir,onProgress,template='classic',hook='balanced',guide=null){
  const alias=claudeModels[model];if(!alias)throw new Error('지원하지 않는 AI 모델입니다.');
  let searches=0;
  const raw=await runClaude({prompt:makePrompt(keyword,count,mode,template,hook,guide),outputSchema:schema,alias,tools:['WebSearch','WebFetch'],cwd:workdir,onEvent:event=>{
    if(event.type==='system'&&event.subtype==='init')onProgress('자료를 조사하고 카드 원고를 작성하고 있습니다…');
    else if(event.type==='assistant')for(const part of event.message?.content||[]){
      if(part.type==='tool_use'&&part.name==='WebSearch'){searches++;onProgress(`자료·유행어·사진을 검색하고 있습니다… (${searches}회)`);}
      else if(part.type==='tool_use'&&part.name==='WebFetch')onProgress('원문 페이지를 열어 확인하고 있습니다…');
    }
  }}).catch(e=>{throw new Error(e.message.replace('Claude 실행에','Claude 생성에'));});
  try{
    const content=validateContent(raw);
    if(!content.sources.length)throw new Error('확인 가능한 원문 출처를 찾지 못했습니다. 더 구체적인 키워드로 시도하세요.');
    return content;
  }catch(e){throw new Error(`원고를 불러오지 못했습니다: ${e.message}`);}
}

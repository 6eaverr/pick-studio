import { execFile, spawn } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { makePrompt, schema, validateContent } from './content.mjs';
const exec=promisify(execFile);
export function findCodex(){
  if(process.env.PICK_CODEX_PATH&&existsSync(process.env.PICK_CODEX_PATH))return process.env.PICK_CODEX_PATH;
  const root=path.join(process.env.LOCALAPPDATA||'', 'OpenAI','Codex','bin');
  if(existsSync(root)){const found=readdirSync(root).map(n=>path.join(root,n,'codex.exe')).filter(existsSync);if(found.length)return found.sort().at(-1);}
  return process.platform==='win32'?'codex.exe':'codex';
}
export async function codexStatus(){try{const {stdout,stderr}=await exec(findCodex(),['login','status'],{windowsHide:true,timeout:10000});const text=stdout+stderr;return {installed:true,loggedIn:/logged in/i.test(text)&&!/not logged in/i.test(text),method:/ChatGPT/i.test(text)?'ChatGPT':/API key/i.test(text)?'API key':'unknown'};}catch(e){return{installed:e.code!=='ENOENT',loggedIn:false,method:'unknown'};}}
export function execArgs(model,schemaFile,out){
  if(!['gpt-6-astra','gpt-5.6-terra','gpt-5.6-luna'].includes(model))throw new Error('지원하지 않는 AI 모델입니다.');
  return ['--search','-a','never','exec','-m',model,'--skip-git-repo-check','--ephemeral','--sandbox','read-only','--color','never','--json','--output-schema',schemaFile,'-o',out,'-'];
}
export async function generate(keyword,count,mode,model,workdir,onProgress,template='classic',hook='balanced',guide=null){
  const status=await codexStatus();
  if(!status.loggedIn)throw new Error('Codex 로그인이 필요합니다. 앱의 연결 설정에서 로그인 방법을 확인하거나 ChatGPT/Gemini 원고 가져오기를 사용하세요.');
  if(status.method==='API key')throw new Error('현재 Codex가 API 키로 연결되어 있습니다. 추가 API 비용 없이 사용하려면 ChatGPT 계정으로 로그인하세요.');
  const dir=path.join(workdir,randomUUID());mkdirSync(dir,{recursive:true});
  const schemaFile=path.join(dir,'schema.json'),out=path.join(dir,'result.json');writeFileSync(schemaFile,JSON.stringify(schema));
  return new Promise((resolve,reject)=>{
    const args=execArgs(model,schemaFile,out);
    const proc=spawn(findCodex(),args,{cwd:dir,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let buffer='',ended=false;const timer=setTimeout(()=>{proc.kill();finish(new Error('조사가 10분을 초과했습니다. 키워드를 좁혀 다시 시도하세요.'));},600000);
    function finish(err,value){if(ended)return;ended=true;clearTimeout(timer);try{rmSync(dir,{recursive:true,force:true});}catch{}err?reject(err):resolve(value);}
    proc.on('error',()=>finish(new Error('Codex를 실행하지 못했습니다. 설치와 로그인 상태를 확인하세요.')));
    proc.stdout.on('data',b=>{buffer+=b.toString();const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines){try{const event=JSON.parse(line);if(event.item?.type==='web_search')onProgress('자료와 요즘 유행하는 말을 검색하고 있습니다…');else if(event.type==='turn.started')onProgress('자료를 조사하고 카드 원고를 작성하고 있습니다…');}catch{}}if(buffer.length>100000)buffer='';});
    proc.stderr.on('data',()=>{});
    proc.on('close',code=>{if(ended)return;if(code!==0)return finish(new Error('Codex 생성에 실패했습니다. 사용량·로그인·네트워크를 확인하고 다시 시도하세요.'));try{const content=validateContent(JSON.parse(readFileSync(out,'utf8')));if(!content.sources.length)throw new Error('확인 가능한 원문 출처를 찾지 못했습니다. 더 구체적인 키워드로 시도하세요.');finish(null,content);}catch(e){finish(new Error(`원고를 불러오지 못했습니다: ${e.message}`));}});
    proc.stdin.on('error',()=>{});proc.stdin.end(makePrompt(keyword,count,mode,template,hook,guide));
  });
}

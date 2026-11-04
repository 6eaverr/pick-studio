import http from 'node:http';
import { readFileSync,writeFileSync,existsSync,mkdirSync,renameSync,readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { newProject,revise,approve,assertApproved,makePrompt,cleanText,safeURL,hookLevels,finalCaption } from '../lib/content.mjs';
import { makeZip } from '../lib/zip.mjs';
import {normalizeTemplate} from '../public/templates.js';
import { codexStatus,generate as generateCodex } from '../lib/codex.mjs';
import { claudeStatus,claudeModels,generate as generateClaude } from '../lib/claude.mjs';
import { createLearning,snapshotOrigin,cleanFeedback } from '../lib/learning.mjs';
import { createInstaWeb } from '../lib/insta-web.mjs';
import { matchPhotos } from '../lib/photos.mjs';
import { reviewCards } from '../lib/review.mjs';
import { runClaude } from '../lib/claude.mjs';
import { loadBrief, isStale, refreshBrief, briefRunning } from '../lib/trend-brief.mjs';
import { loadLibrary, isStale as referenceStale, refreshLibrary, referenceRunning, addSample, removeSample } from '../lib/reference.mjs';
import { syncMemory, buildRecord, memorySummary } from '../lib/editor-memory.mjs';
import { tryLock, unlock } from '../lib/shared.mjs';
let briefError='',referenceError='';
// 트렌드 브리핑(3일)·레퍼런스 노트(7일)가 오래됐으면 뒤에서 차례로 새로 조사(릴스 앱과 공유, 두 앱이 켜져 있어도 한 번만)
async function freshen(){
  if(process.env.PICK_NO_AUTO_RESEARCH)return;
  const s=await claudeStatus().catch(()=>null);if(!s?.loggedIn||s.method!=='Claude 구독')return;
  const dir=path.join(DATA,'jobs');
  if(!briefRunning()&&isStale(loadBrief())&&tryLock('trend-brief')){await refreshBrief(runClaude,dir).then(()=>{briefError='';},e=>{briefError=e.message;});unlock('trend-brief');}
  if(!referenceRunning()&&referenceStale(loadLibrary())&&tryLock('reference')){await refreshLibrary(runClaude,dir).then(()=>{referenceError='';},e=>{referenceError=e.message;});unlock('reference');}
}
const freshenBrief=()=>{freshen().catch(()=>{});};
const instaWeb=createInstaWeb();
const codexModels=['gpt-6-astra','gpt-5.6-terra','gpt-5.6-luna'];
import { downloadImage,imageType } from '../lib/network.mjs';
import { instagramConfig,publishCarousel,graph } from '../lib/instagram.mjs';

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const DATA=process.env.PICK_DATA_DIR||path.join(ROOT,'data');
const EXPORT=path.join(DATA,'exports');const ASSETS=path.join(DATA,'assets');
for(const p of [DATA,EXPORT,ASSETS,path.join(DATA,'jobs')])mkdirSync(p,{recursive:true});
const dbFile=path.join(DATA,'projects.json');
let db=existsSync(dbFile)?JSON.parse(readFileSync(dbFile,'utf8')):{projects:[]};
function persist(){const temp=dbFile+'.tmp';writeFileSync(temp,JSON.stringify(db,null,2));renameSync(temp,dbFile);}
if(!db.projects.length){const p=newProject(JSON.parse(readFileSync(path.join(ROOT,'seed.json'),'utf8')));db.projects.push(p);persist();}
function save(p){const i=db.projects.findIndex(x=>x.id===p.id);if(i<0)db.projects.unshift(p);else db.projects[i]=p;persist();return p;}
function get(id){const p=db.projects.find(x=>x.id===id);if(!p)throw new Error('콘텐츠를 찾을 수 없습니다.');return p;}
const csrf=randomBytes(24).toString('hex'),jobs=new Map(),locks=new Set();
const learning=createLearning(DATA),learnDir=path.join(DATA,'jobs');
// 에디터 기억(릴스 앱과 공유): 메모·평점·성과, AI 초안을 고친 전후 문장, 승인·게시한 최종 문장. 다음 생성부터 바로 반영됩니다.
function rememberEdits(){
  try{syncMemory('studio',db.projects.filter(p=>p.feedback||(p.origin&&p.approval)||p.status==='published').map(p=>{
    const c=p.content,o=p.origin,line=t=>String(t||'').split('\n').find(l=>l.trim())||'';
    const pairs=o?[...o.cards.flatMap((oc,i)=>c.cards[i]?[{where:i===0?'표지 제목':`${i+1}장 제목`,before:oc.title,after:c.cards[i].title},{where:i===0?'표지 설명':`${i+1}장 본문`,before:oc.body,after:c.cards[i].body},{where:`${i+1}장 하단 문구`,before:oc.note,after:c.cards[i].note}]:[]),{where:'캡션 첫 줄',before:line(o.caption),after:line(c.caption)}]:[];
    return buildRecord({id:p.id,keyword:c.keyword,at:p.feedback?.at||p.approval?.at||p.updatedAt,feedback:p.feedback,pairs,
      final:p.approval||p.status==='published'?{cover:c.cards[0]?.title,lines:c.cards.slice(1,4).map(k=>k.body)}:null});
  }));}catch{}
}
const autoLearn=()=>{rememberEdits();learning.maybeAuto(db.projects,learnDir);};
let connectedInstagram=instagramConfig();
const MIME={'.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.zip':'application/zip','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.tflite':'application/octet-stream'};
function json(res,value,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
async function body(req){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>100*1024*1024)throw new Error('요청 파일이 너무 큽니다.');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
function asset(bytes){const {extension}=imageType(bytes);const name=createHash('sha256').update(bytes).digest('hex')+'.'+extension;const p=path.join(ASSETS,name);if(!existsSync(p))writeFileSync(p,bytes);return '/assets/'+name;}
async function route(req,res){
  const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host))return json(res,{error:'허용되지 않은 호스트입니다.'},403);
  if(req.headers.origin&&![`http://${host}`,`http://127.0.0.1:${server.address().port}`,`http://localhost:${server.address().port}`].includes(req.headers.origin))return json(res,{error:'다른 웹사이트의 요청은 허용되지 않습니다.'},403);
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");
  const u=new URL(req.url,`http://${host}`),route=u.pathname;
  if(req.method==='GET'&&route==='/api/state'){const config=connectedInstagram;const [codex,claude]=await Promise.all([codexStatus(),claudeStatus()]);return json(res,{csrf,projects:db.projects,codex,claude,learning:{active:learning.guide()?.version||0},instagram:{configured:!!config.token&&!!config.userId,login:config.host==='graph.instagram.com'?'instagram':'facebook'}});}
  if(req.method==='GET'&&route==='/api/learning')return json(res,learning.summary(db.projects));
  if(req.method==='GET'&&route==='/api/trends'){const b=loadBrief();return json(res,{brief:b,stale:isStale(b),running:briefRunning(),error:briefError});}
  if(req.method==='GET'&&route==='/api/reference'){const lib=loadLibrary();return json(res,{library:lib,stale:referenceStale(lib),running:referenceRunning(),error:referenceError,memory:memorySummary()});}
  if(req.method==='GET'&&route.startsWith('/api/jobs/'))return json(res,jobs.get(route.split('/').pop())||{status:'error',error:'작업을 찾을 수 없습니다.'});
  if(req.method==='POST'){
    if(req.headers['x-pick-token']!==csrf)return json(res,{error:'앱을 새로고침한 뒤 다시 시도하세요.'},403);
    const b=await body(req);
    if(route==='/api/prompt')return json(res,{prompt:makePrompt(cleanText(b.keyword,160,'키워드'),Number(b.count)||6,b.mode,b.template,b.hook,learning.guide())});
    if(route==='/api/projects'){const p=newProject(b.content);if(b.source==='import')p.origin=snapshotOrigin(p.content,{model:'import',hook:b.hook||'',template:p.content.template,guideVersion:learning.guide()?.version||0});return json(res,save(p));}
    if(route==='/api/feedback'){const p=get(b.id);p.feedback=cleanFeedback(b);save(p);autoLearn();return json(res,p);}
    if(route==='/api/trends/refresh'){if(!briefRunning()){briefError='';refreshBrief(runClaude,path.join(DATA,'jobs')).catch(e=>{briefError=e.message;});}return json(res,{running:true});}
    if(route==='/api/reference/refresh'){if(!referenceRunning()){referenceError='';refreshLibrary(runClaude,path.join(DATA,'jobs')).catch(e=>{referenceError=e.message;});}return json(res,{running:true});}
    if(route==='/api/reference/add'){addSample(b);return json(res,{library:loadLibrary()});}
    if(route==='/api/reference/remove'){removeSample(String(b.id||''));return json(res,{library:loadLibrary()});}
    // AI 말투 다듬기: 지금 원고를 말투 검사기 + 편집장 AI로 다시 고쳐 씁니다(사실·사진·출처 연결은 그대로)
    if(route==='/api/polish'){
      if(locks.has(b.id))throw new Error('게시 처리 중에는 수정할 수 없습니다.');
      if([...jobs.values()].some(j=>j.status==='running'&&!j.insta))throw new Error('진행 중인 AI 작업이 있습니다. 완료 후 다시 시도하세요.');
      const p=get(b.id);if(p.revision!==b.revision)throw new Error('저장한 뒤 다시 시도하세요.');
      if(['publishing','uncertain','published'].includes(p.status))throw new Error('게시 단계의 원고는 복제한 뒤 다듬어 주세요.');
      const id=randomUUID(),set=v=>jobs.set(id,v);set({status:'running',message:'AI 말투를 검사하고 있습니다…'});json(res,{id});
      reviewCards(p.content,path.join(DATA,'jobs'),message=>set({status:'running',message}),{strict:true})
        .then(content=>set({status:'done',project:save(revise(get(p.id),content,p.revision))})).catch(e=>set({status:'error',error:e.message}));
      return;
    }
    if(route==='/api/learning/run'){learning.run(db.projects,learnDir);return json(res,learning.summary(db.projects));}
    if(route==='/api/learning/activate'){learning.activate(Number(b.version));return json(res,learning.summary(db.projects));}
    if(route==='/api/save'){if(locks.has(b.id))throw new Error('게시 처리 중에는 수정할 수 없습니다.');return json(res,save(revise(get(b.id),b.content,b.revision)));}
    if(route==='/api/approve'){if(locks.has(b.id))throw new Error('게시 처리 중입니다.');const p=save(approve(get(b.id),b.revision,b.checks));autoLearn();return json(res,p);}
    if(route==='/api/generate'){
      if([...jobs.values()].some(j=>j.status==='running'&&!j.insta))throw new Error('진행 중인 조사가 있습니다. 완료 후 다시 시도하세요.');
      const keyword=cleanText(b.keyword,160,'키워드');if(!keyword)throw new Error('키워드를 입력하세요.');const count=Number(b.count);if(!Number.isInteger(count)||count<3||count>10)throw new Error('카드는 3~10장으로 선택하세요.');
      const template=normalizeTemplate(b.template||'editorial');
      const model=codexModels.includes(b.model)||claudeModels[b.model]?b.model:'gpt-6-astra';
      const hook=hookLevels.includes(b.hook)?b.hook:'balanced';
      const generate=claudeModels[model]?generateClaude:generateCodex;
      const id=randomUUID();jobs.set(id,{status:'running',message:`${model} 연결 확인 중…`,model});json(res,{id});
      const guide=learning.guide();freshenBrief();
      generate(keyword,count,b.mode,model,path.join(DATA,'jobs'),message=>jobs.set(id,{status:'running',message,model}),template,hook,guide).then(async draft=>{
        const content=await reviewCards(draft,path.join(DATA,'jobs'),message=>jobs.set(id,{status:'running',message,model}));
        const p=newProject({...content,template});p.model=model;
        // 카드마다 그 곡의 사진을 배정(유튜브 제목으로 곡 일치 확인). 다른 곡 사진은 쓰지 않습니다.
        const warnings=await matchPhotos(p.content,asset,message=>jobs.set(id,{status:'running',message,model}));
        // 학습용 AI 초안 스냅샷(사진 배정까지 끝난 상태). 에디터 최종본과 비교합니다.
        p.origin=snapshotOrigin(p.content,{model,hook,template,guideVersion:guide?.version||0});save(p);jobs.set(id,{status:'done',project:p,warnings,model});}).catch(e=>jobs.set(id,{status:'error',error:e.message,model}));return;
    }
    if(route==='/api/image'){
      let bytes;
      if(b.url)bytes=(await downloadImage(b.url)).bytes;
      else {if(typeof b.data!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(b.data))throw new Error('이미지 파일을 선택하세요.');bytes=Buffer.from(b.data.split(',')[1],'base64');if(bytes.length>8*1024*1024)throw new Error('이미지는 8MB 이하여야 합니다.');}
      return json(res,{image:asset(bytes)});
    }
    if(route==='/api/export'){
      const p=get(b.id),preview=b.preview===true;if(!preview)assertApproved(p);if(p.revision!==b.revision)throw new Error('원고가 변경되었습니다.');if(locks.has(b.id)||(!preview&&p.status!=='approved'))throw new Error('승인 완료 상태에서만 게시 패키지를 저장할 수 있습니다.');
      if(!Array.isArray(b.images)||b.images.length!==p.content.cards.length)throw new Error('카드 이미지 수를 확인하세요.');
      const files=[],images=[];
      for(let i=0;i<b.images.length;i++){
        const v=b.images[i];if(!/^data:image\/jpeg;base64,/.test(v))throw new Error('JPEG 카드 이미지만 허용됩니다.');const bytes=Buffer.from(v.split(',')[1],'base64');if(imageType(bytes).extension!=='jpg'||bytes.length>8*1024*1024)throw new Error('이미지 형식을 확인하세요.');const name=`${String(i+1).padStart(2,'0')}.jpg`;files.push([name,bytes]);images.push({name,sha256:createHash('sha256').update(bytes).digest('hex')});
      }
      const folder=`${p.id}-r${p.revision}${preview?'-preview':''}`,dir=path.join(EXPORT,folder);mkdirSync(dir,{recursive:true});
      files.push(['caption.txt',finalCaption(p.content)],['sources.json',JSON.stringify(p.content.sources,null,2)],['project.json',JSON.stringify(p.content,null,2)]);
      for(const [name,bytes] of files)writeFileSync(path.join(dir,name),bytes);
      if(preview)files.push(['검토용.txt','이 패키지는 검토용 초안입니다. 게시 승인은 완료되지 않았습니다.']);
      writeFileSync(path.join(dir,'PICK.zip'),makeZip(files));if(!preview){p.export={hash:p.approval.hash,folder,images,at:new Date().toISOString()};save(p);}return json(res,{project:p,url:`/exports/${folder}/PICK.zip`,folder:dir});
    }
    if(route==='/api/publish'){
      if(locks.has(b.id))throw new Error('게시 요청이 이미 진행 중입니다.');locks.add(b.id);try{return json(res,await publishCarousel(get(b.id),b.urls,connectedInstagram,save));}finally{locks.delete(b.id);}
    }
    // Instagram 웹 업로드 자동 준비: 승인된 게시 패키지 JPG로 '공유하기' 직전까지 진행
    if(route==='/api/instagram/prepare'){
      const p=get(b.id);assertApproved(p);
      if(p.status==='published')throw new Error('이미 게시한 콘텐츠입니다.');
      if(!p.export||p.export.hash!==p.approval.hash)throw new Error('승인본의 게시 패키지를 먼저 저장하세요.');
      const dir=path.join(EXPORT,p.export.folder),files=p.export.images.map(i=>path.join(dir,i.name));
      if(files.some(f=>!existsSync(f)))throw new Error('게시 패키지 파일이 없습니다. 게시 패키지를 다시 저장하세요.');
      const id=randomUUID(),set=v=>jobs.set(id,{...v,insta:true});set({status:'running',message:'준비 중…'});json(res,{id});
      instaWeb.prepare({files,caption:finalCaption(p.content),account:'_pick.kr',onStatus:message=>set({status:'running',message}),
        onShared:()=>{const q=get(p.id);q.status='published';q.publish={...(q.publish||{}),method:'instagram-web',stage:'complete',at:new Date().toISOString()};save(q);rememberEdits();set({status:'shared',project:q});}})
        .then(r=>set({status:'ready',accountOk:r.accountOk,message:'Instagram 창에서 내용 확인 후 공유하기만 누르세요.'}))
        .catch(e=>set({status:'error',error:e.message}));
      return;
    }
    if(route==='/api/instagram/check'){
      const c=connectedInstagram;if(!c.token||!c.userId)throw new Error('Instagram 연결이 필요합니다.');
      const account=await graph(c,c.userId,{fields:'username'},'GET');return json(res,{username:account.username,matches:account.username==='_pick.kr'});
    }
    if(route==='/api/instagram/connect'){
      const config={token:cleanText(b.token,6000,'액세스 토큰'),userId:cleanText(b.userId,50,'계정 ID'),version:cleanText(b.version||'v23.0',15,'API 버전'),host:b.login==='facebook'?'graph.facebook.com':'graph.instagram.com'};
      const account=await graph(config,config.userId,{fields:'username'},'GET');
      if(account.username!=='_pick.kr')throw new Error('연결 계정이 @_pick.kr과 다릅니다. PICK 계정의 ID와 토큰을 입력하세요.');
      connectedInstagram=config;return json(res,{username:account.username});
    }
    if(route==='/api/reconcile'){
      const p=get(b.id);if(p.status!=='uncertain'||!p.publish?.containerId)throw new Error('확인 대기 상태의 게시물만 조회할 수 있습니다.');
      const state=await graph(connectedInstagram,p.publish.containerId,{fields:'status_code'},'GET');
      if(state.status_code==='PUBLISHED'){p.status='published';p.publish.stage='complete';p.publish.at=new Date().toISOString();save(p);}return json(res,{project:p,remoteStatus:state.status_code});
    }
    return json(res,{error:'알 수 없는 요청입니다.'},404);
  }
  if(req.method!=='GET')return json(res,{error:'지원하지 않는 요청입니다.'},405);
  let file;
  if(route.startsWith('/assets/')&&/^\/assets\/[\w.-]+$/.test(route)){file=path.join(ASSETS,path.basename(route));if(!existsSync(file))file=path.join(ROOT,'public',route);}
  else if(/^\/vendor\/mediapipe\/(wasm\/)?[\w.-]+$/.test(route))file=path.join(ROOT,'public',...route.split('/').filter(Boolean));
  else if(/^\/exports\/[\w-]+\/PICK\.zip$/.test(route)){file=path.join(EXPORT,...route.split('/').slice(2));res.setHeader('Content-Disposition','attachment; filename="PICK.zip"');}
  else if(['/','/index.html','/app.js','/style.css','/renderer.js','/templates.js','/template-renderer.js','/template-gallery.js','/templates.html','/figma-export.js','/focus.js','/voice.js','/insta-ui.js'].includes(route))file=path.join(ROOT,'public',route==='/'?'index.html':route);
  if(!file||!existsSync(file))return json(res,{error:'파일을 찾을 수 없습니다.'},404);
  res.setHeader('Content-Type',MIME[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(readFileSync(file));
}
const server=http.createServer((req,res)=>route(req,res).catch(e=>{if(!res.headersSent)json(res,{error:e.message},400);else res.end();}));
server.requestTimeout=120000;
server.listen(Number(process.env.PICK_PORT)||4318,'127.0.0.1',()=>{console.log(`PICK Studio: http://127.0.0.1:${server.address().port}`);rememberEdits();freshenBrief();});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'PICK Studio가 이미 실행 중입니다. http://127.0.0.1:4318 을 여세요.':e.message);process.exit(1);});

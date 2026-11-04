import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

// Instagram 웹 업로드 자동 준비: 전용 Edge 창에서 만들기 → 사진 선택 → 원본 비율 → 다음 → 캡션까지 진행하고
// '공유하기' 직전에 멈춥니다. 최종 게시 버튼은 사람이 누릅니다.
// 테스트 시 PICK_IG_URL·PICK_IG_PROFILE로 모의 페이지·임시 프로필 사용
const IG=process.env.PICK_IG_URL||'https://www.instagram.com/';
const PROFILE=process.env.PICK_IG_PROFILE||path.join(process.env.LOCALAPPDATA||process.env.USERPROFILE||'.','PICK Studio','instagram-profile');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function findEdge(){return [process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Microsoft','Edge','Application','msedge.exe')).find(existsSync);}
function freePort(){return new Promise((res,rej)=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>res(port));});s.on('error',rej);});}

class CDP{
  constructor(url){this.url=url;this.id=0;this.pending=new Map();}
  async open(){
    this.ws=new WebSocket(this.url);
    await new Promise((res,rej)=>{this.ws.onopen=res;this.ws.onerror=()=>rej(new Error('브라우저에 연결하지 못했습니다.'));});
    this.ws.onmessage=e=>{const m=JSON.parse(e.data);const p=this.pending.get(m.id);if(p){this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
    this.ws.onclose=()=>{for(const p of this.pending.values())p.reject(new Error('Instagram 창이 닫혔습니다.'));this.pending.clear();this.closed=true;};
  }
  send(method,params={},sessionId){if(this.closed)return Promise.reject(new Error('Instagram 창이 닫혔습니다.'));return new Promise((resolve,reject)=>{const id=++this.id;this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
}

// 페이지 안에서 쓰는 도우미. 한국어·영어 화면 모두 대응.
const HELPERS=`(()=>{if(window.__pick)return;
  const vis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const clickable=el=>el.closest('button,a,[role=button],[role=link],[role=menuitem],[tabindex]')||el;
  window.__pick={
    byLabel(labels){for(const l of labels){const el=[...document.querySelectorAll('[aria-label="'+l+'"]')].find(vis);if(el)return clickable(el);}return null;},
    // 글자가 일치하는 요소 중 가장 안쪽 것을 골라 클릭 가능한 상위 요소로 올림
    byText(re,root=document){re=new RegExp(re);const m=[...root.querySelectorAll('button,[role=button],a,[role=link],[role=menuitem],span,div')].filter(el=>vis(el)&&el.children.length<=2&&re.test((el.innerText||'').trim()));
      const inner=m.filter(el=>!m.some(o=>o!==el&&el.contains(o)));return inner.map(clickable).find(Boolean)||null;},
    dialog(){const d=[...document.querySelectorAll('[role=dialog]')].filter(vis);return d.at(-1)||null;},
  };})()`;

export function createInstaWeb(){
  let proc=null,port=0,cdp=null,busy=false;
  async function ensureBrowser(onStatus){
    if(cdp&&!cdp.closed&&proc&&proc.exitCode===null)return;
    const edge=findEdge();if(!edge)throw new Error('Microsoft Edge를 찾을 수 없습니다.');
    mkdirSync(PROFILE,{recursive:true});port=await freePort();onStatus('Instagram 전용 창을 여는 중…');
    proc=spawn(edge,[`--remote-debugging-port=${port}`,'--remote-allow-origins=*',`--user-data-dir=${PROFILE}`,'--no-first-run','--no-default-browser-check','--disable-features=msEdgeWelcomePage','--window-size=1280,900',IG],{detached:true,stdio:'ignore'});
    proc.unref();
    let info;for(let i=0;i<40&&!info;i++){await sleep(400);try{info=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();}catch{}}
    if(!info)throw new Error('Instagram 창을 열지 못했습니다. 이미 열린 PICK Instagram 창이 있다면 닫고 다시 시도하세요.');
    cdp=new CDP(info.webSocketDebuggerUrl);await cdp.open();
  }
  async function page(){
    const {targetInfos}=await cdp.send('Target.getTargets');
    let t=targetInfos.find(x=>x.type==='page'&&x.url.startsWith(IG))||targetInfos.find(x=>x.type==='page'&&!x.url.startsWith('edge://')&&!x.url.startsWith('chrome'));
    const targetId=t?t.targetId:(await cdp.send('Target.createTarget',{url:IG})).targetId;
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const s=(m,p)=>cdp.send(m,p,sessionId);
    await s('Page.enable');await s('Runtime.enable');
    if(!t||!t.url.startsWith(IG)){await s('Page.navigate',{url:IG});await sleep(3000);}
    await s('Target.activateTarget',{targetId}).catch(()=>{});await cdp.send('Target.activateTarget',{targetId}).catch(()=>{});await s('Page.bringToFront');
    const ev=async expr=>{const r=await s('Runtime.evaluate',{expression:`${HELPERS};(${expr})`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||'페이지 오류');return r.result.value;};
    const handle=async expr=>(await s('Runtime.evaluate',{expression:`${HELPERS};(${expr})`})).result;
    return {s,ev,handle};
  }
  async function waitFor(ev,expr,ms,what){const end=Date.now()+ms;while(Date.now()<end){try{if(await ev(expr))return true;}catch{}await sleep(700);}throw new Error(`Instagram 화면에서 '${what}' 단계를 찾지 못했습니다. 창에서 직접 이어서 진행하세요.`);}
  async function click(ev,expr,ms,what){await waitFor(ev,`!!(${expr})`,ms,what);await ev(`(${expr}).click()`);await sleep(900);}

  async function prepare({files,caption,account,onStatus,onShared}){
    if(busy)throw new Error('이미 Instagram 업로드를 준비 중입니다.');busy=true;
    try{
      await ensureBrowser(onStatus);const {s,ev,handle}=await page();
      // 1) 로그인 확인: 로그인 안 돼 있으면 최대 10분 기다림
      onStatus('Instagram 로그인 확인 중…');
      const loggedIn=`!!__pick.byLabel(['새로운 게시물','New post','만들기','Create'])||!!__pick.byText('^(만들기|Create)$')`;
      // 페이지가 다 뜰 때까지 잠깐 기다린 뒤 판단
      await waitFor(ev,loggedIn,10000,'').catch(()=>{});
      if(!await ev(loggedIn).catch(()=>false)){
        onStatus('열린 Instagram 창에서 @'+account+' 계정으로 로그인해 주세요. 로그인하면 자동으로 이어집니다. (최대 10분)');
        await waitFor(ev,loggedIn,600000,'로그인');await sleep(2000);
      }
      const accountOk=await ev(`!!document.querySelector('a[href="/${account}/"]')||!!document.querySelector('img[alt*="${account}"]')`).catch(()=>false);
      // 2) 만들기 → 게시물
      onStatus('새 게시물 만들기…');
      await click(ev,`__pick.byLabel(['새로운 게시물','New post'])||__pick.byText('^(만들기|Create)$')`,15000,'만들기');
      if(!await ev(`!!document.querySelector('input[type=file]')`)){
        const post=await ev(`!!(__pick.byLabel(['게시물','Post'])||__pick.byText('^(게시물|Post)$'))`);
        if(post)await click(ev,`__pick.byLabel(['게시물','Post'])||__pick.byText('^(게시물|Post)$')`,8000,'게시물');
      }
      // 3) 사진 선택 (파일 창 없이 직접 넣기)
      onStatus(`카드 ${files.length}장 올리는 중…`);
      await waitFor(ev,`!!document.querySelector('input[type=file]')`,15000,'사진 선택');
      const input=await handle(`[...document.querySelectorAll('input[type=file]')].at(-1)`);
      await s('DOM.setFileInputFiles',{files,objectId:input.objectId});
      // 4) 자르기 → 원본 (4:5 카드가 1:1로 잘리지 않게)
      onStatus('비율을 원본으로 맞추는 중…');
      await waitFor(ev,`!!__pick.byLabel(['자르기 선택','Select crop','자르기','Crop'])`,30000,'자르기');
      await click(ev,`__pick.byLabel(['자르기 선택','Select crop','자르기','Crop'])`,5000,'자르기');
      const orig=await ev(`!!__pick.byText('^(원본|Original)$',__pick.dialog()||document)`);
      if(orig)await click(ev,`__pick.byText('^(원본|Original)$',__pick.dialog()||document)`,5000,'원본 비율');
      else await click(ev,`__pick.byText('^4:5$',__pick.dialog()||document)`,5000,'4:5 비율');
      // 5) 다음 → 다음 (필터 건너뛰기)
      onStatus('다음 단계로 이동 중…');
      await click(ev,`__pick.byText('^(다음|Next)$',__pick.dialog()||document)`,10000,'다음');
      await click(ev,`__pick.byText('^(다음|Next)$',__pick.dialog()||document)`,10000,'다음');
      // 6) 캡션 입력
      onStatus('캡션 입력 중…');
      const box=`(__pick.dialog()||document).querySelector('[contenteditable=true][role=textbox],div[aria-label*="문구"],div[aria-label*="caption"]')`;
      await waitFor(ev,`!!${box}`,15000,'캡션');
      await ev(`${box}.focus()`);
      // 1차: 줄바꿈 포함 통째로 입력. 줄 수가 안 맞으면 지우고 줄마다 Enter로 재입력
      await s('Input.insertText',{text:caption});await sleep(400);
      const want=caption.split('\n').filter(Boolean).length;
      const got=await ev(`${box}.innerText.split('\\n').filter(l=>l.trim()).length`);
      if(got!==want){
        await ev(`(()=>{const b=${box};b.focus();document.execCommand('selectAll');document.execCommand('delete');})()`);
        const k={key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13};
        for(const [i,line] of caption.split('\n').entries()){
          if(i)await s('Input.dispatchKeyEvent',{type:'keyDown',...k,text:'\r',unmodifiedText:'\r'}),await s('Input.dispatchKeyEvent',{type:'keyUp',...k});
          if(line)await s('Input.insertText',{text:line});
        }
      }
      await s('Page.bringToFront');
      // 7) 여기서 멈춤. 사용자가 공유하기를 누르면 감지
      (async()=>{try{await waitFor(ev,`/게시물이 공유되었습니다|릴스가 공유되었습니다|Your post has been shared|Post shared/.test(document.body.innerText)`,1800000,'공유 완료');onShared();}catch{}})();
      return {accountOk};
    }finally{busy=false;}
  }
  return {prepare};
}

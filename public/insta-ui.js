// 인스타그램풍 화면 동작 + 책넘김(3D) 효과.
// 카드 넘김, 캐러셀 점/화살표, 더블클릭 좋아요, 매거진 펼쳐보기(편집 중·보관함), 화면·탭·창 전환, 생성·저장·승인 연출.
// app.js의 상태는 건드리지 않고, 화면(DOM)이 바뀌는 것을 보고 움직입니다.
import {drawCard} from './renderer.js';
const $=s=>document.querySelector(s);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage=$('#postStage'),main=$('#mainCanvas'),strip=$('#filmstrip');
const thumbs=()=>[...strip.querySelectorAll('.thumb')];
const current=()=>thumbs().findIndex(t=>t.classList.contains('active'));
const typing=t=>t.closest?.('input,textarea,select,[contenteditable]');
const copyCanvas=src=>{const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d').drawImage(src,0,0);return c;};
const go=i=>{const t=thumbs()[i];if(t&&!t.classList.contains('active'))t.click();};
const watch=(el,fn,opts={childList:true,characterData:true,subtree:true})=>el&&new MutationObserver(fn).observe(el,opts);
// 애니메이션 클래스를 다시 걸어 처음부터 재생
function replay(el,cls,ms=1200){
  if(reduce||!el)return;
  el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
  clearTimeout(el['t_'+cls]);el['t_'+cls]=setTimeout(()=>el.classList.remove(cls),ms);
}
const turnIn=(el,dir)=>{el?.classList.remove('turn-in-fwd','turn-in-back');replay(el,'turn-in-'+dir,800);};

// ── 카드 넘김: 바꾸기 직전 장면을 찍어 두었다가, 새 카드가 그려지면 그 위에서 3D로 넘깁니다.
let pending=null,inspectorDir=null;
strip.addEventListener('click',e=>{
  const t=e.target.closest('.thumb');if(!t)return;
  const to=thumbs().indexOf(t),from=current();if(to===from||from<0)return;
  inspectorDir=to>from?'fwd':'back';
  if(!reduce)pending={to,dir:inspectorDir,page:copyCanvas(main),at:Date.now()};
},true);
function turnPage(){
  const {page,dir}=pending;pending=null;
  stage.querySelectorAll('.page-turn').forEach(p=>p.remove());
  page.className='page-turn '+dir;page.setAttribute('aria-hidden','true');stage.append(page);
  replay(stage,'landing',600);
  page.addEventListener('animationend',()=>page.remove(),{once:true});
}
function syncPost(){
  const m=$('#cardLabel').textContent.match(/(\d+)\s*\/\s*(\d+)/);if(!m)return;
  const i=Number(m[1])-1,n=Number(m[2]);
  if(pending&&pending.to===i&&Date.now()-pending.at<4000)turnPage();
  $('#postCount').textContent=`${i+1}/${n}`;
  $('#prevCard').disabled=i===0;$('#nextCard').disabled=i===n-1;
  const dots=$('#postDots');
  if(dots.children.length!==n)dots.innerHTML='<i></i>'.repeat(n);
  [...dots.children].forEach((d,k)=>{d.className=k===i?'on':Math.abs(k-i)>2?'near':'';});
}
watch($('#cardLabel'),syncPost);
$('#prevCard').onclick=()=>go(current()-1);
$('#nextCard').onclick=()=>go(current()+1);

// 좌우 스와이프
let swipe=null,swiped=false;
stage.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY};swiped=false;});
stage.addEventListener('pointerup',e=>{
  if(!swipe)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){swiped=true;go(current()+(dx<0?1:-1));}
});

// 클릭: 펼쳐보기 / 더블클릭: 좋아요 하트
const heartPath='<path d="M12 20.5s-8-4.6-8-10.6A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 8 2.6c0 6-8 10.6-8 10.6z"/>';
function like(on=true){const b=$('#likeBtn');b.classList.toggle('liked',on);b.setAttribute('aria-pressed',String(on));}
const openEditorBook=()=>openBook(thumbs().map(t=>t.querySelector('canvas')).filter(Boolean),$('#projectTitle').textContent,current());
let clickTimer=0;
main.addEventListener('click',()=>{if(swiped){swiped=false;return;}clearTimeout(clickTimer);clickTimer=setTimeout(openEditorBook,260);});
main.addEventListener('dblclick',()=>{
  clearTimeout(clickTimer);like(true);
  stage.querySelector('.big-heart')?.remove();
  stage.insertAdjacentHTML('beforeend',`<svg class="big-heart" viewBox="0 0 24 24" aria-hidden="true">${heartPath}</svg>`);
  stage.querySelector('.big-heart').addEventListener('animationend',e=>e.target.remove(),{once:true});
});
$('#likeBtn').onclick=()=>like(!$('#likeBtn').classList.contains('liked'));
$('#bookBtn').onclick=openEditorBook;
$('#bookmarkBtn').onclick=()=>{replay($('#bookmarkBtn'),'flash',500);$('#saveBtn').click();};

// 방향키로 카드 넘기기
document.addEventListener('keydown',e=>{
  if(e.defaultPrevented||typing(e.target)||$('.book-viewer')||$('#modal').open||$('#editorView').hidden)return;
  if(e.key==='ArrowRight'){go(current()+1);e.preventDefault();}
  if(e.key==='ArrowLeft'){go(current()-1);e.preventDefault();}
});

// 저장 상태 점
watch($('#saveState'),()=>$('#saveState').classList.toggle('saving',/중/.test($('#saveState').textContent)));

// ── 저장·내보내기: 지금 카드 사본 몇 장이 촤르륵 넘어가며 묶이는 느낌
function riffle(){
  if(reduce||$('#editorView').hidden)return;
  stage.querySelectorAll('.riffle').forEach(r=>r.remove());
  for(let k=0;k<4;k++){
    const r=copyCanvas(main);r.className='riffle';r.setAttribute('aria-hidden','true');r.style.animationDelay=k*0.09+'s';
    r.addEventListener('animationend',()=>r.remove(),{once:true});stage.append(r);
  }
}
for(const id of ['saveBtn','packageBtn','draftExport','singleExport','figmaExport'])$('#'+id)?.addEventListener('click',riffle);

// ── 화면 전환(편집실 ↔ 보관함): 책장을 넘기듯
let fromCover=false;
for(const view of [$('#editorView'),$('#archiveView')])watch(view,()=>{
  if(view.hidden)return;
  turnIn(view,view.id==='archiveView'||fromCover?'fwd':'back');fromCover=false;
},{attributes:true,attributeFilter:['hidden']});

// ── 원고/사진/출처/캡션/피드백 탭: 탭 순서대로 앞뒤로 넘김. 카드를 바꿔도 같은 방향으로 넘김.
$('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const all=[...$('.tabs').children],to=all.indexOf(b),from=all.findIndex(x=>x.classList.contains('selected'));
  if(to!==from)inspectorDir=to>from?'fwd':'back';
},true);
watch($('#inspectorBody'),()=>{if(inspectorDir){turnIn($('#inspectorBody'),inspectorDir);inspectorDir=null;}},{childList:true});

// ── 창(모달): 표지를 여는 것처럼 열리고, 열린 채 내용이 바뀌면 다음 장으로 넘김
let modalOpenedAt=0;
watch($('#modal'),()=>{if($('#modal').open)modalOpenedAt=Date.now();},{attributes:true,attributeFilter:['open']});
watch($('#modalContent'),()=>{if($('#modal').open&&Date.now()-modalOpenedAt>400)turnIn($('#modalContent'),'fwd');},{childList:true});

// ── 새 매거진(생성 완료·다른 원고 열기): 표지가 덮이며 등장하고 썸네일이 한 장씩 놓임
let lastTitle=null;
watch($('#projectTitle'),()=>{
  const t=$('#projectTitle').textContent;if(t===lastTitle)return;lastTitle=t;
  replay(stage,'cover-in',1000);replay(strip,'deal',1300);
});

// ── 만드는 중: 배너에 넘어가는 책, 미리보기 위로 책장이 계속 넘어감
watch($('#generateBtn'),()=>{
  const on=$('#generateBtn').disabled&&!$('#jobBanner').hidden;
  stage.classList.toggle('composing',on&&!reduce);$('#jobBanner').classList.toggle('working',on);
},{attributes:true,attributeFilter:['disabled']});

// ── 진행 단계·상태 배지: 바뀌면 카드처럼 뒤집힘
for(const step of document.querySelectorAll('.workflow .step')){
  let was=step.classList.contains('done');
  watch(step,()=>{const now=step.classList.contains('done');if(now&&!was)replay(step,'flip',800);was=now;},{attributes:true,attributeFilter:['class']});
}
let lastStatus=$('#status').textContent;
watch($('#status'),()=>{const t=$('#status').textContent;if(t!==lastStatus){lastStatus=t;replay($('#status'),'flip',700);}});

// ── 보관함: 표지 위 '펼쳐보기'는 저장된 매거진을 책으로, 표지 클릭은 책을 연 다음 편집실로
watch($('#archiveGrid'),()=>{
  for(const card of $('#archiveGrid').querySelectorAll('.archive-card:not(:has(.book-peek))'))
    card.insertAdjacentHTML('beforeend','<span class="book-peek" aria-hidden="true">📖 펼쳐보기</span>');
},{childList:true});
$('#archiveGrid').addEventListener('click',async e=>{
  const card=e.target.closest('.archive-card');if(!card)return;
  const peek=e.target.closest('.book-peek');
  if(peek){
    e.stopPropagation();const p=window.pickProject?.(card.dataset.id);if(!p||peek.classList.contains('wait'))return;
    peek.classList.add('wait');peek.textContent='펼치는 중…';
    try{
      const pages=await Promise.all(p.content.cards.map((_,i)=>{const c=document.createElement('canvas');return drawCard(c,p.content,i).then(()=>c);}));
      openBook(pages,p.content.keyword,0,card);
    }catch(err){console.warn(err);}
    peek.classList.remove('wait');peek.textContent='📖 펼쳐보기';return;
  }
  if(reduce)return;
  if(card.dataset.opened){delete card.dataset.opened;fromCover=true;return;}
  e.stopPropagation();if(card.classList.contains('opening'))return;
  card.classList.add('opening');
  setTimeout(()=>{card.dataset.opened='1';card.click();card.classList.remove('opening');},720);
},true);

// ── 매거진 펼쳐보기: 카드 2장이 한 펼침면. 표지는 오른쪽에 혼자 놓이고, 한 장씩 3D로 넘어갑니다.
function openBook(pages,title,startIndex=0,opener=document.activeElement){
  if($('.book-viewer')||!pages.length)return;
  const n=pages.length,count=Math.ceil(n/2);
  const v=document.createElement('div');v.className='book-viewer';
  v.setAttribute('role','dialog');v.setAttribute('aria-modal','true');v.setAttribute('aria-label','매거진 펼쳐보기');
  v.innerHTML='<div class="book-top"><div><span class="book-title"></span><small></small></div><button class="book-close" aria-label="닫기">✕</button></div><div class="book-stage"><div class="book"></div></div><div class="book-nav"><button class="bprev" aria-label="이전 페이지">‹</button><div class="dots"></div><button class="bnext" aria-label="다음 페이지">›</button></div><p class="book-hint">페이지를 클릭하거나 ← → 키, 스와이프로 넘겨보세요 · Esc 닫기</p>';
  v.querySelector('.book-title').textContent=title;
  v.querySelector('.book-top small').textContent=`PICK MAGAZINE · ${n}페이지`;
  const book=v.querySelector('.book'),dots=v.querySelector('.dots');
  const leaves=[];
  for(let k=0;k<count;k++){
    const leaf=document.createElement('div');leaf.className='leaf';
    for(const [side,src] of [['front',pages[2*k]],['back',pages[2*k+1]]]){
      const face=document.createElement('div');face.className='face '+side+(src?'':' blank');
      if(src)face.append(copyCanvas(src));leaf.append(face);
    }
    book.append(leaf);leaves.push(leaf);
  }
  dots.innerHTML='<i></i>'.repeat(count+1);
  let f=0;
  const setZ=()=>leaves.forEach((l,k)=>{if(!l.classList.contains('turning'))l.style.zIndex=k<f?k+1:count-k;});
  function layout(){
    leaves.forEach((l,k)=>l.classList.toggle('flipped',k<f));
    book.style.transform=`translateX(${f===0?-25:f===count?25:0}%)`;
    [...dots.children].forEach((d,k)=>d.className=k===f?'on':'');
    v.querySelector('.bprev').disabled=f===0;v.querySelector('.bnext').disabled=f===count;
  }
  function turn(d){
    const nf=f+d;if(nf<0||nf>count)return;
    const leaf=leaves[d>0?f:f-1];f=nf;
    leaf.classList.add('turning');leaf.style.zIndex=count+2;setZ();layout();
    clearTimeout(leaf.timer);leaf.timer=setTimeout(()=>{leaf.classList.remove('turning');setZ();},900);
  }
  function size(){
    const w=Math.max(120,Math.min((innerWidth-90)/2,(innerHeight-250)*.8,440));
    book.style.width=2*w+'px';book.style.height=1.25*w+'px';
  }
  function close(){
    removeEventListener('keydown',onKey,true);removeEventListener('resize',size);
    v.classList.add('closing');setTimeout(()=>v.remove(),280);opener?.focus?.();
  }
  function onKey(e){
    if(e.key==='Escape'){close();e.preventDefault();}
    else if(e.key==='ArrowRight'){turn(1);e.preventDefault();}
    else if(e.key==='ArrowLeft'){turn(-1);e.preventDefault();}
    e.stopPropagation();
  }
  v.querySelector('.book-close').onclick=close;
  v.querySelector('.bprev').onclick=()=>turn(-1);
  v.querySelector('.bnext').onclick=()=>turn(1);
  let start=null;
  book.addEventListener('pointerdown',e=>start=e.clientX);
  book.addEventListener('pointerup',e=>{
    if(start===null)return;const dx=e.clientX-start;start=null;
    if(Math.abs(dx)>45)return turn(dx<0?1:-1);
    const r=book.getBoundingClientRect();turn(e.clientX>r.left+r.width/2?1:-1);
  });
  v.addEventListener('click',e=>{if(e.target===v)close();});
  addEventListener('keydown',onKey,true);addEventListener('resize',size);
  size();setZ();layout();document.body.append(v);v.querySelector('.book-close').focus();
  // 보던 카드가 있는 펼침면까지 촤르륵 넘겨 둡니다.
  const target=Math.ceil(Math.max(0,startIndex)/2);
  if(!reduce)for(let k=0;k<target;k++)setTimeout(()=>turn(1),650+k*170);
  else{f=target;setZ();layout();}
}

syncPost();

import {drawCard,loadImage} from './renderer.js';
import {findFocus} from './focus.js';
import {templates,demoContent,templateById} from './templates.js';
import {figmaPackage} from './figma-export.js';
import {lintCards,scoreHook,plainText,HOOKS} from './voice.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,project,selected=0,tab='text',dirty=false,renderId=0,saveTimer,saveQueue=Promise.resolve(),localVersion=0;
const statuses={draft:'초안 · 검토 전',approved:'승인 완료',publishing:'게시 중',published:'게시 완료',uncertain:'게시 결과 확인 필요'};
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,5500);}
async function api(url,data){const r=await fetch(url,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json','X-Pick-Token':state.csrf}:{},...(data?{body:JSON.stringify(data)}:{})});const value=await r.json();if(!r.ok)throw new Error(value.error||'요청에 실패했습니다.');return value;}
function action(fn){return async e=>{const button=e?.currentTarget;try{if(button?.tagName==='BUTTON')button.disabled=true;await fn(e);}catch(err){toast(err.message);}finally{if(button?.tagName==='BUTTON')button.disabled=false;}};}
// 곡명 비교(서버 lib/photos.mjs와 같은 규칙): 한·영 표기는 /로 구분
const normSubject=s=>String(s||'').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g,m=>' '+m.slice(1,-1)+' ').replace(/[\s'"‘’“”`·.,!?~\-_:;&/()[\]<>《》「」『』]/g,'');
const subjectVariants=s=>String(s||'').split(/[/|()[\]]/).map(normSubject).filter(v=>v.length>=2);
function sameSubject(a,b){const A=subjectVariants(a),B=subjectVariants(b);return A.some(x=>B.some(y=>{if(x===y)return true;const [s,l]=x.length<y.length?[x,y]:[y,x];return l.includes(s)&&s.length/l.length>=.7;}));}
// 해시태그 5개 정리·최종 캡션 조합 (서버 lib/content.mjs finalCaption과 같은 규칙)
const DEFAULT_TAGS=['#인디밴드','#밴드추천','#음악추천','#국내밴드','#플레이리스트'];
function cleanTags(list,caption=''){const from=Array.isArray(list)?list:[...String(caption).matchAll(/#[^\s#]+/g)].map(m=>m[0]);const t=[];for(const x of [...from,...DEFAULT_TAGS]){const tag='#'+String(x||'').replace(/^#+/,'').replace(/[\s#.,!?'"]/g,'').slice(0,40);if(tag.length>1&&!t.some(y=>y.toLowerCase()===tag.toLowerCase()))t.push(tag);if(t.length===5)break;}return t;}
function composeCaption(c){const body=String(c.caption||'').split('\n').filter(l=>!/^\s*(#[^\s#]+\s*)+$/.test(l)).join('\n').replace(/\n{3,}/g,'\n\n').trim();return `${body}\n\n${cleanTags(c.hashtags,c.caption).join(' ')}`.slice(0,2200);}
const kindName={song:'곡 MV·싱글',album:'앨범 아트',artist:'아티스트',scene:'현장·분위기'};
// AI 초안 대비 제목·본문 수정률(서버 학습과 같은 방식의 편집 거리 비율)
function lev(a,b){a=a.slice(0,600);b=b.slice(0,600);if(a===b)return 0;if(!a.length||!b.length)return Math.max(a.length,b.length);let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}return prev[b.length];}
function editRate(origin,content){const r=(a='',b='')=>{const n=Math.max(a.length,b.length);return n?lev(a,b)/n:0;};const e=origin.cards.map((o,i)=>content.cards[i]?(r(o.title,content.cards[i].title)+r(o.body,content.cards[i].body))/2:1);return e.length?e.reduce((a,b)=>a+b,0)/e.length:0;}
function put(p){const i=state.projects.findIndex(v=>v.id===p.id);if(i<0)state.projects.unshift(p);else state.projects[i]=p;$('#projectCount').textContent=state.projects.length;}
function markDirty(){dirty=true;localVersion++;project.status='draft';project.approval=null;project.export=null;$('#saveState').textContent='저장 중…';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(e=>toast(e.message)),800);updateStatus();}
async function save(){
  clearTimeout(saveTimer);
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    if(!dirty)return;
    const id=project.id,version=localVersion,content=structuredClone(project.content);
    try{const p=await api('/api/save',{id,revision:project.revision,content});put(p);if(project.id===id){if(localVersion===version){project=p;dirty=false;$('#saveState').textContent='저장됨';}else{project.revision=p.revision;dirty=true;}updateStatus();}}
    catch(e){$('#saveState').textContent='저장 실패 · 다시 저장';throw e;}
  });await saveQueue;
  if(dirty)return save();
}
function updateStatus(){const el=$('#status');el.textContent=statuses[project.status]||'초안';el.className='badge'+(project.status==='approved'?' approved':'');$('#reviewStep').className='step'+(project.approval?' done':'');$('#publishStep').className='step'+(project.status==='published'?' done':'');$('#projectTitle').textContent=project.content.keyword;}
async function selectProject(p){await save();p=state.projects.find(x=>x.id===p.id)||p;project=structuredClone(p);selected=0;dirty=false;$('#keyword').value=p.content.keyword;$('#theme').value=p.content.theme;$('#editorView').hidden=false;$('#archiveView').hidden=true;$('#editorNav').classList.add('active');$('#archiveNav').classList.remove('active');updateStatus();renderInspector();await render();}
async function render(){
  const rid=++renderId,content=structuredClone(project.content),index=selected;
  try{const temp=document.createElement('canvas');await drawCard(temp,content,index);if(rid!==renderId)return;const main=$('#mainCanvas');main.getContext('2d').clearRect(0,0,1080,1350);main.getContext('2d').drawImage(temp,0,0);$('#cardLabel').textContent=`${String(index+1).padStart(2,'0')} / ${String(content.cards.length).padStart(2,'0')} · ${content.cards[index].layout.toUpperCase()}`;
    $('#filmstrip').innerHTML='';for(let i=0;i<content.cards.length;i++){const b=document.createElement('button');b.className='thumb'+(i===index?' active':'');b.setAttribute('aria-label',`${i+1}번 카드 편집`);const canvas=document.createElement('canvas');b.append(canvas);const small=document.createElement('small');small.textContent=String(i+1).padStart(2,'0');b.append(small);b.onclick=()=>{selected=i;renderInspector();render();};$('#filmstrip').append(b);drawCard(canvas,content,i).catch(e=>toast(e.message));}
  }catch(e){toast(e.message);}
}
function field(label,name,value,max,kind='input',cls=''){return `<label class="field">${label}<small>${value.length}/${max}</small><${kind} data-field="${name}" maxlength="${max}" class="${cls}" ${kind==='input'?`value="${esc(value)}"`:''}>${kind==='textarea'?esc(value):''}</${kind}></label>`;}
function renderInspector(){
  const c=project.content.cards[selected],el=$('#inspectorBody'),locked=['published','publishing','uncertain'].includes(project.status);
  const projectId=project.id,cardIndex=selected;
  // Autosave replaces project with the server response; resolve the card at edit time.
  const currentCard=()=>{if(project.id!==projectId)throw new Error('편집 중인 콘텐츠가 변경되었습니다. 다시 선택해 주세요.');return project.content.cards[cardIndex];};
  $$('.tabs button').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));
  if(tab==='text'){
    el.innerHTML=`<div class="section-label"><b>${String(selected+1).padStart(2,'0')} 카드 원고</b><small>${selected===0?'첫 문장에서 시선을 잡으세요':'한 장에 하나의 이야기'}</small></div>${field('상단 라벨','label',c.label,40)}${field('헤드라인','title',c.title,64,'textarea','headline-input')}${field('본문','body',c.body,260,'textarea','body-input')}${field('하단 문구','note',c.note,100)}<label class="field">레이아웃<select id="layout"><option value="cover">사진 표지</option><option value="story">사진 + 이야기</option><option value="type">타이포그래피</option><option value="end">마무리</option></select></label><div id="lintBox"></div>`;
    // 표지 후보: AI가 서로 다른 후킹 공식으로 쓴 제목들. 눌러서 바로 바꿉니다.
    const opts=project.content.coverOptions||[];
    if(selected===0&&(opts.length||project.content.angle))el.querySelector('.section-label').insertAdjacentHTML('afterend',`${project.content.angle?`<p class="caption-hint angle"><b>이 원고의 각도</b> ${esc(project.content.angle)}</p>`:''}${opts.length?`<div class="cover-options"><div class="section-label"><b>표지 후보 ${opts.length}</b><small>눌러서 바꾸기 · [대괄호] 줄은 강조색</small></div>${opts.map((o,i)=>`<button class="cover-opt${plainText(o.title)===plainText(c.title)?' on':''}" data-opt="${i}"><b>${esc(plainText(o.title)).replace(/\n/g,'<br>')}</b><small>${esc(o.formula)} · ${scoreHook(o.title).score}점</small><small>${esc(o.why)}</small></button>`).join('')}</div>`:''}`);
    $$('[data-opt]').forEach(b=>b.onclick=()=>{currentCard().title=opts[Number(b.dataset.opt)].title;markDirty();renderInspector();render();});
    renderLint();
    $('#layout').value=c.layout;$('#layout').onchange=e=>{currentCard().layout=e.target.value;markDirty();render();};
    $$('[data-field]').forEach(input=>input.oninput=()=>{currentCard()[input.dataset.field]=input.value;input.parentElement.querySelector('small').textContent=`${input.value.length}/${input.maxLength}`;markDirty();render();renderLint();});
  }else if(tab==='photo'){
    el.innerHTML=`<div class="section-label"><b>사진 & 아트워크</b><small>카드 ${selected+1}</small></div>${c.image?`<img class="photo-preview" src="${esc(c.image)}" alt="선택한 카드 사진">`:'<div class="tip">사진을 넣거나 타이포그래피만으로 구성할 수 있어요.</div>'}<label class="field">이미지 주소<input id="imageURL" placeholder="https://… 이미지 파일 주소"></label><div class="two-buttons"><button class="secondary" id="fetchImage">주소에서 가져오기</button><button class="secondary" id="uploadImage">내 사진 선택</button><button class="quiet" id="removeImage">사진 제거</button></div><input type="file" id="imageFile" accept="image/png,image/jpeg,image/webp" hidden>${field('사진 크레딧','imageCredit',c.imageCredit,140)}<label class="field">사진 원문 페이지<input id="imageSource" value="${esc(c.imageSource)}" placeholder="공식 자료 페이지 URL"></label><label class="check"><input type="checkbox" id="imageRights" ${c.imageRightsConfirmed?'checked':''}> 이 사진을 게시에 사용할 권한·조건을 확인했습니다.</label><button class="secondary" id="applyPhotoAll">이 사진을 모든 카드에 적용</button>${c.subject?`<p class="caption-hint">이 카드의 곡: <b>${esc(c.subject)}</b></p>`:''}<h3>조사에서 찾은 사진</h3>${project.content.imageCandidates.map((p,i)=>({p,i,match:!!c.subject&&sameSubject(p.subject,c.subject)})).sort((a,b)=>b.match-a.match).map(({p,i,match})=>`<div class="source-item${match?' trend-item':''}"><small>후보 ${i+1} · ${esc(kindName[p.kind]||'사진')}${p.subject?' · '+esc(p.subject):''}${match?' · <b>이 카드 곡</b>':''}</small>${p.verifiedTitle?`<small>유튜브 제목 확인: ${esc(p.verifiedTitle)}</small>`:''}<a href="${esc(p.sourceUrl)}" target="_blank" rel="noreferrer">${esc(p.credit)} ↗</a><button class="secondary candidate" data-index="${i}">이 사진 선택</button></div>`).join('')||'<p class="caption-hint">자동 조사 후 찾은 사진 후보가 표시됩니다.</p>'}<div class="tip">원문에 공개된 사진도 재사용 조건은 별도로 확인해야 합니다. 허가 상태를 자동으로 확정하지 않아요.</div>`;
    const setPhoto=async data=>{const result=await api('/api/image',data);const card=currentCard();card.image=result.image;card.imageRightsConfirmed=false;markDirty();renderInspector();await render();};
    $('#fetchImage').onclick=action(()=>setPhoto({url:$('#imageURL').value}));$('#uploadImage').onclick=()=>$('#imageFile').click();
    $('#imageFile').onchange=action(async e=>{const f=e.target.files[0];if(!f)return;if(f.size>8*1024*1024)throw new Error('8MB 이하 파일을 선택하세요.');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});await setPhoto({data});});
    $('#removeImage').onclick=()=>{currentCard().image='';currentCard().imageRightsConfirmed=false;markDirty();renderInspector();render();};
    $('#imageRights').onchange=e=>{currentCard().imageRightsConfirmed=e.target.checked;markDirty();};
    $('#imageSource').onchange=e=>{currentCard().imageSource=e.target.value;markDirty();};
    $('[data-field="imageCredit"]').oninput=e=>{currentCard().imageCredit=e.target.value;markDirty();render();};
    $('#applyPhotoAll').onclick=()=>{const card=currentCard();project.content.cards.forEach(x=>{x.image=card.image;x.imageCredit=card.imageCredit;x.imageSource=card.imageSource;x.imageRightsConfirmed=card.imageRightsConfirmed;});markDirty();render();toast('모든 카드에 사진 정보를 적용했습니다.');};
    $$('.candidate').forEach(b=>b.onclick=action(async()=>{const p=project.content.imageCandidates[Number(b.dataset.index)];currentCard().imageCredit=p.credit;currentCard().imageSource=p.sourceUrl;await setPhoto({url:p.url});}));
  }else if(tab==='sources'){
    el.innerHTML=`<div class="section-label"><b>원문 출처 ${project.content.sources.length}</b><small>카드 ${selected+1}의 근거 연결</small></div><p class="caption-hint">AI가 제시한 링크는 원문을 열어 확인해 주세요. 아래 체크는 이 카드와 출처를 연결합니다.</p>${project.content.sources.map(s=>`<div class="source-item"><label class="check"><input type="checkbox" class="sourceCheck" value="${esc(s.id)}" ${c.sourceIds.includes(s.id)?'checked':''}>${esc(s.id)} · 이 카드의 출처</label><small>${esc(s.publisher)}</small><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.title)} ↗</a><div class="source-meta">원문 날짜 ${esc(s.date||'확인 필요')}</div><p>${esc(s.evidence)}</p></div>`).join('')}<button class="secondary" id="editSources">출처 추가·수정</button>${(project.content.trends||[]).length?`<h3>원고에 녹인 유행어 ${project.content.trends.length}</h3><p class="caption-hint">밈은 유행이 빨리 지나갑니다. 게시 전에 지금도 쓰이는 말인지, 맥락이 맞는지 확인하세요.</p>${project.content.trends.map(t=>`<div class="source-item trend-item"><strong>${esc(t.phrase)}</strong><small>${esc(t.usedIn)}</small><p>${esc(t.meaning)}</p><div class="source-meta">${esc(t.evidence)}</div>${t.sourceUrl?`<a href="${esc(t.sourceUrl)}" target="_blank" rel="noreferrer">유행 근거 보기 ↗</a>`:''}</div>`).join('')}`:''}`;
    $$('.sourceCheck').forEach(b=>b.onchange=()=>{currentCard().sourceIds=$$('.sourceCheck').filter(x=>x.checked).map(x=>x.value);markDirty();});$('#editSources').onclick=()=>{modal('출처 목록 편집',`<p>id, title, url, publisher, date, evidence 필드를 유지하세요. 원문에 없는 발언은 추가하지 마세요.</p><textarea id="sourceJSON">${esc(JSON.stringify(project.content.sources,null,2))}</textarea><div class="actions"><button class="primary" id="applySources">출처 저장</button></div>`);$('#applySources').onclick=action(async()=>{const sources=JSON.parse($('#sourceJSON').value);if(!Array.isArray(sources))throw new Error('JSON 배열을 입력하세요.');const content={...project.content,sources};const p=await api('/api/save',{id:project.id,revision:project.revision,content});project=p;put(p);dirty=false;$('#modal').close();renderInspector();updateStatus();});};
  }else if(tab==='feedback'){
    const f=project.feedback||{},m=f.metrics||{},o=project.origin;
    const rate=o?Math.round(editRate(o,project.content)*100):null;
    el.innerHTML=`<div class="section-label"><b>피드백 · 학습 재료</b><small>${o?`AI 초안 · ${esc(o.model)} · 가이드 v${o.guideVersion||0}`:'AI 초안 기록 없음'}</small></div>
      ${o?`<div class="tip"><strong>AI 초안 대비 수정률 ${rate}%</strong>제목·본문을 얼마나 고쳤는지입니다. 고친 방향은 그대로 다음 원고의 학습 재료가 됩니다. 승인하면 자동으로 학습 대상에 들어가요.</div>`:'<div class="tip">자동 생성·가져오기로 만든 원고만 AI 초안과 비교해 학습합니다. 이 원고의 평가는 저장만 됩니다.</div>'}
      <label class="field">이 원고 평가<div class="rating">${[1,2,3,4,5].map(n=>`<button class="${f.rating>=n?'on':''}" data-rate="${n}" aria-label="${n}점">★</button>`).join('')}</div></label>
      <label class="field">에디터 메모 <small>AI에게 알려줄 점</small><textarea id="fbNote" maxlength="500" placeholder="예: 표지 제목이 너무 길었다 / 이 밈은 이미 식었다 / 공연 사진이 반응 좋음">${esc(f.note||'')}</textarea></label>
      <div class="section-label"><b>게시 성과</b><small>게시 후 인사이트 숫자</small></div>
      <div class="metrics">${[['saves','저장'],['likes','좋아요'],['comments','댓글'],['shares','공유'],['reach','도달']].map(([k,l])=>`<label class="field">${l}<input type="number" min="0" data-metric="${k}" value="${m[k]??''}"></label>`).join('')}</div>
      <button class="primary" id="saveFeedback">피드백 저장</button><p class="caption-hint">저장이 가장 중요한 성과 지표로 학습됩니다.</p>`;
    let rating=f.rating||null;
    $$('[data-rate]').forEach(b=>b.onclick=e=>{e.preventDefault();rating=Number(b.dataset.rate);$$('[data-rate]').forEach(x=>x.classList.toggle('on',Number(x.dataset.rate)<=rating));});
    $('#saveFeedback').onclick=action(async()=>{
      const metrics=Object.fromEntries($$('[data-metric]').map(i=>[i.dataset.metric,i.value]));
      const p=await api('/api/feedback',{id:project.id,rating,note:$('#fbNote').value,metrics});
      project.feedback=p.feedback;const stored=state.projects.find(x=>x.id===p.id);if(stored)stored.feedback=p.feedback;
      toast('피드백을 저장했습니다. 메모는 다음 원고부터 바로 반영됩니다(레퍼런스 노트 → 에디터 기억).');
    });
  }else{
    const tags=()=>cleanTags(project.content.hashtags,project.content.caption);
    el.innerHTML=`<div class="section-label"><b>피드 캡션</b><small id="captionCount">${project.content.caption.length}/2200</small></div><label class="field"><textarea id="captionText" maxlength="2200" aria-label="피드 캡션">${esc(project.content.caption)}</textarea></label>
      <div class="section-label"><b>해시태그 5개</b><small>도달 2 · 장르 2 · 아티스트 1</small></div><label class="field"><input id="tagText" value="${esc(tags().join(' '))}" aria-label="해시태그"></label>
      <div class="section-label"><b>업로드될 최종 캡션</b><small id="finalCount"></small></div><pre class="final-caption" id="finalCaption"></pre>
      <button class="secondary" id="copyCaption">최종 캡션 복사</button><p class="caption-hint">Instagram 업로드와 게시 패키지(caption.txt)에 이 최종 캡션이 들어갑니다. 해시태그는 항상 5개로 맞춰져요.</p>`;
    const refresh=()=>{const f=composeCaption(project.content);$('#finalCaption').textContent=f;$('#finalCount').textContent=`${f.length}/2200`;};refresh();
    $('#captionText').oninput=e=>{project.content.caption=e.target.value;$('#captionCount').textContent=`${e.target.value.length}/2200`;markDirty();refresh();};
    $('#tagText').onchange=e=>{project.content.hashtags=cleanTags(e.target.value.split(/[\s,]+/).filter(Boolean));e.target.value=project.content.hashtags.join(' ');markDirty();refresh();};
    $('#copyCaption').onclick=action(async()=>{await navigator.clipboard.writeText(composeCaption(project.content));toast('최종 캡션을 복사했습니다.');});
  }
  if(locked&&tab!=='feedback'){el.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);el.insertAdjacentHTML('afterbegin','<p class="tip">게시 단계의 원고입니다. 수정하려면 복제하세요.</p>');}
}
// 말투 검사(public/voice.js): 지금 카드에서 AI 말투로 읽히는 곳과 고치는 법. 글자를 칠 때마다 다시 검사합니다.
const fieldName={title:'헤드라인',body:'본문',note:'하단 문구',caption:'캡션'};
function renderLint(){
  const box=$('#lintBox');if(!box)return;
  const L=lintCards(project.content),mine=L.issues.filter(x=>x.card===selected),rest=L.issues.filter(x=>x.card===-1),other=L.issues.length-mine.length-rest.length;
  const row=x=>`<p><b>${esc(fieldName[x.field]||'')} · ${esc(x.label)}</b>${x.match?` <q>${esc(x.match)}</q>`:''}<small>${esc(x.fix)}</small></p>`;
  box.innerHTML=`<div class="lint"><div class="lint-head"><b>말투 검사</b><span class="score ${L.score>=80?'good':L.score>=55?'mid':'bad'}">원고 전체 ${L.score}점</span></div>
    ${mine.length?mine.map(row).join(''):'<p class="ok">이 카드는 사람 말투로 읽혀요.</p>'}${rest.map(row).join('')}
    ${other?`<p class="more">다른 카드에 ${other}곳 더 있어요.</p>`:''}
    <button class="secondary" id="polishBtn">✦ AI 말투 다듬기 · 원고 전체</button><small class="lint-foot">고쳐 쓴 뒤 마음에 안 들면 되돌릴 수 있어요. Claude 구독 사용량을 조금 씁니다(1~3분).</small></div>`;
  $('#polishBtn').onclick=action(polish);
  if(['published','publishing','uncertain'].includes(project.status))$('#polishBtn').disabled=true;
}
// AI 말투 다듬기: 검사기가 찾은 곳을 편집장 AI가 고쳐 쓰고 다시 검사합니다. 사실·사진·출처 연결은 그대로.
async function polish(){
  await save();const before=structuredClone(project.content),pid=project.id;
  const {id}=await api('/api/polish',{id:pid,revision:project.revision});
  const banner=$('#jobBanner'),lock=v=>{$('.editor-layout').inert=v;$('#generateBtn').disabled=v;};banner.hidden=false;banner.textContent='AI 말투를 검사하고 있습니다…';lock(true);
  const poll=async()=>{let j;try{j=await api('/api/jobs/'+id);}catch{return setTimeout(poll,3000);}
    if(j.status==='running'){banner.textContent=j.message;return setTimeout(poll,2500);}
    lock(false);if(j.status==='error'){banner.textContent=j.error;return toast(j.error);}
    put(j.project);if(project.id!==pid)return;project=structuredClone(j.project);dirty=false;updateStatus();renderInspector();await render();
    const rv=project.content.review;
    banner.innerHTML=rv?`<div class="review-box"><b>AI 말투 다듬기 완료</b> 말투 점수 ${rv.before}점 → ${rv.after}점${rv.fixes.length?'<ul>'+rv.fixes.map(f=>`<li>${esc(f)}</li>`).join('')+'</ul>':''}<button class="quiet" id="undoPolish">↩ 다듬기 전으로 되돌리기</button></div>`:'고칠 곳을 찾지 못했습니다.';
    const undo=$('#undoPolish');if(undo)undo.onclick=action(async()=>{if(project.id!==pid)throw new Error('다른 원고가 열려 있습니다.');project.content=before;markDirty();await save();renderInspector();await render();banner.textContent='다듬기 전 원고로 되돌렸습니다.';});
  };poll();
}
// 레퍼런스 노트(릴스 앱과 공유): 인기 매거진·릴스·플리의 실제 문구를 스스로 조사해 쌓고, 에디터가 고른 문구와 함께 말투 본보기로 씁니다.
async function showReference(){
  const R=await api('/api/reference'),lib=R.library,m=R.memory;
  const kindName={cover:'표지 제목',hook:'릴스 첫 자막',caption:'캡션 첫 줄',playlist:'플리 제목'},br=t=>esc(t).replace(/\n/g,' / ');
  modal('레퍼런스 노트',`<p>인기 인스타 매거진·릴스·플레이리스트가 표지와 첫 문장을 실제로 어떻게 쓰는지 <b>7일마다 스스로 조사</b>해서 쌓고, 원고를 쓰고 고칠 때 말투 본보기로 씁니다. 문구를 베끼지 않고 구조·길이·말맛만 배웁니다. ${lib.researchedAt?`<b>${new Date(lib.researchedAt).toLocaleString('ko-KR')}</b> 조사.`:'아직 조사한 적이 없습니다.'} ${R.running?'<b>· 조사 중… (5~10분)</b>':R.stale?'· 새로 조사할 차례입니다.':''}${R.error?`<br><span class="error-text">마지막 조사 실패: ${esc(R.error)}</span>`:''}</p>
    <div class="actions"><button class="primary" id="refreshRef" ${R.running?'disabled':''}>지금 새로 조사</button></div>
    <h3>내가 고른 레퍼런스 ${lib.user.length} <small>가장 우선해서 닮습니다</small></h3>
    <p class="caption-hint">인스타에서 “이 말투 좋다” 싶은 표지 제목이나 릴스 첫 자막을 그대로 붙여넣으세요. 한 줄에 하나씩, 여러 줄 가능.</p>
    <textarea id="refText" class="ref-input" placeholder="예) 요즘 다들 이 밴드 얘기만 함"></textarea>
    <div class="two-buttons"><select id="refKind">${Object.entries(kindName).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><button class="secondary" id="addRef">레퍼런스 추가</button></div>
    ${lib.user.map(s=>`<div class="source-item trend-item"><strong>${br(s.text)}</strong><small>${kindName[s.kind]||''}${s.note?' · '+esc(s.note):''}</small><button class="quiet" data-ref-del="${esc(s.id)}">지우기</button></div>`).join('')}
    <h3>에디터 기억 <small>내 메모·수정이 다음 원고에 바로 반영됩니다</small></h3>
    ${m.notes.length||m.edits.length||m.best.length?`${m.notes.map(n=>`<div class="source-item"><strong>“${esc(n.note)}”</strong><small>${esc(n.app)} · ${esc(n.keyword)}${n.rating?` · 평점 ${n.rating}/5`:''}</small></div>`).join('')}${m.edits.map(e=>`<div class="source-item"><small>${esc(e.app)} · ${esc(e.where)} — 내가 고친 문장</small><p><s>${esc(e.before)}</s><br>→ ${esc(e.after)}</p></div>`).join('')}${m.best.map(b=>`<div class="source-item"><small>${esc(b.app)} · 반응 좋았던 최종본</small><strong>${esc(b.cover)}</strong></div>`).join('')}`:'<p class="caption-hint">아직 없습니다. 원고를 고쳐서 승인하거나 피드백 탭에 메모·성과를 남기면 여기에 쌓입니다.</p>'}
    <h3>기본 후킹 공식 ${HOOKS.length}</h3>${HOOKS.map(h=>`<div class="source-item"><strong>${esc(h.name)}</strong><small>${esc(h.pattern)}</small><p>예) ${br(h.example)} — ${esc(h.why)}</p></div>`).join('')}
    ${lib.patterns.length?`<h3>조사에서 뽑은 구조 ${lib.patterns.length}</h3>${lib.patterns.map(p=>`<div class="source-item"><strong>${esc(p.name)}</strong><small>${esc(p.pattern)}</small><p>예) ${br(p.example)}${p.when?' · '+esc(p.when):''}</p></div>`).join('')}`:''}
    ${lib.samples.length?`<h3>조사한 실제 문구 ${lib.samples.length}</h3>${lib.samples.map(s=>`<div class="source-item"><strong>${br(s.text)}</strong><small>${esc(s.source)} · ${kindName[s.kind]||''}${s.formula?' · '+esc(s.formula):''}</small><p>${esc(s.why)}</p>${s.sourceUrl?`<a href="${esc(s.sourceUrl)}" target="_blank" rel="noreferrer">확인한 곳 ↗</a>`:''}</div>`).join('')}`:''}
    ${lib.voiceNotes.length?`<h3>잘되는 계정 말투 관찰</h3><p>${lib.voiceNotes.map(esc).join('<br>')}</p>`:''}
    ${lib.avoid.length?`<h3>요즘 안 먹히는 표현</h3><p>${lib.avoid.map(a=>`<b>${esc(a.phrase)}</b> — ${esc(a.reason)}`).join('<br>')}</p>`:''}`);
  $('#refreshRef').onclick=action(async()=>{await api('/api/reference/refresh',{});toast('레퍼런스 조사를 시작했습니다. 5~10분 걸려요.');await showReference();});
  $('#addRef').onclick=action(async()=>{const lines=$('#refText').value.split('\n').map(l=>l.trim()).filter(Boolean).slice(0,20);if(!lines.length)throw new Error('문구를 입력하세요.');let fail='';for(const text of lines)await api('/api/reference/add',{text,kind:$('#refKind').value}).catch(e=>{fail=e.message;});toast(fail||`레퍼런스 ${lines.length}개를 추가했습니다. 다음 원고부터 반영돼요.`);await showReference();});
  $$('[data-ref-del]').forEach(b=>b.onclick=action(async()=>{await api('/api/reference/remove',{id:b.dataset.refDel});await showReference();}));
  if(R.running){clearTimeout(showReference.t);showReference.t=setTimeout(()=>{if($('#modal').open&&$('#modalTitle').textContent==='레퍼런스 노트'&&!$('#refText')?.value)showReference().catch(()=>{});},8000);}
}
function modal(title,html){$('#modalTitle').textContent=title;$('#modalContent').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function templateOptions(classic=false){return (classic?'<option value="classic">기존 디자인</option>':'')+templates.map(t=>`<option value="${t.id}">${t.name} · ${t.tag}</option>`).join('');}
async function applyTemplate(id){
  if(['published','publishing','uncertain'].includes(project.status))throw new Error('게시한 원고는 복제한 뒤 디자인을 바꿔주세요.');
  project.content.template=id;project.content.theme='paper';$('#theme').value='paper';markDirty();await render();await save();toast('전체 카드에 디자인을 적용했습니다.');
}
async function templateGallery(id){
  const t=templateById(id);
  modal(t?t.name:'PICK 템플릿 라이브러리',t?`<p>${t.description}</p><p class="caption-hint">${t.tag} · 예시 원고이며 실제 뉴스가 아닙니다.</p><div class="template-sequence">${demoContent(id).cards.map((c,i)=>`<figure><canvas data-preview="${i}" aria-label="${i+1}장 디자인"></canvas><figcaption>${['표지','본문','강조','마무리'][i]}</figcaption></figure>`).join('')}</div><div class="actions"><button class="secondary" id="backTemplates">전체 템플릿</button><button class="secondary" id="useForNew">새 원고 스타일로 선택</button><button class="primary" id="applyTemplate">현재 원고에 적용</button></div>`:`<p>키워드에 맞는 편집 방식을 골라보세요. 카드를 누르면 표지부터 마지막 장까지 확인할 수 있습니다.</p><div class="template-grid">${templates.map(t=>`<button class="template-choice" data-template="${t.id}"><canvas aria-label="${t.name} 표지"></canvas><strong>${t.name}</strong><small>${t.tag}</small></button>`).join('')}</div><p class="caption-hint">사진이 없는 예시는 추상 그래픽으로 표시됩니다. 사진을 넣으면 해당 영역에 적용됩니다.</p>`);
  $('#modal').classList.add('template-modal');
  if(t){
    await Promise.all($$('[data-preview]').map(c=>drawCard(c,demoContent(id),Number(c.dataset.preview))));
    $('#backTemplates').onclick=action(()=>templateGallery());
    $('#useForNew').onclick=()=>{$('#generationTemplate').value=id;$('#modal').close();toast('새 원고 스타일을 선택했습니다. 키워드를 입력하고 생성하세요.');};
    $('#applyTemplate').onclick=action(async()=>{await applyTemplate(id);$('#modal').close();});
  }else{await Promise.all($$('[data-template]').map(async b=>{b.onclick=action(()=>templateGallery(b.dataset.template));await drawCard(b.querySelector('canvas'),demoContent(b.dataset.template),0);}));}
}
async function showSettings(){
  await save();const fresh=await api('/api/state');state.codex=fresh.codex;state.claude=fresh.claude;state.instagram=fresh.instagram;
  modal('PICK 연결 설정',`<div class="settings-row"><b>원고 생성 · Codex</b><p>${state.codex.loggedIn?'연결됨 · '+esc(state.codex.method):'로그인 필요'} · ChatGPT 구독의 Codex 사용량을 사용합니다.</p><p>폴더의 <b>AI 연결.cmd</b>를 실행하고 브라우저에서 ChatGPT 계정으로 로그인하세요. 비밀번호를 이 앱에 입력하지 않습니다.</p><p><a href="https://learn.chatgpt.com/docs/auth" target="_blank" rel="noreferrer">공식 인증 안내 ↗</a></p></div><div class="settings-row"><b>원고 생성 · Claude</b><p>${!state.claude?.installed?'Claude Code 설치 필요':state.claude.loggedIn?'연결됨 · '+esc(state.claude.method)+(state.claude.plan?' ('+esc(state.claude.plan)+')':''):'로그인 필요'} · Claude 구독의 Claude Code 사용량을 사용합니다. API 키는 사용하지 않습니다.</p><p>로그인이 필요하면 터미널에서 <b>claude auth login</b>을 실행하세요. Opus는 요금제에 따라 사용량이 빨리 소진될 수 있으니 평소엔 Sonnet을 권장합니다.</p></div><div class="settings-row"><b>ChatGPT / Gemini 원고 가져오기</b><p>원고 가져오기에서 조사 요청문을 복사해 현재 구독 중인 서비스에 붙여넣으세요. 받은 JSON을 가져오면 같은 편집 화면에서 카드가 만들어집니다.</p></div><div class="settings-row"><b>Instagram · ${state.instagram.configured?'설정 감지됨 (게시 권한 미확인)':'계정 연결 필요'}</b><p>직접 게시에는 프로 계정과 Meta 게시 권한, 공개 이미지 주소가 필요합니다. Meta에서 발급한 계정 ID와 게시용 토큰으로 아래에서 연결하세요. 자세한 발급 절차는 README에 있습니다. 연결 전에는 승인한 게시 패키지를 다운로드해 인스타그램에서 직접 올릴 수 있습니다.</p><label class="field">Instagram 계정 ID<input id="igID" inputmode="numeric" placeholder="숫자로 된 계정 ID"></label><label class="field">게시용 액세스 토큰<input id="igToken" type="password" autocomplete="off" placeholder="Meta에서 발급한 토큰"></label><label class="field">로그인 방식<select id="igLogin"><option value="instagram">Instagram Login</option><option value="facebook">Facebook Login</option></select></label><button class="secondary" id="connectIG">PICK 계정 확인하고 연결</button><p class="caption-hint">토큰은 실행 중에만 보관하며 파일에 저장하지 않습니다.</p></div><div class="actions"><button class="secondary" id="refreshConnection">연결 상태 새로고침</button></div>`);$('#refreshConnection').onclick=action(showSettings);$('#connectIG').onclick=action(async()=>{const r=await api('/api/instagram/connect',{userId:$('#igID').value,token:$('#igToken').value,login:$('#igLogin').value});$('#igToken').value='';state.instagram.configured=true;toast('@'+r.username+' 연결을 확인했습니다.');});
}
function importModal(){
  modal('ChatGPT · Gemini 원고 가져오기',`<p>1. 키워드에 맞춘 조사 요청문을 복사합니다.<br>2. ChatGPT 또는 Gemini에서 웹 검색을 켜고 요청합니다.<br>3. 받은 JSON을 아래에 붙여넣습니다.</p><div class="two-buttons"><button class="secondary" id="copyPrompt">조사 요청문 복사</button><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT ↗</a><a href="https://gemini.google.com/" target="_blank" rel="noreferrer">Gemini ↗</a></div><textarea id="importJSON" aria-label="AI 원고 JSON" placeholder="AI가 작성한 JSON을 붙여넣으세요"></textarea><div class="actions"><button class="primary" id="doImport">카드뉴스로 가져오기</button></div>`);
  $('#copyPrompt').onclick=action(async()=>{const {prompt}=await api('/api/prompt',{keyword:$('#keyword').value,count:$('#count').value,mode:$('#mode').value,hook:$('#hook').value,template:$('#generationTemplate').value});await navigator.clipboard.writeText(prompt);toast('조사 요청문을 복사했습니다.');});
  $('#doImport').onclick=action(async()=>{const raw=$('#importJSON').value.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');const content=JSON.parse(raw);content.template=$('#generationTemplate').value;const p=await api('/api/projects',{content,source:'import',hook:$('#hook').value});put(p);await selectProject(p);$('#modal').close();toast('원고를 가져왔습니다. 출처와 사진을 검토해 주세요.');});
}
const pct=v=>v===null||v===undefined?'—':Math.round(v*100)+'%';
const num=v=>v===null||v===undefined?'—':String(Math.round(v*10)/10);
async function showLearning(){
  const L=await api('/api/learning');state.learning={active:L.active};$('#guideVersion').textContent='v'+L.active;
  const active=L.versions.find(v=>v.version===L.active);
  modal('PICK 학습 현황',`<p>AI 초안을 에디터가 어떻게 고쳤는지, 평가와 게시 성과를 모아 <b>편집 가이드</b>를 스스로 갱신하고 다음 원고에 적용합니다. 사실 확인·출처·사진 권리 규칙은 학습으로 바뀌지 않습니다.</p>
    <div class="settings-row"><b>${L.running?'✦ 학습 중… (1~3분)':active?`현재 적용 중: 가이드 v${active.version}`:'현재 적용 중인 가이드 없음 (v0)'}</b>
      <p>학습 재료 ${L.samples}개 · 마지막 학습 후 새 재료 ${L.pending}개 · 새 재료 ${L.autoEvery}개마다 자동 학습${L.lastError?`<br><span class="error-text">마지막 학습 실패: ${esc(L.lastError)}</span>`:''}</p>
      ${active?`<p>${esc(active.summary)}</p><ol class="rules">${active.rules.map(r=>`<li><span class="area">${esc(r.area)}</span>${esc(r.rule)}<small>${esc(r.why)}</small></li>`).join('')}</ol>`:''}
      <div class="two-buttons"><button class="primary" id="learnNow" ${L.running?'disabled':''}>지금 학습하기</button>${L.active?'<button class="quiet" data-activate="0">가이드 끄기</button>':''}</div></div>
    <h3>가이드 버전별 성과</h3><p class="caption-hint">수정률이 낮을수록 AI 초안이 에디터가 원하는 방향에 가깝다는 뜻입니다. 버전별 원고가 쌓이면 개선 여부를 비교할 수 있어요.</p>
    <div class="table-wrap"><table class="learn-table"><tr><th>가이드</th><th>원고</th><th>평균 수정률</th><th>평점</th><th>평균 저장</th><th>평균 좋아요</th></tr>${L.stats.map(s=>`<tr><td>v${s.version}</td><td>${s.projects}</td><td>${pct(s.editRate)}</td><td>${num(s.rating)}</td><td>${num(s.saves)}</td><td>${num(s.likes)}</td></tr>`).join('')||'<tr><td colspan="6">아직 학습 재료가 없습니다. AI로 원고를 만들고, 고쳐서 승인하거나 피드백 탭에서 평가·성과를 입력하세요.</td></tr>'}</table></div>
    ${L.versions.length?`<h3>버전 기록</h3>${L.versions.map(v=>`<div class="source-item"><strong>v${v.version} · ${new Date(v.createdAt).toLocaleString('ko-KR')}</strong><small>원고 ${v.basedOn}개로 학습 · 규칙 ${v.rules.length}개${v.from?` · v${v.from}에서 갱신`:''}</small><p>${esc(v.summary)}</p>${v.version===L.active?'<small>적용 중</small>':`<button class="secondary" data-activate="${v.version}">이 버전으로 되돌리기</button>`}</div>`).join('')}`:''}`);
  $('#learnNow').onclick=action(async()=>{await api('/api/learning/run',{});toast('학습을 시작했습니다. 1~3분 걸려요.');await showLearning();});
  $$('[data-activate]').forEach(b=>b.onclick=action(async()=>{await api('/api/learning/activate',{version:Number(b.dataset.activate)});toast(b.dataset.activate==='0'?'가이드를 껐습니다.':`가이드 v${b.dataset.activate}을 적용했습니다.`);await showLearning();}));
  if(L.running){clearTimeout(showLearning.timer);showLearning.timer=setTimeout(()=>{if($('#modal').open&&$('#modalTitle').textContent==='PICK 학습 현황')showLearning().catch(()=>{});},4000);}
}
// 트렌드 브리핑(릴스 앱과 공유): 요즘 밈·후킹 공식·씬 이슈. 3일마다 자동 갱신
async function showTrends(){
  const T=await api('/api/trends'),b=T.brief;
  const fitName={hook:'릴스 첫 자막',cover:'표지',caption:'캡션 첫 줄',cta:'마무리'};
  modal('트렌드 브리핑',`<p>${b?`<b>${new Date(b.createdAt).toLocaleString('ko-KR')}</b> 조사 · 원고를 만들 때 AI가 여기서 맞는 밈을 골라 적재적소에 넣습니다.`:'아직 브리핑이 없습니다.'} ${T.running?'<b>· 새로 조사 중… (3~6분)</b>':T.stale?'· 3일이 지나 새로 조사할 차례입니다.':''}${T.error?`<br><span class="error-text">마지막 조사 실패: ${esc(T.error)}</span>`:''}</p>
    <div class="actions"><button class="primary" id="refreshTrends" ${T.running?'disabled':''}>지금 새로 조사</button></div>
    ${b?`<h3>요즘 밈·유행어 ${b.memes.length}</h3>${b.memes.map(m=>`<div class="source-item trend-item"><strong>${esc(m.phrase)}${m.heat==='hot'?' 🔥':''}</strong><small>${esc(m.meaning)} · ${m.fit.map(f=>fitName[f]||f).join(', ')} · ${m.tone==='emo'?'감성 OK':m.tone==='fun'?'가벼운 글':'두루'}</small><p>${esc(m.usage)}<br>예) ${esc(m.example)}</p>${m.sourceUrl?`<a href="${esc(m.sourceUrl)}" target="_blank" rel="noreferrer">근거 ↗</a>`:''}</div>`).join('')}
    <h3>쓰지 말 것</h3><p>${b.avoid.map(a=>`<b>${esc(a.phrase)}</b> — ${esc(a.reason)}`).join('<br>')||'없음'}</p>
    <h3>잘 먹히는 후킹 공식</h3>${b.hookFormats.map(h=>`<div class="source-item"><strong>${esc(h.name)}</strong><small>${esc(h.pattern)}</small><p>예) ${esc(h.example)}</p></div>`).join('')}
    <h3>이번 달 밴드 씬</h3>${b.sceneNews.map(n=>`<div class="source-item"><strong>${esc(n.topic)}</strong><p>${esc(n.why)}</p>${n.sourceUrl?`<a href="${esc(n.sourceUrl)}" target="_blank" rel="noreferrer">원문 ↗</a>`:''}</div>`).join('')||'<p>없음</p>'}`:''}`);
  $('#refreshTrends').onclick=action(async()=>{await api('/api/trends/refresh',{});toast('트렌드 조사를 시작했습니다. 3~6분 걸려요.');await showTrends();});
  if(T.running){clearTimeout(showTrends.t);showTrends.t=setTimeout(()=>{if($('#modal').open&&$('#modalTitle').textContent==='트렌드 브리핑')showTrends().catch(()=>{});},8000);}
}
async function review(){
  await save();for(let i=0;i<project.content.cards.length;i++)await drawCard(document.createElement('canvas'),project.content,i);
  modal('마지막 확인, 그리고 승인',`<p><b>${esc(project.content.keyword)}</b><br>${project.content.cards.length}장 · 1080 × 1350 · 출처 ${project.content.sources.length}개</p><p>현재 저장된 원고와 사진을 승인합니다. 실제 게시 버튼은 다음 단계에서 별도로 누릅니다.</p><label class="check"><input type="checkbox" id="checkFacts">원문을 열어 발언·날짜·수치를 확인했고, 감상과 사실을 구분했습니다.</label><label class="check"><input type="checkbox" id="checkVisual">모든 카드의 제목·본문·사진과 캡션을 확인했습니다.</label><label class="check"><input type="checkbox" id="checkRights">선택한 사진의 사용 조건과 크레딧을 확인했습니다.</label><div class="tip">사진이 있는 카드는 사진 탭의 ‘사용 권한·조건 확인’도 체크되어 있어야 합니다.</div><div class="actions"><button class="primary" id="approveNow">이 버전 승인하기</button></div>`);
  $('#approveNow').onclick=action(async()=>{project=await api('/api/approve',{id:project.id,revision:project.revision,checks:{facts:$('#checkFacts').checked,visual:$('#checkVisual').checked,rights:$('#checkRights').checked}});put(project);updateStatus();$('#modal').close();toast('승인했습니다. 게시 패키지를 저장하거나 Instagram에 게시하세요.');});
}
async function exportPackage(preview=false,silent=false){
  await save();if(!preview&&!project.approval)throw new Error('검토하고 승인한 뒤 게시 패키지를 저장하세요.');
  document.querySelector('main').inert=true;document.querySelector('.sidebar').inert=true;
  const snapshot=structuredClone(project);
  try{
    toast('고해상도 카드 이미지를 저장하고 있습니다…');const images=[];
    for(let i=0;i<snapshot.content.cards.length;i++){const canvas=await drawCard(document.createElement('canvas'),snapshot.content,i);images.push(canvas.toDataURL('image/jpeg',.95));}
    const result=await api('/api/export',{id:snapshot.id,revision:snapshot.revision,images,preview});project=result.project;put(project);
    if(silent)return result;
    const a=document.createElement('a');a.href=result.url;a.download='PICK.zip';a.click();
    modal(preview?'검토용 시안이 준비됐습니다':'게시 패키지가 준비됐습니다','<p>1080 × 1350 JPG '+images.length+'장, 캡션, 원문 출처, 편집 원고를 저장했습니다.</p><p><a href="'+esc(result.url)+'" download="PICK.zip">PICK.zip 다시 다운로드 ↓</a></p><p class="caption-hint">PC 저장 위치<br>'+esc(result.folder)+'</p><div class="tip">'+(preview?'검토용 초안입니다. 게시 전 원고와 사진 사용 조건을 확인하고 승인하세요.':'01.jpg부터 순서대로 인스타그램 피드에 선택하고 caption.txt의 내용을 붙여넣으세요.')+'</div>');
  }finally{document.querySelector('main').inert=false;document.querySelector('.sidebar').inert=false;}
}
async function publishModal(){await save();if(project.status==='uncertain'){modal('게시 결과 확인 필요',`<p>이전 게시 요청의 응답을 확인하지 못했습니다. 인스타그램에서 게시 여부를 확인하세요. 중복 게시를 막기 위해 새 요청은 잠겨 있습니다.</p><button class="secondary" id="reconcile">Meta에서 상태 확인</button>`);$('#reconcile').onclick=action(async()=>{const r=await api('/api/reconcile',{id:project.id});project=r.project;put(project);updateStatus();toast(`Meta 상태: ${r.remoteStatus}`);});return;}if(project.status==='published')throw new Error('이미 게시한 콘텐츠입니다.');if(!project.approval)throw new Error('먼저 현재 원고를 검토·승인해 주세요.');
  // 승인본 게시 패키지가 없으면 다운로드 없이 자동 저장
  if(!project.export||project.export.hash!==project.approval.hash){toast('게시용 카드 이미지를 준비하고 있습니다…');await exportPackage(false,true);}
  const {id}=await api('/api/instagram/prepare',{id:project.id});const pid=project.id;
  modal('Instagram 업로드 준비',`<p><b>${esc(project.content.keyword)}</b> · 카드 ${project.content.cards.length}장</p><p id="igStatus">준비 중…</p><div class="tip">전용 Instagram 창에서 만들기 → 사진 선택 → 원본 비율 → 캡션 입력까지 자동으로 진행하고, <b>‘공유하기’ 직전에 멈춥니다.</b> 마지막 버튼은 직접 눌러주세요.</div>`);
  const poll=async()=>{let j;try{j=await api('/api/jobs/'+id);}catch{return setTimeout(poll,3000);}
    const el=$('#igStatus');
    if(j.status==='running'){if(el)el.textContent=j.message;return setTimeout(poll,1500);}
    if(j.status==='error'){if(el)el.textContent='멈춤: '+j.error;toast(j.error);return;}
    if(j.status==='ready'){if(el)el.innerHTML='<b>준비 완료.</b> Instagram 창에서 사진 순서·캡션·계정을 확인하고 <b>공유하기</b>를 누르세요.'+(j.accountOk?'':'<br><span class="error-text">@_pick.kr 계정인지 자동 확인하지 못했습니다. 창 상단 계정을 꼭 확인하세요.</span>');return setTimeout(poll,3000);}
    if(j.status==='shared'){const p=j.project;put(p);if(project.id===pid){project=structuredClone(p);updateStatus();renderInspector();}if(el)el.textContent='게시 완료를 확인했습니다. 원고 상태를 ‘게시 완료’로 바꿨습니다.';toast('Instagram 게시 완료');}
  };poll();}
async function archive(){await save();$('#editorView').hidden=true;$('#archiveView').hidden=false;$('#archiveNav').classList.add('active');$('#editorNav').classList.remove('active');renderArchive();}
// 보관함 펼쳐보기(insta-ui.js)가 저장된 원고를 읽을 때 씁니다.
window.pickProject=id=>state?.projects.find(p=>p.id===id);
function renderArchive(){const q=$('#archiveSearch').value.toLowerCase();$('#archiveGrid').innerHTML='';for(const p of state.projects.filter(p=>p.content.keyword.toLowerCase().includes(q))){const b=document.createElement('button');b.className='archive-card';b.dataset.id=p.id;b.innerHTML=`<canvas aria-label="${esc(p.content.keyword)} 표지"></canvas><strong>${esc(p.content.keyword)}</strong><small>${p.content.cards.length}장 · ${esc(statuses[p.status])} · ${new Date(p.updatedAt).toLocaleDateString('ko-KR')}</small>`;b.onclick=action(()=>selectProject(p));$('#archiveGrid').append(b);drawCard(b.querySelector('canvas'),p.content,0).catch(()=>{});}}
// 사진 자동 고르기: 같은 곡의 MV 장면들 중 인물이 잘 나온 컷을 카드마다, 표지는 전체에서 가장 눈에 띄는 컷.
// 점수: 얼굴 크기가 사진 높이의 35% 안팎(가슴 위 클로즈업)일수록, 가운데일수록 높음. 얼굴 없는 컷(크레딧·풍경)은 0점.
async function autoCover(p){
  const c=p.content;if(!c.cards[0])return p;
  const scoreOf=async src=>{const img=await loadImage(src).catch(()=>null);if(!img)return 0;const f=await findFocus(img,src).catch(()=>null),face=f?.faces?.[0];if(!face)return 0;
    return Math.max(0,1-Math.abs(face.h-.35)/.35)*(1-Math.abs(face.cx-.5));};
  const groups=c.imageCandidates.filter(x=>x.frames?.length).map(x=>({cand:x,srcs:[...new Set([...x.frames,...(c.cards.filter(k=>k.imageSource===x.sourceUrl).map(k=>k.image))])]}));
  // 75% 지점 장면(frames[2])은 엔딩 크레딧이 겹치는 경우가 많아 감점
  const score=new Map();for(const g of groups)for(const s of g.srcs)score.set(s,(await scoreOf(s))*(g.cand.frames[2]===s?.6:1));
  for(const k of c.cards)if(k.image&&!score.has(k.image))score.set(k.image,await scoreOf(k.image));
  const used=new Set(),cards=c.cards.map(k=>({...k}));
  // 속장: 카드가 쓰는 곡의 장면 중 최고점(이미 쓴 컷은 피함)
  cards.forEach((k,i)=>{if(!i)return;const g=groups.find(x=>x.srcs.includes(k.image));if(!g)return;
    const best=g.srcs.filter(s=>!used.has(s)).sort((a,b)=>score.get(b)-score.get(a))[0];if(best&&score.get(best)>score.get(k.image))k.image=best;used.add(k.image);});
  // 표지: 전체 후보 중 최고점, 속장과 겹치지 않게
  const all=[...score.entries()].filter(([s])=>!used.has(s)).sort((a,b)=>b[1]-a[1])[0];
  if(all&&all[1]>.15&&all[0]!==cards[0].image){const g=groups.find(x=>x.srcs.includes(all[0]));cards[0]={...cards[0],image:all[0],...(g?{imageCredit:g.cand.credit,imageSource:g.cand.sourceUrl}:{})};}
  if(JSON.stringify(cards)===JSON.stringify(c.cards))return p;
  return api('/api/save',{id:p.id,revision:p.revision,content:{...c,cards}}).catch(()=>p);
}
async function generateNew(){
  await save();const key=$('#keyword').value.trim();if(!key)throw new Error('키워드를 입력해 주세요.');
  const model=$('#model').value;const result=await api('/api/generate',{keyword:key,count:$('#count').value,mode:$('#mode').value,model,hook:$('#hook').value,template:$('#generationTemplate').value});const banner=$('#jobBanner');banner.hidden=false;banner.textContent=`${$('#model').selectedOptions[0].textContent}로 준비 중…`;$('#generateBtn').disabled=true;
  async function poll(){try{const j=await api('/api/jobs/'+result.id);if(j.status==='running'){banner.textContent=j.message;setTimeout(poll,2500);}else{$('#generateBtn').disabled=false;if(j.status==='error'){banner.textContent=j.error;toast(j.error);return;}banner.textContent='표지에 쓸 가장 눈에 띄는 장면을 고르는 중…';j.project=await autoCover(j.project);put(j.project);await selectProject(j.project);const trends=j.project.content.trends||[];banner.textContent=(j.warnings?.length?j.warnings.join(' '):'조사와 카드 원고가 준비됐습니다. 출처와 사진을 검토해 주세요.')+(j.project.origin?.guideVersion?` · 학습 가이드 v${j.project.origin.guideVersion} 적용`:'')+(trends.length?` · 녹인 유행어: ${trends.map(t=>t.phrase).join(', ')} (출처 탭에서 근거 확인)`:'');
      const rv=j.project.content.review;if(rv)banner.insertAdjacentHTML('beforeend',`<div class="review-box"><b>AI 셀프 리뷰</b> 말투 점수 ${rv.before}점 → ${rv.after}점 (편집장 채점 ${rv.score}점에서 고쳐 씀)${rv.fixes.length?'<ul>'+rv.fixes.map(f=>`<li>${esc(f)}</li>`).join('')+'</ul>':''}</div>`);}}catch(e){banner.textContent=e.message;$('#generateBtn').disabled=false;}}
  poll();
}
async function init(){state=await api('/api/state');project=structuredClone(state.projects[0]);$('#today').textContent=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();$('#projectCount').textContent=state.projects.length;$('#keyword').value=project.content.keyword;$('#theme').value=project.content.theme;updateStatus();renderInspector();await render();
  $('#saveBtn').onclick=action(async()=>{await save();toast('저장했습니다.');});$('#reviewBtn').onclick=action(review);$('#packageBtn').onclick=action(()=>exportPackage());$('#draftExport').onclick=action(()=>exportPackage(true));$('#publishBtn').onclick=action(publishModal);$('#settingsBtn').onclick=action(showSettings);$('#importBtn').onclick=importModal;$('#closeModal').onclick=()=>$('#modal').close();$('#generateBtn').onclick=async()=>{try{await generateNew();}catch(e){toast(e.message);$('#generateBtn').disabled=false;}};
  $('#theme').onchange=e=>{if(['published','publishing','uncertain'].includes(project.status)){e.target.value=project.content.theme;toast('수정하려면 콘텐츠를 복제하세요.');return;}project.content.theme=e.target.value;markDirty();render();};
  $$('.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderInspector();});$('#archiveNav').onclick=action(archive);$('#editorNav').onclick=action(()=>selectProject(project));$('#archiveSearch').oninput=renderArchive;
  $('#newBtn').onclick=()=>{$('#keyword').value='';$('#keyword').focus();toast('새 키워드를 입력하고 조사하고 만들기를 누르세요.');};
  $('#duplicateBtn').onclick=action(async()=>{await save();const p=await api('/api/projects',{content:project.content});put(p);await selectProject(p);toast('새 초안으로 복제했습니다.');});
  $('#singleExport').onclick=action(async()=>{const c=await drawCard(document.createElement('canvas'),project.content,selected);const a=document.createElement('a');a.href=c.toDataURL('image/jpeg',.95);a.download=`PICK-preview-${selected+1}.jpg`;a.click();toast('검토용 JPG를 다운로드했습니다.');});
  $('#guideVersion').textContent='v'+(state.learning?.active||0);$('#learningBtn').onclick=action(showLearning);$('#trendsBtn').onclick=action(showTrends);$('#referenceBtn').onclick=action(showReference);
  $('#figmaExport').onclick=action(async()=>{
    await save();const button=$('#figmaExport');
    const pkg=await figmaPackage(project.content,(i,n)=>{button.textContent=`Figma 레이어 준비 중 ${i}/${n}…`;}).finally(()=>{button.textContent='Figma로 내보내기 ↗';});
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(pkg)],{type:'application/json'}));
    a.download=`PICK-figma-${project.content.keyword.replace(/[\\/:*?"<>|]/g,'').slice(0,40)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    modal('Figma로 보내기',`<p>다운로드 폴더에 <b>${esc(a.download)}</b>를 저장했습니다. 카드 ${pkg.cards.length}장이 글자·사진·그래픽 레이어로 나뉘어 있습니다.</p><p><b>처음 한 번만</b> — Figma 데스크톱 앱에서 파일을 열고 메뉴 <b>Plugins → Development → Import plugin from manifest…</b>를 선택한 뒤, PICK 폴더의 <b>figma-plugin\\manifest.json</b>을 고르세요.</p><p><b>가져오기</b> — <b>Plugins → Development → PICK Studio 가져오기</b>를 실행하고 방금 저장한 JSON 파일을 선택하세요.</p><div class="tip">글자는 Figma 텍스트 레이어로 바로 수정할 수 있고, ‘사진’ 레이어는 선택 후 이미지 채우기를 바꾸면 교체됩니다. 카드와 같은 글꼴로 보려면 PC에 Pretendard가 설치되어 있어야 합니다. 없으면 다른 한글 글꼴로 대체됩니다.</div>`);
  });
  $('#helpBtn').onclick=()=>modal('매일의 PICK, 이렇게 만드세요',`<p><b>01 키워드</b> — 아티스트·신보·공연·주제를 입력하세요.<br><b>02 조사</b> — GPT(Codex) 또는 Claude로 자동 생성하거나 ChatGPT/Gemini 원고를 가져옵니다. AI가 먼저 ‘누가 왜 저장·공유하나’ 각도를 정하고, 표지 후보 5개를 쓴 뒤, 말투 검사기와 편집장 AI가 AI 말투를 걸러 고쳐 씁니다.<br><b>03 편집</b> — 표지 후보를 눌러 고르고, ‘말투 검사’에 뜨는 곳을 고치거나 ‘AI 말투 다듬기’를 누릅니다. 사진, 출처, 캡션도 확인합니다.<br><b>04 승인</b> — 원문과 사진을 검토하고 현재 버전을 승인합니다.<br><b>05 게시</b> — 게시 패키지를 저장하거나 연결된 Instagram 계정에 게시합니다.</p><div class="tip">매일 자동으로 게시되지 않습니다. 키워드를 넣어 생성한 뒤 직접 승인하는 방식입니다.</div>`);
  $('#generationTemplate').innerHTML=templateOptions();
  // 마지막으로 고른 AI 모델과 후킹 강도를 기억합니다.
  for(const id of ['model','hook']){try{const v=localStorage.getItem('pick.'+id);if(v&&[...$('#'+id).options].some(o=>o.value===v))$('#'+id).value=v;}catch{}$('#'+id).addEventListener('change',e=>{try{localStorage.setItem('pick.'+id,e.target.value);}catch{}});}
  $('#theme').options[0].textContent='템플릿 기본 색상';
  $('#templateGallery').onclick=action(()=>templateGallery());
  $('#modal').addEventListener('close',()=>$('#modal').classList.remove('template-modal'));
  document.body.classList.remove('loading');$('#loadingNotice').classList.add('done');setTimeout(()=>$('#loadingNotice')?.remove(),500);
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
}
init().catch(e=>{$('#loadingNotice').textContent='앱을 불러오지 못했습니다. 새로고침해 주세요. '+e.message;});

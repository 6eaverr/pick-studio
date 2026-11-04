// PICK 말투 기준 + AI 말투 검사기 + 후킹 공식.
// 서버(생성·셀프 리뷰 프롬프트)와 화면(편집 중 실시간 표시)이 함께 씁니다.
// 이 파일은 두 앱(PICK Studio·PICK Reels)에 똑같이 들어 있습니다(public/voice.js).
// 근거: 2026-10 조사 — 한국어 AI 글 상투 패턴 정리, 인스타 매거진 표지 기획 분석, 릴스 후킹 분석,
// 플레이리스트 제목 분석, 2026 인스타 알고리즘(DM 공유 > 저장 > 시청 유지), 그리고 PICK 에디터가 남긴 피드백.

// ── 1. 말투 기준(프롬프트에 그대로 들어감) ──
export const VOICE=`[PICK 말투 — 이 기준이 가장 중요합니다]
독자는 피드를 넘기다 0.5초 안에 멈출지 정합니다. 음악 잘 아는 친구가 DM으로 "이거 들어봐" 하고 보내는 말투로 쓰세요. 보도자료·백과사전·광고 문구처럼 읽히면 실패입니다.
1. 한 장(한 씬)에 말은 하나. 읽은 사람이 "그래서 뭐?"라고 묻지 않게, 듣는 사람에게 생기는 일을 씁니다(언제·어디서·어떤 기분에 듣는지, 어느 대목에서 뭐가 들리는지).
2. 종결을 섞으세요: 명사로 끊기("퇴근길 직진용"), 단정("이 곡은 드럼이 다 한다"), 가벼운 구어("~임", "~더라", "~거든")와 "~요"를 번갈아. 모든 문장이 "~요"나 "~습니다"로 끝나면 안 됩니다.
3. 쓰지 않는 표현: "~해보세요/들어보세요/만나보세요/따라가 보세요", "소개합니다/골랐어요/정리했어요/준비했어요", "여러분/당신", "다양한/특별한/매력적인/감성적인/독보적인", "결·온도·여운·서사·질감" 같은 뜬 비유, "~를 통해/~에 대해/~뿐만 아니라/단순한 ~가 아니라", "또한/이처럼/특히/무엇보다", 긴 줄표(—), "역대급/충격/모르면 손해/총정리".
4. 발매일·작사작곡·수록 앨범·수상 이력은 그 장의 핵심일 때만, 한 장에 숫자·날짜는 하나까지. 조사한 걸 다 쓰지 마세요. 확인한 사실은 sources에 남기면 충분합니다.
5. "에디터 감상:", "PICK 큐레이션입니다", "~기준" 같은 면책 문구를 카드·자막에 쓰지 마세요. 필요하면 캡션 맨 끝에 한 줄만.
6. 같은 정보를 두 번 쓰지 마세요. 제목에 쓴 말을 본문에서, 앞 장에 쓴 말을 뒷 장이나 캡션에서 반복하지 않습니다.
7. 유행어·밈은 그 말을 모르는 사람이 읽어도 문장이 바로 이해될 때만 씁니다. 조금이라도 헷갈리면 빼세요. 밈 없이도 후킹은 됩니다.
[고쳐 쓰기 예시 — 말투만 참고하고 내용은 복사하지 마세요. 왼쪽이 AI 말투, 오른쪽이 PICK]
✗ "2023년 1월 27일 나온 EP에서 타이틀곡을 맡은 곡이에요. 작사·작곡은 김승주, 편곡은 박태욱." → ✓ "만화 주인공이 된 기분이 필요한 날. 첫 EP 타이틀곡."
✗ "익숙한 곡의 여운을 안고, 악기들이 맞물리는 재미까지 따라가 보고 싶을 때 추천해요." → ✓ "기타 리프 사이로 드럼이 파고든다. 걸음이 빨라지는 곡."
✗ "에디터 감상: 앞의 세 곡보다 한결 느슨하고 솔직한 온도" → ✓ "넷 중에 제일 힘 빼고 부른 곡."
✗ "저장 안 하면 연락 없네 잘 살아" (밈 때문에 뜻이 안 읽힘) → ✓ "페스티벌 가기 전에 저장."
✗ 표지 "(히트곡) 다음엔 뭘 들을까" → ✓ 표지 "(히트곡)만 듣고\\n[이 밴드 안다고 하지 마]"`;

// ── 2. 후킹 공식(표지·릴스 첫 자막). 예문은 구조 설명용 ──
export const HOOKS=[
  {name:'상황 특정',pattern:'[언제·어디서] + 곡 수/할 일',example:'막차 놓친 밤\n택시에서 트는 4곡',why:'내 얘기 같은 장면이 보이면 멈춘다'},
  {name:'통념 뒤집기',pattern:'다들 아는 것 말고 / ~만 알면 반쪽',example:'히트곡은 뺐다\n실리카겔 숨은 3곡',why:'아는 줄 알았던 걸 흔든다'},
  {name:'숫자 + 얻는 것',pattern:'[숫자]로 끝나는 [결과]',example:'입문은\n이 3곡이면 끝',why:'얼마나 걸리고 뭘 얻는지 바로 보인다'},
  {name:'구체적 출처',pattern:'[누가 직접] 꼽은/말한 + 대상 (출처로 확인된 경우만)',example:'멤버가 직접\n"끝판왕"이라 부른 곡',why:'불안 조장 대신 믿을 만한 배경이 궁금증을 만든다'},
  {name:'결말 감추기',pattern:'결과만 보여주고 이유는 다음 장',example:'이 팀, 1년 만에\n페스티벌 메인이 됐다',why:'이유가 궁금해서 넘긴다'},
  {name:'단정 선언',pattern:'논쟁을 각오한 한 줄',example:'올가을 페스티벌은\n이 팀 보러 가는 거다',why:'동의든 반박이든 반응하게 된다'},
  {name:'기준점 비교',pattern:'[아는 팀] 좋아하면 [새 팀]',example:'검정치마 좋아하면\n이 팀도 맞음',why:'아는 이름이 새 이름의 입구가 된다'},
  {name:'공감 호출',pattern:'[이런 사람] 모여 / 나만 그래?',example:'플리에 실리카겔만\n남은 사람',why:'자기 얘기면 저장하고 친구에게 보낸다'},
  {name:'맥락 없이 던지기',pattern:'설명 없이 반응부터',example:'아니 이게\n데뷔곡이라고',why:'뭔지 몰라서 넘겨 본다'},
  {name:'양자택일',pattern:'A vs B, 하나만',example:'하나만 남긴다면\nNO PAIN vs T',why:'고르고 싶어서 댓글을 단다'},
  {name:'장면 제목',pattern:'플리 제목처럼 시간+장소+기분',example:'늦은 밤 집 가는\n택시 뒷자리에서',why:'상황이 그려지면 그때 꺼내려고 저장한다'},
  {name:'보낼 사람 지정',pattern:'[이런 친구]한테 보내',example:'밴드 입문하겠다는\n친구한테 보내',why:'DM 공유가 도달에 가장 크게 작용한다'},
];
export const STALE_HOOKS=['모르면 손해','꼭 알아야 할','총정리','역대급','충격','레전드','~에 대해 알아보자','~ 추천','다음엔 뭘 들을까','어때요?'];
export const hooksForPrompt=()=>`[후킹 공식 — 표지/첫 자막은 이 중 하나로]\n${HOOKS.map(h=>`- ${h.name}: ${h.pattern} (예: ${h.example.replace(/\n/g,' / ')})`).join('\n')}\n낡아서 안 먹히는 공식: ${STALE_HOOKS.join(', ')}`;

// ── 3. AI 말투 검사기 ──
// weight: 1 가벼움, 2 뚜렷함, 3 반드시 고칠 것. only: 적용 위치(없으면 전체). skip: 제외 위치.
const TELLS=[
  {id:'invite',weight:2,label:'광고식 권유',re:/[가-힣]+\s?보세요|보실래요|볼까요\??|어떨까요|추천(해요|합니다|드려요|드립니다)|해\s?주세요(?!\s*$)/g,fix:'‘~해보세요’ 대신 단정하거나 명사로 끊기. 예: “퇴근길에 틀 곡.”'},
  {id:'intro',weight:2,label:'예고하는 소개문',re:/소개(합니다|할게요|해요|드려요|해\s?드릴)|알아(볼까요|보겠습니다|보자|봐요)|살펴(볼까요|보겠습니다|봐요|보자)|(정리|준비|선정)했(어요|습니다)|골랐(어요|습니다)|모아\s?봤(어요|습니다)|이어집니다|이어가\s?보세요/g,fix:'뭘 할지 예고하지 말고 내용부터.'},
  {id:'abstract',weight:2,label:'빈 수식어',re:/다양한|다채로운|특별한|매력적인|독보적인|감성적인|감각적인|인상적인|환상적인|색다른|남다른|독특한 매력|깊은 (울림|여운|감동)|귀를 사로잡|마음을 (울리|사로잡)|선사(합니다|해요|하는|할)|세계로|속으로 (빠져|떠나)|물들(이|어|입)/g,fix:'꾸미는 말을 빼고 들리는 것·상황을 그대로.'},
  {id:'metaphor',weight:2,label:'뜬 비유',re:/(한|다른|비슷한|같은|솔직한|따뜻한|차가운|서늘한|느슨한)\s?온도|온도(의|가|로|를)|(거친|다른|같은|비슷한|고운|섬세한)\s?결|결을\s?(더하|따라|가진|살)|(^|\s)결(이|은|의|로|도)(?=\s|$)|여운(을|이|으로|까지)|서사(를|가|의)|질감|밀도\s?(높은|있는)|숨을 고르|한결 (느슨|차분|가벼)/g,fix:'‘결·온도·여운’ 대신 구체적으로: 어떤 악기가, 어느 대목에서, 어떤 상황에.'},
  {id:'translation',weight:2,label:'번역투',re:/(을|를) 통해|에 대해|에 대한|에 있어서?|함으로써|(으)?로 인해|에 의해|되어지|하는 것이 (중요|필요)|라고 할 수 있|라고 볼 수 있|에서의|으로의/g,fix:'‘~를 통해’ → ‘~로’, ‘~에 대해’ → 빼기.'},
  {id:'hedge',weight:1,label:'흐린 말끝',re:/일 수 있(어요|습니다)|것 같(아요|습니다)|인 셈(이에요|입니다)|듯(해요|합니다)|(느껴|들릴|보일) 수 있/g,fix:'단정하세요.'},
  {id:'contrast',weight:2,label:'‘단순한 ~가 아니라’ 구조',re:/단순(한|히) [^.\n]{1,20}(이|가) 아니|그저 [^.\n]{1,15}(이|가) 아닌|에 그치지 않|뿐만 아니라|뿐 아니라|[가-힣]을 넘어(?!가)/g,fix:'부정하고 뒤집는 구조 대신 하려는 말을 바로.'},
  {id:'connector',weight:1,label:'접속어',re:/(^|[.!?\n]\s*)(또한|더불어|이처럼|이렇듯|특히|무엇보다|나아가|한편|따라서|그러므로|결론적으로|마지막으로|그리고,|즉,)/g,fix:'접속어를 지우고 문장을 끊으세요.'},
  {id:'disclaimer',weight:2,label:'면책 문구',skip:['caption'],re:/에디터(의)?\s?(감상|생각|해석|취향|한마디)[:：]?|큐레이션(입니다|이에요|임)\b|PICK의 감상|(에디터|PICK)\s?기준|해석은 에디터|감상(입니다|이에요)\s*$/g,fix:'카드·자막에서 빼고, 필요하면 캡션 맨 끝 한 줄로.'},
  {id:'you',weight:1,label:'‘여러분/당신’',re:/여러분|당신(의|은|이|에게|도)?/g,fix:'호칭을 빼고 상황을 바로.'},
  {id:'formal',weight:1,label:'보도자료 말투(-습니다)',skip:['caption'],re:/[가-힣](습니다|ㅂ니다)(?=[.!?\s]|$)|(입니다|합니다|됩니다|했습니다)(?=[.!?\s]|$)/g,fix:'카드에선 ‘-습니다’ 대신 짧게 끊기.'},
  {id:'dash',weight:1,label:'긴 줄표',re:/\s[—–]\s|—/g,fix:'줄표 대신 문장을 나누거나 쉼표.'},
  {id:'stale',weight:2,label:'낡은 후킹',only:['cover','hook','title','scene','caption'],re:/모르면 손해|꼭 알아야 할|총정리|역대급|충격적?|레전드|알아보자|대공개|화제의/g,fix:'불안·과장 대신 구체적 장면이나 출처로.'},
  {id:'weakq',weight:2,label:'힘없는 질문',only:['cover','hook'],re:/뭘 들을까|어때요\??|어떤가요|알고 계셨나요|들어보셨나요|아시나요|궁금하(다면|신가요)/g,fix:'묻지 말고 단정하거나 상황을 던지세요.'},
  {id:'emoji',weight:1,label:'이모지 과다',re:/(\p{Extended_Pictographic}[️‍]*){2,}|(\p{Extended_Pictographic}.*){3,}/gu,fix:'이모지는 없거나 하나.'},
  {id:'exclaim',weight:1,label:'느낌표 남발',re:/!{2,}|(![^!]*){3,}/g,fix:'느낌표는 하나까지.'},
];
const FACT_DATE=/\d{4}\s?년(\s?\d{1,2}\s?월)?(\s?\d{1,2}\s?일)?|\d{1,2}\s?월\s?\d{1,2}\s?일|\d{4}\.\d{1,2}(\.\d{1,2})?/g;
const FACT_CREDIT=/작사|작곡|편곡|수록곡|수록|선공개|발매|타이틀곡|정규\s?\d집|트리플 타이틀|지원작|대상 곡|EP\b|싱글로/g;
const chars=s=>[...String(s||'').replace(/\s/g,'')].length;
export const plainText=s=>String(s||'').replace(/[[\]]/g,'');
const tokens=s=>plainText(s).toLowerCase().split(/[^0-9a-z가-힣]+/).map(w=>w.replace(/(으로|에서|에게|까지|부터|처럼|보다|이라|라고|하고|이고|은|는|이|가|을|를|의|에|로|와|과|도|만)$/,'')).filter(w=>w.length>=2);
const issue=(t,match,extra={})=>({id:t.id,label:t.label,fix:t.fix,weight:t.weight,match:String(match||'').trim().slice(0,30),...extra});

// 한 덩어리 글 검사. kind: cover|title|body|note|caption|hook|scene|sub
export function lintText(text,kind='body'){
  const raw=String(text||''),s=plainText(raw),out=[];
  if(!s.trim())return out;
  for(const t of TELLS){
    if(t.only&&!t.only.includes(kind))continue;if(t.skip?.includes(kind))continue;
    const m=[...s.matchAll(t.re)];if(!m.length)continue;
    // 캡션의 권유·질문은 한 번까지 자연스러움(댓글 유도)
    if(kind==='caption'&&['invite'].includes(t.id)&&m.length<2)continue;
    out.push(issue(t,m[0][0].replace(/^[.!?\n\s]+/,''),{count:m.length}));
  }
  const lines=s.split('\n').filter(l=>l.trim());
  const L=(id,label,fix,weight,match='')=>out.push({id,label,fix,weight,match});
  if(kind==='cover'||kind==='hook'){
    const max=kind==='cover'?13:12;
    if(lines.length>(kind==='cover'?3:2))L('lines','줄 수 초과','표지·첫 자막은 2줄(길어도 3줄)까지.',2);
    const long=lines.find(l=>chars(l)>max);if(long)L('long','한 줄이 김',`한 줄 ${max}자 안쪽으로. 지금 ${chars(long)}자.`,2,long);
    if(chars(s)<6)L('short','너무 짧아 뜻이 안 읽힘','무슨 얘기인지 단서 하나는 있어야 합니다.',2);
  }
  if(kind==='title'&&lines.length>2)L('lines','제목 줄 수 초과','속장 제목은 2줄까지.',1);
  if(kind==='title'&&lines.some(l=>chars(l)>15))L('long','제목이 김','한 줄 12자 안쪽으로.',1,lines.find(l=>chars(l)>15));
  if(kind==='body'){
    const n=chars(s);if(n>80)L('toolong','본문이 김',`한두 문장 35~70자로. 지금 ${n}자.`,n>120?3:2);
    const facts=(s.match(FACT_DATE)||[]).length+(s.match(FACT_CREDIT)||[]).length;
    if(facts>=3)L('wiki','발매일·크레딧 나열','백과사전처럼 읽힙니다. 이 장에 꼭 필요한 숫자 하나만 남기세요.',3,(s.match(FACT_DATE)||s.match(FACT_CREDIT))[0]);
    else if(facts===2&&n>60)L('wiki','사실 나열','숫자·크레딧은 하나만 남기고 듣는 이유를 쓰세요.',1,(s.match(FACT_DATE)||s.match(FACT_CREDIT))[0]);
  }
  if(kind==='note'){
    if(chars(s)>22)L('toolong','하단 문구가 김','비우거나 12자 안쪽으로.',1);
  }
  if(kind==='scene'){
    if(lines.length>2)L('lines','자막 줄 수 초과','자막은 2줄까지.',2);
    if(lines.some(l=>chars(l)>13))L('long','자막 한 줄이 김','한 줄 8~12자.',2,lines.find(l=>chars(l)>13));
  }
  if(kind==='sub'){
    if(chars(s)>26)L('toolong','보조 문구가 김','18자 안쪽 한 줄, 없어도 됩니다.',1);
    const facts=(s.match(FACT_DATE)||[]).length+(s.match(FACT_CREDIT)||[]).length;
    if(facts>=2)L('wiki','발매일·크레딧 나열','보조 문구에 날짜·수록 정보를 붙이지 마세요.',2,(s.match(FACT_DATE)||s.match(FACT_CREDIT))[0]);
  }
  if(kind==='caption'){
    const body=s.split(/\n\s*(출처|원문|사진)\s*[:：]?/)[0];
    if(chars(body)>520)L('toolong','캡션이 김','첫 줄 후킹 + 2~3줄 + 질문 한 줄이면 충분합니다.',1);
  }
  return out;
}
// 문장 끝이 한 가지로만 끝나는지(‘~요’ 일색)
function endingIssue(texts){
  const sents=texts.flatMap(t=>plainText(t).split(/[.!?\n]+/)).map(x=>x.trim()).filter(x=>chars(x)>=6);
  if(sents.length<5)return null;
  const yo=sents.filter(x=>/요$/.test(x)).length;
  return yo/sents.length>=.7?{id:'ending',label:'문장 끝이 전부 ‘~요’',fix:'명사로 끊기·단정형·가벼운 구어를 섞으세요.',weight:3,match:`${sents.length}문장 중 ${yo}문장`}:null;
}
const overlap=(a,b)=>{const A=new Set(tokens(a)),B=new Set(tokens(b));if(A.size<3||B.size<3)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.min(A.size,B.size);};
const scoreOf=(issues,units)=>Math.max(0,Math.round(100*(1-issues.reduce((a,x)=>a+x.weight,0)/(units*4+6))));

// 카드뉴스 전체 검사 → {score, issues:[{card, field, ...}]}  card: -1은 캡션/전체
export function lintCards(content){
  const out=[],cards=content.cards||[];
  const add=(card,field,list)=>list.forEach(x=>out.push({card,field,...x}));
  cards.forEach((c,i)=>{
    const cover=i===0;
    add(i,'title',lintText(c.title,cover?'cover':'title'));
    if(cover){if(c.body?.trim())add(i,'body',[{id:'coverBody',label:'표지에 설명문',fix:'표지는 제목만. 본문을 비우세요.',weight:c.body.trim().length>24?3:1,match:c.body}]);}
    else{
      add(i,'body',lintText(c.body,'body'));
      if(overlap(c.title,c.body)>=.6)add(i,'body',[{id:'dup',label:'본문이 제목을 반복',fix:'제목에 쓴 말은 본문에서 빼세요.',weight:2,match:''}]);
      for(let k=1;k<i;k++)if(overlap(cards[k].body,c.body)>=.5){add(i,'body',[{id:'dup',label:`${k+1}장과 내용 중복`,fix:'앞 장에서 한 말을 다시 하지 마세요.',weight:2,match:''}]);break;}
    }
    add(i,'note',lintText(c.note,'note'));
  });
  const e=endingIssue(cards.slice(1).map(c=>c.body));if(e)out.push({card:-1,field:'body',...e});
  add(-1,'caption',lintText(content.caption,'caption'));
  return {score:scoreOf(out,cards.length),issues:out};
}
// 릴스 대본 전체 검사 → {score, issues:[{scene, field, ...}]}
export function lintScenes(content){
  const out=[],scenes=content.scenes||[];
  const add=(scene,field,list)=>list.forEach(x=>out.push({scene,field,...x}));
  scenes.forEach((s,i)=>{
    add(i,'text',lintText(s.text,i===0?'hook':'scene'));
    add(i,'sub',lintText(s.sub,'sub'));
    for(let k=0;k<i;k++)if(overlap(scenes[k].text,s.text)>=.7){add(i,'text',[{id:'dup',label:`${k+1}번 씬과 같은 말`,fix:'같은 말을 반복하지 마세요.',weight:2,match:''}]);break;}
  });
  add(-1,'caption',lintText(content.caption,'caption'));
  return {score:scoreOf(out,scenes.length),issues:out};
}
// 검사 결과를 리뷰 프롬프트에 넣을 한 줄 목록으로
export function lintForPrompt(result,unit='장'){
  if(!result.issues.length)return '검사기가 찾은 문제 없음.';
  return result.issues.map(x=>{const n=x.card??x.scene;return `- ${n<0?(x.field==='caption'?'캡션':'전체'):`${n+1}${unit} ${x.field}`}: ${x.label}${x.match?` (“${x.match}”)`:''} → ${x.fix}`;}).join('\n');
}

// ── 지어낸 숫자 찾기: 고쳐 쓴 글(text)에 원문·출처(corpus)에 없는 숫자가 있는지 ──
// 연도·날짜·연차·집수 같은 ‘사실 단위’는 숫자+단위가 원문에 그대로 있어야 하고, 그 밖의 12 이하 작은 수(곡 수·순번)는 허용합니다.
const FACT_UNIT='년|월|일|집|주년|주|회|차|세|살|억|천|%|위|시간|분|명|장';
export function inventedNumbers(text,corpus){
  const flat=String(corpus||'').replace(/\s/g,''),nums=new Set(flat.match(/\d+(?:[.,]\d+)*/g)||[]),out=[];
  for(const [tok,n,unit] of String(text||'').replace(/\s/g,'').matchAll(new RegExp(`(\\d+(?:[.,]\\d+)*)(${FACT_UNIT})?`,'g'))){
    if(unit&&!['장','명','분','위'].includes(unit)){if(!flat.includes(tok))out.push(tok);}
    else if(!nums.has(n)&&!(Number(n.replace(/,/g,''))<=12))out.push(tok);
  }
  return out;
}

// ── 4. 표지/첫 자막 후보 점수(0~100). 후보를 나란히 비교할 때 씁니다 ──
export function scoreHook(title,kind='cover'){
  const s=plainText(title),lines=s.split('\n').filter(l=>l.trim()),n=chars(s);
  let score=62;const notes=[];
  const bump=(d,why)=>{score+=d;notes.push(`${d>0?'+':''}${d} ${why}`);};
  if(/\d/.test(s))bump(8,'숫자');
  if(lines.length===2)bump(6,'2줄');
  if(lines.length&&lines.every(l=>chars(l)>=4&&chars(l)<=12))bump(8,'한 줄 길이 적당');
  if(/말고|빼고|빼면|만 (듣|알|보)|아직|진짜|이거|다음|보다|vs|VS|하지 마|아니|라고$|사람$|끝$|맞음$/.test(s))bump(8,'대비·단정');
  if(/[A-Za-z]{3,}|['‘“"][^'’”"]+['’”"]/.test(s))bump(4,'고유 이름');
  if(/\[[^\]]+\]/.test(String(title)))bump(3,'강조 줄');
  if(n>26)bump(-14,'전체가 김');
  if(n<6)bump(-20,'너무 짧음');
  for(const x of lintText(title,kind))bump(-7*x.weight,x.label);
  if(/(추천|소개|모음|플레이리스트|플리|리스트|이야기|정리)$/.test(lines.at(-1)||''))bump(-12,'설명형 끝맺음');
  return {score:Math.max(0,Math.min(100,score)),notes};
}

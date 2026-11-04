// Shared by the renderer, editor and research prompt. Legacy projects keep classic.
export const templates=[
  {id:'editorial',cover:'#ff6a4d',name:'커버 스토리',en:'COVER STORY',tag:'아티스트 · 인터뷰 · 컴백',description:'사진을 넓게 쓰고, 짧은 제목과 넉넉한 여백으로 인물을 중심에 둡니다.',accent:'#ee553d',bg:'#191a18',ink:'#ffffff',title:'지금, 우리가\n이 아티스트를\n듣는 이유',body:'대표곡에서 최근 작업까지. 한 사람의 음악을 이해하는 세 가지 단서.',flow:'표지의 질문 → 가장 중요한 답 → 음악적 변화 → 대표 작업 → 독자에게 남길 발견',sample:'아티스트 집중 조명'},
  {id:'bulletin',name:'뮤직 브리핑',en:'MUSIC BRIEF',tag:'신보 소식 · 발표 · 이슈',description:'강한 색면과 큰 헤드라인, 분리된 사실 정리로 핵심을 빠르게 전합니다.',accent:'#ef553e',bg:'#f2f1e9',ink:'#171916',title:'이번 주,\n음악 씬에서\n놓치면 아쉬운 것',body:'발표된 내용부터 정확하게. 새 소식과 확인할 포인트를 정리합니다.',flow:'무엇이 달라졌나 → 공식 확인된 사실 → 이전과 달라진 점 → 일정/영향 → 확인할 원문',sample:'이번 주 음악 소식'},
  {id:'sleeve',cover:'#ffd66b',name:'앨범 노트',en:'ALBUM NOTES',tag:'신보 리뷰 · 앨범 입문',description:'정사각 아트워크를 자르지 않고 보여주고, 감상 포인트를 지면처럼 정돈합니다.',accent:'#aa432f',bg:'#ede9df',ink:'#272722',title:'첫 곡부터\n마지막 곡까지',body:'새 앨범을 듣기 전에, 소리와 흐름에서 발견할 것들.',flow:'앨범을 관통하는 관점 → 사운드 특징 → 구체적 트랙 → 앨범의 흐름 → 누구에게 권할지',sample:'새 앨범 듣는 법'},
  {id:'playlist',cover:'#c7f56c',name:'셀렉트 리스트',en:'THE SELECT',tag:'곡 추천 · 플레이리스트',description:'큰 순번과 개별 곡의 듣는 이유를 한 장씩 연결하는 저장용 큐레이션입니다.',accent:'#c7f56c',bg:'#28235c',ink:'#f8f4ed',title:'집에 가는 길,\n한 곡만 더',body:'하루를 천천히 닫고 싶은 밤. 비슷한 온도의 음악을 이어 듣는 순서.',flow:'누구의 어떤 상황인지 → 첫 추천과 이유 → 다음 곡과 연결 → 다른 결의 발견 → 선택/저장 이유',sample:'밤에 듣는 플레이리스트'},
  {id:'dossier',cover:'#ff8f6b',name:'씬 아카이브',en:'SCENE FILE',tag:'서브컬처 · 장르 · 음악 이야기',description:'비대칭 사진과 문서형 구획으로 장르, 공간, 사람의 맥락을 읽기 쉽게 풀어냅니다.',accent:'#bd432c',bg:'#eae9dc',ink:'#222921',title:'작은 공연장이\n만드는 큰 변화',body:'음악이 시작되는 공간, 그곳에 모이는 사람들. 씬을 읽는 새로운 입구.',flow:'독자가 궁금할 질문 → 용어/배경 설명 → 구체적 사례 → 지금의 의미 → 더 탐색할 단서',sample:'음악 씬과 공간'},
  {id:'live',name:'라이브 가이드',en:'LIVE / ON SITE',tag:'공연 · 페스티벌 · 현장',description:'공연 포스터처럼 힘 있는 제목, 사진 프레임과 티켓형 정보 구획을 사용합니다.',accent:'#f5a544',bg:'#172d2b',ink:'#f7f3e9',title:'처음 가는\n페스티벌이라면',body:'무대만큼 중요한 현장 준비. 출발 전에 챙겨볼 체크 포인트.',flow:'누구를 위한 공연/가이드 → 공식 일정과 장소(확인한 경우만) → 관람 포인트 → 준비/동선 → 저장할 체크리스트',sample:'페스티벌 관람 가이드'},
];
export function templateById(id){return templates.find(t=>t.id===id);}
export function normalizeTemplate(id){return id==='classic'||templateById(id)?id:'classic';}
export function templatePrompt(id){const t=templateById(id);return t?`\n선택한 편집 템플릿: ${t.name}. 용도: ${t.tag}. ${t.description}\n권장 이야기 흐름: ${t.flow}. 키워드의 실제 정보에 맞게 구성하세요. 주제와 무관한 곡 추천이나 특정 아티스트를 억지로 넣지 마세요. 표지는 제목만(3~8단어, 2줄 이내, body 빈 문자열). 속장 제목은 2줄 이내 10~20자, 본문은 40~70자로 핵심 하나만, 제목을 반복하지 마세요. 표지는 cover, 중간은 story와 type을 섞고 마지막은 end. 인용부호는 원문 확인된 실제 발언에만 사용하고, 가상 인터뷰나 평점·발매일·공연 일정을 만들지 마세요.`:'';}
export function demoContent(id){
  const t=templateById(id)||templates[0];
  const card=(label,title,body,layout)=>({label,title,body,layout,note:'PICK DESIGN STUDY · 내용은 예시입니다',image:'',imageCredit:'',imageSource:'',sourceIds:[]});
  return {keyword:t.sample,category:t.en,template:t.id,theme:'paper',caption:'디자인 미리보기용 예시 원고입니다.',sources:[],imageCandidates:[],cards:[
    card(t.en,t.title,t.body,'cover'),
    card('01 / THE CONTEXT','한 장에 담는\n하나의 발견','제목에서 던진 질문에 먼저 답합니다. 추상적인 수식어 대신, 독자가 직접 듣거나 확인할 수 있는 구체적인 단서를 적습니다.','story'),
    card('02 / LISTEN CLOSER','무엇을 들으면\n달라질까','사운드, 가사 밖의 맥락, 작업의 변화. 근거가 있는 설명과 에디터의 감상을 구분해 전달합니다.','type'),
    card('SAVE YOUR PICK','다음에 들을 때,\n다시 꺼내보세요','마음에 남은 발견 하나를 골라보세요. 추천한 순서와 확인할 정보를 저장해 다음 감상에 연결하세요.','end')
  ]};
}

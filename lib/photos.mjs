import { downloadImage } from './network.mjs';

// 카드 ↔ 사진 매칭. 곡 카드에는 그 곡의 사진만, 없으면 아티스트·현장 사진. 다른 곡 사진은 쓰지 않습니다.
export const norm=s=>String(s||'').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g,m=>' '+m.slice(1,-1)+' ').replace(/[\s'"‘’“”`·.,!?~\-_:;&/()[\]<>《》「」『』]/g,'');
// "나랑 아니면 / Not With Me"처럼 한·영 표기를 함께 받아 각각 비교
const variants=s=>String(s||'').split(/[/|()[\]]/).map(norm).filter(v=>v.length>=2);
// 카드 곡 ↔ 사진 곡: 거의 같은 이름만 일치("Love"와 "Love Is All"은 다른 곡). "곡명 / 앨범명" 표기는 조각별 비교.
export function sameSubject(a,b){const A=variants(a),B=variants(b);return A.some(x=>B.some(y=>{if(x===y)return true;const [s,l]=x.length<y.length?[x,y]:[y,x];return l.includes(s)&&s.length/l.length>=.7;}));}
// 유튜브 제목 ↔ 곡명: 제목 안에 곡명(어느 표기든)이 들어 있으면 일치
export function titleHas(title,subject){const t=norm(title);return variants(subject).some(v=>t.includes(v));}
const GENERIC=['artist','scene'];

// 유튜브 영상 ID가 정말 그 곡의 영상인지 제목으로 확인(키 없는 oEmbed)
async function youtubeTitle(id){
  const r=await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({url:`https://www.youtube.com/watch?v=${id}`,format:'json'})}`,{signal:AbortSignal.timeout(12000)});
  if(!r.ok)return null;return (await r.json()).title||null;
}
async function fetchCandidate(c,asset){
  if(c.youtubeId){
    const title=await youtubeTitle(c.youtubeId);
    if(!title)throw new Error('영상 없음');
    if(c.kind==='song'&&!titleHas(title,c.subject))throw new Error(`제목 불일치: ${title}`);
    c.verifiedTitle=title;
    // 대표 썸네일은 글자가 박힌 디자인 이미지가 많아 영상 25·50·75% 지점의 실제 장면 3장도 받습니다.
    const get=async name=>{try{const {bytes}=await downloadImage(`https://i.ytimg.com/vi/${c.youtubeId}/${name}.jpg`);return bytes.length>8000?asset(bytes):null;}catch{return null;}};
    const frames=[];for(const k of [2,1,3]){const f=await get(`maxres${k}`)||await get(`sd${k}`);if(f&&!frames.includes(f))frames.push(f);}
    let img=null;for(const size of ['maxresdefault','sddefault','hqdefault']){img=await get(size);if(img)break;}
    if(!img&&!frames.length)throw new Error('썸네일 없음');
    c.frames=frames;return {img:img||frames[0],frames};
  }
  return {img:asset((await downloadImage(c.url)).bytes),frames:[]};
}

export async function matchPhotos(content,asset,onProgress=()=>{}){
  const cands=content.imageCandidates;
  onProgress(`곡별 사진 확인 중… (후보 ${cands.length}장)`);
  const got=await Promise.all(cands.map(c=>fetchCandidate(c,asset).then(r=>({c,...r}),e=>({c,error:e.message}))));
  const ok=got.filter(x=>x.img),rejected=got.filter(x=>x.error&&/불일치/.test(x.error)).length;
  const used=new Map(),pick=list=>list.sort((a,b)=>(used.get(a.img)||0)-(used.get(b.img)||0))[0];
  const missing=[];
  content.cards.forEach((card,i)=>{
    const subject=card.subject||'';
    const chosen=got[card.imageIndex];
    let s=null;
    if(subject){
      // 1) AI가 고른 사진이 같은 곡이면 사용 2) 같은 곡의 다른 사진 3) 아티스트·현장 사진
      if(chosen?.img&&sameSubject(chosen.c.subject,subject))s=chosen;
      else s=pick(ok.filter(x=>sameSubject(x.c.subject,subject)))||pick(ok.filter(x=>GENERIC.includes(x.c.kind)));
    }else{
      // 특정 곡 카드가 아니면(표지·마무리) AI 선택 → 아티스트·현장 사진 → 가장 덜 쓴 사진(같은 주제 안의 사진이라 허용)
      s=chosen?.img?chosen:pick(ok.filter(x=>GENERIC.includes(x.c.kind)))||pick(ok);
    }
    if(!s){missing.push(i+1);return;}
    const n=used.get(s.img)||0;used.set(s.img,n+1);
    // MV 실제 장면이 있으면 그걸 우선(같은 곡을 여러 카드가 쓰면 다른 장면), 없으면 대표 썸네일
    card.image=s.frames?.length?s.frames[n%s.frames.length]:s.img;card.imageCredit=s.c.credit;card.imageSource=s.c.sourceUrl;
  });
  const warnings=[];
  if(!ok.length)warnings.push('관련 사진을 가져오지 못했습니다. 사진 탭에서 카드별 사진을 선택하세요.');
  else if(missing.length)warnings.push(`${missing.join(', ')}번 카드는 그 곡에 맞는 사진을 찾지 못해 비워뒀습니다. 사진 탭에서 넣어주세요.`);
  if(rejected)warnings.push(`곡과 맞지 않는 영상 썸네일 ${rejected}개를 걸러냈습니다.`);
  return warnings;
}

import { readShared, writeShared } from './shared.mjs';

// 에디터 기억: 에디터가 남긴 메모, AI 초안을 고친 전후 문장, 승인·게시한 최종 문장과 성과를
// 두 앱이 함께 쌓고, 다음 원고·대본 생성과 셀프 리뷰에 바로 넣습니다(메모 1개부터 즉시 반영).
// 이 파일은 두 앱에 똑같이 들어 있습니다(lib/editor-memory.mjs).
const FILE='editor-memory.json';
function lev(a,b){
  a=a.slice(0,300);b=b.slice(0,300);if(a===b)return 0;if(!a.length||!b.length)return Math.max(a.length,b.length);
  let prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur;}
  return prev[b.length];
}
export const changeRatio=(a='',b='')=>{const n=Math.max(a.length,b.length);return n?lev(a,b)/n:0;};
const clip=(s,n)=>String(s||'').replace(/\s*\n\s*/g,' / ').trim().slice(0,n);
const num=v=>Number.isFinite(Number(v))&&v!==null&&v!==''?Number(v):0;
// 성과 점수: 2026 인스타 도달 신호 순서(DM 공유 > 저장 > 댓글 > 좋아요)
export const performance=m=>m?num(m.shares)*4+num(m.saves)*3+num(m.comments)*2+num(m.likes):0;

// 원고 하나를 기억 한 줄로. pairs: [{where,before,after}] AI 초안↔최종, final: 승인·게시한 경우만
export function buildRecord({id,keyword,at,feedback,pairs=[],final=null}){
  const edits=pairs.filter(p=>p.before&&p.after&&changeRatio(p.before,p.after)>.15).slice(0,6).map(p=>({where:p.where,before:clip(p.before,110),after:clip(p.after,110)}));
  const removed=pairs.filter(p=>p.before&&!String(p.after||'').trim()).slice(0,3).map(p=>({where:p.where,before:clip(p.before,110)}));
  return {id,keyword:clip(keyword,60),at,rating:feedback?.rating??null,note:clip(feedback?.note,300),metrics:feedback?.metrics||null,edits,removed,
    final:final?{cover:clip(final.cover,60),lines:(final.lines||[]).filter(Boolean).slice(0,3).map(l=>clip(l,90))}:null};
}
// 앱별로 통째로 다시 씁니다(원고 목록에서 매번 다시 계산하므로 중복되지 않음)
export function syncMemory(app,records){
  const mem=readShared(FILE,{})||{};
  mem[app]=records.filter(r=>r.note||r.rating||r.edits.length||r.removed.length||r.final).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,40);
  return writeShared(FILE,mem);
}
const all=()=>{const mem=readShared(FILE,{})||{};return ['studio','reels'].flatMap(app=>(mem[app]||[]).map(r=>({...r,app}))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));};
const appName=a=>a==='studio'?'카드뉴스':'릴스';
export function memorySummary(){
  const list=all();
  return {records:list.length,notes:list.filter(r=>r.note).slice(0,8).map(r=>({app:appName(r.app),keyword:r.keyword,note:r.note,rating:r.rating})),
    edits:list.flatMap(r=>r.edits.map(e=>({app:appName(r.app),...e}))).slice(0,12),
    removed:list.flatMap(r=>r.removed.map(e=>({app:appName(r.app),...e}))).slice(0,6),
    best:list.filter(r=>r.final&&(performance(r.metrics)>0||r.rating>=4)).sort((a,b)=>performance(b.metrics)-performance(a.metrics)||(b.rating||0)-(a.rating||0)).slice(0,6).map(r=>({app:appName(r.app),cover:r.final.cover,lines:r.final.lines,metrics:r.metrics,rating:r.rating}))};
}
// 생성·리뷰 프롬프트에 넣을 요약
export function memoryForPrompt(){
  const m=memorySummary();if(!m.notes.length&&!m.edits.length&&!m.removed.length&&!m.best.length)return '';
  const met=x=>x?[['shares','공유'],['saves','저장'],['comments','댓글'],['likes','좋아요'],['views','조회']].filter(([k])=>num(x[k])>0).map(([k,l])=>`${l} ${x[k]}`).join(' · '):'';
  let out=`\n[에디터 기억 — PICK 에디터가 실제로 남긴 지적과 고친 문장입니다. 같은 지적을 다시 받지 않게 쓰세요. 사실 확인·출처·사진 권리 규칙보다 우선하지는 않습니다.]`;
  if(m.notes.length)out+=`\n에디터 메모(최신순):\n${m.notes.map(n=>`- “${n.note}” (${n.app} · ${n.keyword}${n.rating?` · 평점 ${n.rating}/5`:''})`).join('\n')}`;
  if(m.edits.length)out+=`\n에디터가 고친 문장(AI 초안 → 최종):\n${m.edits.map(e=>`- ${e.where}: “${e.before}” → “${e.after}”`).join('\n')}`;
  if(m.removed.length)out+=`\n에디터가 통째로 지운 문장:\n${m.removed.map(e=>`- ${e.where}: “${e.before}”`).join('\n')}`;
  if(m.best.length)out+=`\n반응이 좋았거나 에디터가 높게 평가한 최종본(이 말투에 가깝게):\n${m.best.map(b=>`- 표지 “${b.cover}”${b.lines.length?` / 본문 “${b.lines[0]}”`:''}${met(b.metrics)?` (${met(b.metrics)})`:''}`).join('\n')}`;
  return out;
}

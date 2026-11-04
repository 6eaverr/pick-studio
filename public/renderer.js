import {drawTemplate} from './template-renderer.js';
import {findFocus} from './focus.js';
const imageCache=new Map();
const FONT='"PICK Pretendard"';
let fontReady;
export function ensureFonts(){
  if(!fontReady)fontReady=(async()=>{
    const face=new FontFace('PICK Pretendard','url(/assets/PretendardVariable.woff2)',{weight:'45 920',style:'normal'});
    await face.load();document.fonts.add(face);
    await Promise.all([500,700,850].map(w=>document.fonts.load(`${w} 48px ${FONT}`,'검정치마 EVERYTHING')));
  })().catch(()=>{fontReady=null;throw new Error('카드 전용 글꼴을 불러오지 못했습니다. 새로고침해 주세요.');});
  return fontReady;
}
export async function loadImage(url){
  if(!url)return null;
  if(!imageCache.has(url))imageCache.set(url,new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{imageCache.delete(url);reject(new Error('사진을 불러오지 못했습니다. 사진 탭에서 교체하세요.'));};img.src=url;}));
  return imageCache.get(url);
}
function style(ctx,size,weight,tracking=0){ctx.font=`${weight} ${size}px ${FONT}`;ctx.letterSpacing=`${tracking}px`;ctx.textBaseline='top';}
function wrap(ctx,text,width){
  const result=[];
  for(const paragraph of text.split('\n')){
    if(!paragraph){result.push('');continue;}let line='';
    for(const word of paragraph.split(/\s+/)){
      const next=line?line+' '+word:word;
      if(ctx.measureText(next).width<=width){line=next;continue;}
      if(line){result.push(line);line='';}
      for(const char of word){if(line&&ctx.measureText(line+char).width>width){result.push(line);line='';}line+=char;}
    }result.push(line);
  }return result;
}
// 글자 크기를 영역에 맞춰 줄이며 줄을 나눕니다. marks: 제목의 [대괄호] 줄을 강조 줄로 표시(괄호는 그리지 않음)
// keepLines: 이 크기까지는 글자를 줄여서라도 에디터가 나눈 줄을 그대로 지킴(한 글자만 다음 줄로 떨어지는 것 방지)
function fitBlock(ctx,text,{width=940,height,size=92,min=38,lineHeight=1.12,weight=850,tracking=-2,marks=false,keepLines=0}){
  const paras=String(text).split('\n').map(p=>marks?{text:p.replace(/[[\]]/g,''),hl:/\[[^\]]+\]/.test(p)}:{text:p,hl:false});
  let lines=[];
  if(keepLines)for(let s=size;s>=keepLines;s-=2){style(ctx,s,weight,tracking);if(paras.every(p=>ctx.measureText(p.text).width<=width)&&paras.length*s*lineHeight<=height)return {lines:paras.map(p=>({t:p.text,hl:p.hl})),size:s,height:paras.length*s*lineHeight};}
  for(;size>=min;size-=2){style(ctx,size,weight,tracking);lines=paras.flatMap(p=>wrap(ctx,p.text,width).map(t=>({t,hl:p.hl})));if(lines.length*size*lineHeight<=height)break;}
  if(size<min)throw new Error('텍스트가 카드 영역보다 깁니다. 제목 또는 본문을 줄여주세요.');
  return {lines,size,height:lines.length*size*lineHeight};
}
function block(ctx,text,{x=70,y,lineHeight=1.12,weight=850,color='#fff',tracking=-2,accent,hl,...opts}){
  const f=fitBlock(ctx,text,{lineHeight,weight,tracking,...opts});
  style(ctx,f.size,weight,tracking);
  f.lines.forEach((line,i)=>{ctx.fillStyle=line.hl&&hl?hl:accent&&!f.lines.some(l=>l.hl)&&i===f.lines.length-1?accent:color;ctx.fillText(line.t,x,y+i*f.size*lineHeight);});
  ctx.letterSpacing='0px';return f.height;
}
function small(ctx,text,x,y,color,size=24,weight=600){style(ctx,size,weight,.1);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.letterSpacing='0px';}
// 인물 중심 크롭: 얼굴(초점)이 사진 칸 위 40% 지점에 오도록 자름. 초점을 모르면 가운데
const focusOf=new WeakMap();
function photo(ctx,img,x,y,w,h,cropAlbum=false){
  const sx=cropAlbum?img.width*.115:0,sy=cropAlbum?img.height*.1:0,sw=cropAlbum?img.width*.77:img.width,sh=cropAlbum?img.height*.77:img.height;
  const scale=Math.max(w/sw,h/sh),cw=w/scale,ch=h/scale,f=cropAlbum?null:focusOf.get(img);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const cx=f?clamp(f.x*img.width,sx+cw/2,sx+sw-cw/2):sx+sw/2,cy=f&&f.faces.length?clamp(f.y*img.height+ch*.1,sy+ch/2,sy+sh-ch/2):sy+sh/2;
  ctx.drawImage(img,cx-cw/2,cy-ch/2,cw,ch,x,y,w,h);
}
function gradient(ctx,stops){const g=ctx.createLinearGradient(0,0,0,1350);for(const [at,color] of stops)g.addColorStop(at,color);ctx.fillStyle=g;ctx.fillRect(0,0,1080,1350);}
function line(ctx,y,color){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(70,y);ctx.lineTo(1010,y);ctx.stroke();}
function header(ctx,logo,label,fg){
  ctx.save();ctx.beginPath();ctx.arc(96,88,27,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,69,61,54,54);ctx.restore();
  small(ctx,'pick magazine',138,68,fg,29,750);
  ctx.textAlign='right';small(ctx,label,1010,75,fg,21,600);ctx.textAlign='left';
}
function footer(ctx,c,index,total,fg){
  line(ctx,1243,fg+'40');
  block(ctx,(index===0?'':c.note)||'@_pick.kr',{x:70,y:1270,width:810,height:37,size:23,min:15,lineHeight:1.1,weight:500,tracking:0,color:fg});
  // 표지는 페이지 번호 대신 넘기기 신호
  ctx.textAlign='right';small(ctx,index===0?'SWIPE  →':`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,1010,1269,fg,index===0?25:23,index===0?800:600);ctx.textAlign='left';
}
// 표지 보조 문구는 아주 짧을 때만(24자 이하, 한 줄)
export const coverSubOk=t=>!!t&&!/\n/.test(t.trim())&&t.trim().length<=24;
export async function drawCard(canvas,content,index){
  await ensureFonts();
  const c=content.cards[index],ctx=canvas.getContext('2d');
  canvas.width=1080;canvas.height=1350;
  const palettes={paper:{bg:'#f4f3ef',fg:'#151515',accent:'#eb4a33'},midnight:{bg:'#151515',fg:'#ffffff',accent:'#dfff75'},cobalt:{bg:'#153ed4',fg:'#ffffff',accent:'#dfff75'}};
  const p=palettes[content.theme]||palettes.paper;
  const [img,logo]=await Promise.all([loadImage(c.image),loadImage('/assets/pick-logo.jpg')]);
  if(img&&!focusOf.has(img))focusOf.set(img,await findFocus(img,c.image).catch(()=>null));
  if(drawTemplate(ctx,content,index,img,logo,{block,fitBlock,small,photo}))return canvas;
  const cover=c.layout==='cover',story=c.layout==='story',end=c.layout==='end';
  // 사진이 있으면 모든 레이아웃에서 전면 배경으로 씁니다. 글자가 위쪽까지 차는 레이아웃은 더 어둡게 덮습니다.
  const fullPhoto=!!img,fg=fullPhoto?'#ffffff':p.fg;
  ctx.fillStyle=p.bg;ctx.fillRect(0,0,1080,1350);
  if(fullPhoto){
    photo(ctx,img,0,0,1080,1350,c.image==='/assets/team-baby.webp');
    if(cover||story)gradient(ctx,[[0,'rgba(0,0,0,.4)'],[.25,'rgba(0,0,0,0)'],[.47,'rgba(0,0,0,.12)'],[.74,'rgba(0,0,0,.75)'],[1,'rgba(0,0,0,.96)']]);
    else gradient(ctx,[[0,'rgba(0,0,0,.72)'],[.4,'rgba(0,0,0,.58)'],[1,'rgba(0,0,0,.9)']]);
  }
  header(ctx,logo,content.category,fg);
  if(cover){
    if(!img){small(ctx,'THE MUSIC YOU KEEP.',70,268,p.accent,25);small(ctx,'PICK',60,357,p.fg,185,900);}
    // 표지: 제목 한 줄로 승부(레퍼런스: 헤드라인만, 부제·설명 없음). 짧은 한 줄만 보조로 허용
    small(ctx,c.label,74,745,fullPhoto?'#ddff78':p.accent,30,800);
    const h=block(ctx,c.title,{y:800,height:380,size:124,min:52,lineHeight:1.02,tracking:-4,color:fg,marks:true,hl:fullPhoto?'#ddff78':p.accent,accent:fullPhoto?'#ddff78':p.accent});
    if(coverSubOk(c.body))block(ctx,c.body,{x:74,y:830+h,width:928,height:52,size:36,min:24,lineHeight:1.3,weight:600,tracking:-.6,color:fg});
  }else if(story){
    small(ctx,c.label,74,714,fullPhoto?'#dfff78':p.accent,27,650);
    const h=block(ctx,c.title,{y:777,height:244,size:88,min:42,lineHeight:1.08,tracking:-2.7,color:fg,marks:true,hl:fullPhoto?'#dfff78':p.accent});
    block(ctx,c.body,{x:74,y:806+h,width:922,height:1195-(806+h),size:36,min:24,lineHeight:1.42,weight:500,tracking:-.5,color:fg});
  }else if(end){
    small(ctx,c.label,74,253,p.accent,27,700);
    block(ctx,c.title,{y:335,height:315,size:93,min:44,lineHeight:1.09,tracking:-3,color:fg,marks:true,hl:p.accent});
    line(ctx,716,fg+'30');
    block(ctx,c.body,{x:74,y:792,width:914,height:378,size:41,min:27,lineHeight:1.47,weight:550,tracking:-.7,color:fg});
  }else{
    const number=c.label.match(/TRACK\s+(\d+)/i)?.[1]||String(index+1).padStart(2,'0');
    small(ctx,number,65,241,p.accent,100,800);
    small(ctx,c.label.replace(/TRACK\s+\d+\s*\/?\s*/i,''),74,382,fg,28,650);
    block(ctx,c.title,{y:453,height:304,size:93,min:42,lineHeight:1.1,tracking:-3,color:fg,marks:true,hl:p.accent});
    ctx.fillStyle=p.accent;ctx.fillRect(74,824,56,5);
    block(ctx,c.body,{x:74,y:887,width:914,height:293,size:40,min:27,lineHeight:1.5,weight:500,tracking:-.8,color:fg});
  }
  footer(ctx,c,index,content.cards.length,fg);
  return canvas;
}

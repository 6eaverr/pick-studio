import {drawCard,loadImage} from './renderer.js';

// Figma 전달용 레이어 추출. 렌더러를 고치지 않고 캔버스 그리기 호출을 가로채서
// 글자는 편집 가능한 텍스트 레이어, 카드 사진은 이미지 레이어, 나머지 그래픽은
// 그리기 순서를 지킨 투명 PNG 레이어로 나눕니다.
const W=1080,H=1350;
const DRAW=new Set(['fillRect','strokeRect','fill','stroke','drawImage','fillText','strokeText','clearRect','putImageData']);

function instrument(canvas,onDraw){
  const real=canvas.getContext('2d');
  const ctx=new Proxy(real,{
    get(t,prop){const v=t[prop];if(typeof v!=='function')return v;if(DRAW.has(prop))return (...args)=>onDraw(prop,args,()=>v.apply(t,args),t);return v.bind(t);},
    set(t,prop,value){t[prop]=value;return true;}
  });
  return {get width(){return canvas.width;},set width(v){canvas.width=v;},get height(){return canvas.height;},set height(v){canvas.height=v;},getContext:()=>ctx};
}
function blankCanvas(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
const probe=blankCanvas().getContext('2d');
function color(value){
  probe.fillStyle='#000';probe.fillStyle=value;const s=probe.fillStyle;
  if(s.startsWith('#'))return {r:parseInt(s.slice(1,3),16)/255,g:parseInt(s.slice(3,5),16)/255,b:parseInt(s.slice(5,7),16)/255,a:1};
  const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return {r:0,g:0,b:0,a:1};
  const [r,g,b,a=1]=m[1].split(',').map(Number);return {r:r/255,g:g/255,b:b/255,a};
}
function textOp(t,text,x,y){
  const m=t.getTransform(),font=t.font.match(/(\d+)\s+([\d.]+)px/)||[0,500,24];
  const baseline=t.textBaseline;t.textBaseline='alphabetic';const mm=t.measureText('가Hg');t.textBaseline=baseline;
  const size=Number(font[2]),ascent=mm.fontBoundingBoxAscent||size*.95,descent=mm.fontBoundingBoxDescent||size*.25;
  const emAscent=mm.emHeightAscent??size*ascent/(ascent+descent);
  return {text,x,y,size,weight:Number(font[1]),font:t.font,align:t.textAlign,letterSpacing:parseFloat(t.letterSpacing)||0,
    color:color(typeof t.fillStyle==='string'?t.fillStyle:'#000'),width:t.measureText(text).width,
    ascent,descent,emAscent,matrix:[m.a,m.b,m.c,m.d,m.e,m.f]};
}
const sameMatrix=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<.001);
function groupTexts(ops){
  const groups=[];
  for(const op of ops){
    const g=groups.at(-1),last=g?.lines.at(-1);
    const step=last?op.y-last.y:0;
    if(g&&g.end===op.order-1&&last.font===op.font&&last.x===op.x&&last.align===op.align&&last.letterSpacing===op.letterSpacing&&sameMatrix(last.matrix,op.matrix)&&step>0&&step<op.size*2.2&&(g.step===null||Math.abs(step-g.step)<.5)){g.lines.push(op);g.step=step;g.end=op.order;}
    else groups.push({lines:[op],step:null,end:op.order});
  }
  return groups;
}
const norm=s=>String(s||'').replace(/[\s[\]]+/g,'');
function nameFor(text,card){
  const t=norm(text);if(!t)return '텍스트';
  for(const [key,name] of [['title','제목'],['body','본문'],['label','라벨'],['note','하단 문구']])if(norm(card[key])===t)return name;
  return '텍스트';
}
function textLayer(group,card,index){
  const first=group.lines[0],size=first.size;
  const lineHeight=group.step??Math.round(size*1.2);
  // 캔버스는 textBaseline=top(글자 em 상단) 기준, Figma는 줄 상자 상단 기준이라 기준선으로 맞춥니다.
  const baseline=first.y+first.emAscent;
  const top=baseline-first.ascent-(lineHeight-(first.ascent+first.descent))/2;
  const [a,b,c,d,e,f]=first.matrix;
  const width=Math.max(...group.lines.map(l=>l.width));
  const left=first.align==='right'?first.x-width:first.align==='center'?first.x-width/2:first.x;
  const text=group.lines.map(l=>l.text).join('\n');
  return {type:'text',name:nameFor(text,card)||`텍스트 ${index}`,characters:text,
    lines:group.lines.map(l=>({length:l.text.length,color:l.color})),
    fontSize:size,weight:first.weight,letterSpacing:first.letterSpacing,lineHeight,align:first.align==='right'?'RIGHT':first.align==='center'?'CENTER':'LEFT',
    // 오른쪽 정렬은 오른쪽 끝(anchorX)을 기준으로 Figma에서 다시 맞춥니다.
    anchorX:first.align==='right'?a*first.x+c*top+e:null,
    transform:[[a,c,a*left+c*top+e],[b,d,b*left+d*top+f]],
    bounds:{x:a*left+c*top+e,y:b*left+d*top+f,w:width,h:lineHeight*group.lines.length,rotated:Math.abs(b)>.001}};
}
function bbox(canvas){
  const data=canvas.getContext('2d').getImageData(0,0,W,H).data;let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++){const row=y*W*4;for(let x=0;x<W;x++)if(data[row+x*4+3]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
  return x1<0?null:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
const hits=(r,t)=>t.rotated||!(r.x+r.w<=t.x||t.x+t.w<=r.x||r.y+r.h<=t.y||t.y+t.h<=r.y);
async function cardLayers(content,index){
  const card=content.cards[index],photoImg=card.image?await loadImage(card.image).catch(()=>null):null;
  // 1) 기록: 실제로 그리지 않고 그리기 순서와 글자 정보만 수집
  const ops=[];let order=0;
  await drawCard(instrument(blankCanvas(),(prop,args,run,t)=>{
    const i=order++;
    if(prop==='fillText')ops.push({kind:'text',order:i,...textOp(t,String(args[0]),args[1],args[2])});
    else if(prop==='drawImage'&&photoImg&&args[0]===photoImg)ops.push({kind:'photo',order:i});
    else ops.push({kind:'shape',order:i});
  }),content,index);
  // 2) 그리기 순서대로 레이어 묶기: 연속된 그래픽 → 한 레이어, 사진 → 각각, 글자 → 줄 묶음
  const plan=[];
  for(const op of ops){
    const last=plan.at(-1);
    if(op.kind==='text'){if(last?.kind==='texts')last.ops.push(op);else plan.push({kind:'texts',ops:[op]});}
    else if(op.kind==='shape'&&last?.kind==='shape')last.orders.add(op.order);
    else plan.push({kind:op.kind,orders:new Set([op.order])});
  }
  // 3) 그래픽/사진 레이어를 각각 따로 그려 투명 PNG로 만들기
  for(const step of plan){
    if(step.kind==='texts'){step.layers=groupTexts(step.ops).filter(g=>g.lines.some(l=>l.text.trim())).map((g,i)=>textLayer(g,card,i+1));continue;}
    const canvas=blankCanvas();let n=0;
    await drawCard(instrument(canvas,(prop,args,run)=>{const i=n++;if(prop!=='fillText'&&step.orders.has(i))run();}),content,index);
    step.canvas=canvas;step.box=bbox(canvas);
  }
  // 4) 사이에 낀 글자와 겹치지 않는 그래픽 레이어는 아래 그래픽 레이어에 합쳐 레이어 수를 줄입니다.
  const merged=[];
  for(const step of plan){
    if(step.kind==='shape'&&step.box){
      let j=merged.length-1;const between=[];
      while(j>=0&&merged[j].kind==='texts'){between.push(...merged[j].layers);j--;}
      const base=merged[j];
      if(base?.kind==='shape'&&base.box&&!between.some(t=>hits(step.box,t.bounds))){
        base.canvas.getContext('2d').drawImage(step.canvas,0,0);
        const b=base.box,s=step.box,x=Math.min(b.x,s.x),y=Math.min(b.y,s.y);
        base.box={x,y,w:Math.max(b.x+b.w,s.x+s.w)-x,h:Math.max(b.y+b.h,s.y+s.h)-y};continue;
      }
    }
    merged.push(step);
  }
  const layers=[];let graphics=0;
  for(const step of merged){
    if(step.kind==='texts'){layers.push(...step.layers.map(({bounds,...l})=>l));continue;}
    if(!step.box)continue;
    const {x,y,w,h}=step.box,crop=document.createElement('canvas');crop.width=w;crop.height=h;
    crop.getContext('2d').drawImage(step.canvas,x,y,w,h,0,0,w,h);
    const isPhoto=step.kind==='photo',full=w===W&&h===H&&!layers.length;
    const url=isPhoto?crop.toDataURL('image/jpeg',.92):crop.toDataURL('image/png');
    layers.push({type:'image',name:isPhoto?(w===W&&h===H?'배경 사진':'사진'):full?'배경':`그래픽 ${++graphics}`,x,y,w,h,data:url.split(',')[1]});
  }
  return {name:`${String(index+1).padStart(2,'0')} · ${card.layout}`,layers};
}
export async function figmaPackage(content,onProgress=()=>{}){
  const cards=[];
  for(let i=0;i<content.cards.length;i++){onProgress(i+1,content.cards.length);cards.push(await cardLayers(content,i));}
  return {format:'pick-figma/1',keyword:content.keyword,template:content.template,theme:content.theme,width:W,height:H,exportedAt:new Date().toISOString(),cards};
}

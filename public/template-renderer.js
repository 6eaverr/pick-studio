import {templateById} from './templates.js';

function rgb(hex){const h=hex.replace('#','');const f=h.length===3?h.split('').map(c=>c+c).join(''):h.slice(0,6);return [0,2,4].map(i=>parseInt(f.slice(i,i+2),16));}
function luminance(hex){const [r,g,b]=rgb(hex);return (0.2126*r+0.7152*g+0.0722*b)/255;}
// 어두운 사진 위에서 읽히도록 어두운 강조색만 밝힙니다.
function lift(hex){if(luminance(hex)>=.45)return hex;return '#'+rgb(hex).map(v=>Math.round(v+(255-v)*.45).toString(16).padStart(2,'0')).join('');}

// 1080×1350 editorial systems. All copy comes from the current card, never a topic preset.
export function drawTemplate(ctx,content,index,img,logo,helpers){
  const t=templateById(content.template);if(!t)return false;
  const {block,fitBlock,small,photo}=helpers,c=content.cards[index];
  const cover=c.layout==='cover',end=c.layout==='end',type=c.layout==='type';
  // 큰 번호는 라벨의 트랙 번호(TRACK 01 → 01)를 따르고, 없으면 카드 순서
  // 곡 번호가 붙는 캐러셀에서 곡이 아닌 속장(약속·소개)은 곡 번호와 헷갈리지 않게 화살표
  const track=c.label?.match(/TRACK\s*0*(\d+)/i)?.[1],hasTracks=content.cards.some(k=>/TRACK\s*\d+/i.test(k.label||''));
  const num=track||!hasTracks?String(track||index).padStart(2,'0'):'→';
  const p={...t};
  if(content.theme==='midnight'){p.bg='#181a18';p.ink='#f6f3eb';p.accent='#c7f56c';}
  if(content.theme==='cobalt'){p.bg='#213fbd';p.ink='#ffffff';p.accent='#cfff80';}
  const rect=(x,y,w,h,col)=>{ctx.fillStyle=col;ctx.fillRect(x,y,w,h);};
  const rule=(x,y,w,col=p.ink)=>rect(x,y,w,1,col);
  const text=(s,x,y,w,h,size=72,col=p.ink,weight=850)=>block(ctx,s||'',{x,y,width:w,height:h,size,min:20,lineHeight:1.13,weight,color:col,tracking:size>=65?-2.6:-.35});
  // 카드 제목: [대괄호]로 감싼 줄은 강조색
  const title=(x,y,w,h,size=72,col=p.ink)=>block(ctx,c.title||'',{x,y,width:w,height:h,size,min:20,lineHeight:1.13,weight:850,color:col,tracking:size>=65?-2.6:-.35,marks:true,hl:p.accent});
  const body=(y,h=230,x=66,w=948,col=p.ink)=>block(ctx,c.body||'',{x,y,width:w,height:h,size:37,min:16,lineHeight:1.43,weight:500,color:col,tracking:-.3});
  const label=(y=176,col=p.accent)=>text(c.label,66,y,940,46,25,col,700);
  const chip=(s,x,y,w,col=p.accent,ink=p.bg)=>{rect(x,y,w,64,col);block(ctx,s||'',{x:x+13,y:y+10,width:w-26,height:49,size:24,min:16,lineHeight:1.13,weight:750,color:ink,tracking:0});};
  const brand=(col=p.ink)=>{
    text('pick.',62,46,255,96,88,col,900);
    text(t.en,570,69,360,44,24,col,700);
    if(logo){ctx.save();ctx.beginPath();ctx.arc(986,86,28,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,958,58,56,56);ctx.restore();}
    rule(66,152,948,col);
  };
  const art=(x,y,w,h,contain=false)=>{
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(img){if(contain){const s=Math.min(w/img.width,h/img.height);rect(x,y,w,h,p.bg);ctx.drawImage(img,x+(w-img.width*s)/2,y+(h-img.height*s)/2,img.width*s,img.height*s);}else photo(ctx,img,x,y,w,h,false);}
    else{
      // Original abstract sample artwork also serves as a finished image-free layout.
      const g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,p.accent);g.addColorStop(.65,p.bg);g.addColorStop(1,'#0e212b');rect(x,y,w,h,g);
      ctx.globalAlpha=.45;ctx.strokeStyle=p.ink;ctx.lineWidth=Math.max(1,w/350);
      for(let i=0;i<17;i++){ctx.beginPath();ctx.ellipse(x+w*.7,y+h*.45,w*(.12+i*.033),h*(.11+i*.029),-.65,0,Math.PI*2);ctx.stroke();}
      ctx.globalAlpha=1;
    }
    ctx.restore();
  };
  // 표지 보조 문구는 24자 이하 한 줄일 때만(레퍼런스: 표지는 헤드라인만)
  const subOk=!!c.body&&!/\n/.test(c.body.trim())&&c.body.trim().length<=24;
  const cbody=(y,h,x=66,w=948,col=p.ink)=>{if(subOk)block(ctx,c.body,{x,y,width:w,height:h,size:38,min:22,lineHeight:1.3,weight:600,color:col,tracking:-.3});};
  const foot=(col=p.ink)=>{
    rule(66,1248,948,col);block(ctx,(index===0?'':c.note)||'@_pick.kr',{x:66,y:1271,width:795,height:38,size:22,min:12,lineHeight:1.1,weight:500,color:col,tracking:0});
    // 표지는 페이지 번호 대신 넘기기 신호
    if(index===0)text('SWIPE  →',854,1269,160,40,25,col,850);else text(`${String(index+1).padStart(2,'0')} / ${String(content.cards.length).padStart(2,'0')}`,914,1271,100,38,22,col,650);
  };
  // 표지에 사진이 있으면 템플릿과 상관없이 썸네일에서 이기는 구조 하나로 그립니다:
  // 선명한 전면 사진(얼굴 중심) + 아래 큰 제목 + 작은 키커. 장식 문구·설명문·하단 문구 없음.
  // 템플릿별 차이는 강조색과 마감(글자 얹기 / 색 띠)만 둡니다.
  if(cover&&img){
    // 색 테마(블랙&라임·코발트)를 고르면 그 강조색, 아니면 템플릿의 표지 강조색
    const band=['bulletin','live'].includes(t.id),acc=band?p.accent:content.theme==='paper'||!content.theme?(t.cover||lift(p.accent)):p.accent,ink=band?'#141414':'#ffffff';
    const opts={width:956,height:band?400:470,size:band?120:136,min:60,lineHeight:1.07,weight:880,tracking:-4,marks:true,keepLines:84};
    const f=fitBlock(ctx,c.title||'',opts),top=1196-f.height,bandTop=top-118,dark='#0d0d0d';
    rect(0,0,1080,1350,dark);
    if(band){photo(ctx,img,0,0,1080,bandTop,false);rect(0,bandTop,1080,1350-bandTop,acc);}
    else{
      // 사진은 제목 위쪽 칸에 맞춰 자르고(얼굴이 제목에 가리지 않게) 아래로 갈수록 어둡게 녹입니다
      const ph=Math.min(1350,Math.max(900,top+250));
      photo(ctx,img,0,0,1080,ph,false);
      const g=ctx.createLinearGradient(0,top-340,0,ph);g.addColorStop(0,'rgba(13,13,13,0)');g.addColorStop(.55,'rgba(13,13,13,.68)');g.addColorStop(1,dark);ctx.fillStyle=g;ctx.fillRect(0,top-340,1080,ph-(top-340));
    }
    {const g=ctx.createLinearGradient(0,0,0,240);g.addColorStop(0,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,1080,240);}
    block(ctx,'pick.',{x:62,y:48,width:300,height:90,size:74,min:74,lineHeight:1.1,weight:900,color:'#fff',tracking:-3});
    if(logo){ctx.save();ctx.beginPath();ctx.arc(986,86,28,0,Math.PI*2);ctx.clip();ctx.drawImage(logo,958,58,56,56);ctx.restore();}
    // 키커: 글자 길이에 맞춘 작은 칩(색 띠 위에서는 글자만)
    if(c.label){
      ctx.font='800 27px "PICK Pretendard"';ctx.letterSpacing='1.5px';const w=Math.min(700,ctx.measureText(c.label).width+36);ctx.letterSpacing='0px';
      if(!band)rect(64,top-84,w,54,acc);
      block(ctx,c.label,{x:band?66:82,y:top-71,width:700,height:36,size:27,min:16,lineHeight:1.1,weight:800,color:band?ink:'#121412',tracking:1.5});
    }
    block(ctx,c.title||'',{...opts,x:62,y:top,color:ink,hl:band?'#ffffff':acc});
    block(ctx,'@_pick.kr',{x:66,y:1271,width:500,height:38,size:23,min:23,lineHeight:1.1,weight:600,color:ink,tracking:0});
    block(ctx,'SWIPE  →',{x:852,y:1269,width:170,height:40,size:25,min:25,lineHeight:1.1,weight:850,color:ink,tracking:0});
    return true;
  }
  // 모든 페이지 전면 배경 사진. 사진 액자가 있는 페이지는 흐린 배경 + 선명한 액자,
  // 글자만 있는 페이지는 선명한 사진 + 템플릿 색 스크림. 에디토리얼 표지는 자체 전면 사진을 씁니다.
  const framed=!(end||(type&&['editorial','bulletin','playlist','live'].includes(t.id))||(t.id==='playlist'&&cover));
  const photoMode=!img?null:t.id==='editorial'&&cover?'own':framed?'blur':'sharp';
  const tone=luminance(p.bg)<.35?p.bg:'#141414';
  if(photoMode){p.bg=tone;if(luminance(p.ink)<.6)p.ink='#ffffff';p.accent=lift(p.accent);}
  rect(0,0,1080,1350,p.bg);
  if(photoMode&&photoMode!=='own'){
    const pad=photoMode==='blur'?80:0;
    ctx.save();if(photoMode==='blur')ctx.filter='blur(28px) saturate(1.15)';photo(ctx,img,-pad,-pad,1080+pad*2,1350+pad*2,false);ctx.restore();
    ctx.globalAlpha=photoMode==='blur'?.5:.4;rect(0,0,1080,1350,tone);ctx.globalAlpha=1;
    const g=ctx.createLinearGradient(0,0,0,1350);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.2,'rgba(0,0,0,.1)');g.addColorStop(.55,'rgba(0,0,0,.3)');g.addColorStop(1,'rgba(0,0,0,.88)');rect(0,0,1080,1350,g);
  }

  if(t.id==='editorial'){
    if(cover){
      art(0,0,1080,1350);
      const g=ctx.createLinearGradient(0,0,0,1350);g.addColorStop(0,'#0009');g.addColorStop(.28,'#0000');g.addColorStop(.52,'#0004');g.addColorStop(1,'#000f');rect(0,0,1080,1350,g);
      brand('#fff');chip(c.label,66,697,440,p.accent,'#121412');
      title(62,760,952,330,122,'#fff');cbody(1110,70,66,920,'#fff');foot('#fff');
    }else if(end||type){
      brand();label(224);text(end?'NEXT\nON REPEAT':num,60,311,950,195,end?86:166,p.accent,850);
      title(62,566,952,251,83);rule(66,869,948);body(918,284);foot();
    }else{brand();art(66,193,948,474);chip(c.label,66,683,520);title(62,764,952,190,81);body(1003,209);foot();}
  }
  if(t.id==='bulletin'){
    brand();chip(c.label,66,181,590,p.ink,p.bg);
    if(cover){title(62,255,950,340,120);art(66,620,948,347);if(subOk){rect(66,1000,8,70,p.accent);cbody(1005,80,98,916);}}
    else if(end){rect(66,264,948,468,p.accent);title(94,308,878,370,91,'#111');body(812,369);}
    else{small(ctx,num,59,267,p.accent,154,850);title(282,289,732,251,83);rule(66,602,948);body(650,338);if(!type)art(66,1030,948,179);else{rect(66,1061,948,121,p.accent);text('PICK / THE CONTEXT',90,1098,900,60,36,'#111',750);}}
    foot();
  }
  if(t.id==='sleeve'){
    brand();label(183);
    if(cover){
      title(62,255,948,196,86);rect(258,479,594,594,p.ink);art(243,464,594,594,true);
      ctx.save();ctx.translate(113,1080);ctx.rotate(-Math.PI/2);text('LISTEN / LOOK / REPEAT',0,0,580,35,24,p.accent,650);ctx.restore();
      cbody(1090,70);
    }else if(end){text('SIDE B',62,286,950,167,150,p.accent);rule(66,489,948);title(62,554,950,236,84);body(874,324);}
    else{art(66,275,306,306,true);title(417,283,595,305,74);rule(66,634,948);text('LISTENING NOTES',66,674,920,49,27,p.accent,750);body(757,441);}
    foot();
  }
  if(t.id==='playlist'){
    brand();label(184,p.ink);
    if(cover){text('SELECT',58,279,970,185,171,p.accent,900);title(65,527,952,320,112);rule(66,875,948,p.accent);cbody(925,80);chip('SAVE FOR LATER',66,1164,287,p.accent,p.bg);}
    else if(end){text('ON\nREPEAT.',56,257,954,400,178,p.accent);title(62,731,950,215,78);body(1010,207);}
    else{rect(66,282,263,285,p.accent);text(num,79,319,243,198,159,p.bg);if(img&&!type)art(698,282,316,285);else{for(let n=0;n<7;n++)rect(409+n*82,323+(n%3)*28,35,169-(n%3)*33,p.accent);}title(62,650,948,234,93);body(974,234);}
    foot();
  }
  if(t.id==='dossier'){
    brand();label(191);
    if(cover){
      title(62,323,459,534,86);art(564,277,450,692);rect(539,277,4,692,p.accent);
      rule(66,1019,948);cbody(1060,80);
    }else if(end){text('KEEP\nEXPLORING',61,297,952,316,130,p.accent);rule(66,664,948);title(63,713,950,203,78);body(989,220);}
    else{art(66,276,363,454);title(477,280,537,316,79);text('FIELD NOTES',477,658,537,60,30,p.accent,750);rule(66,785,948);body(834,373);}
    foot();
  }
  if(t.id==='live'){
    brand();label(184,p.accent);
    if(cover){
      title(62,263,950,273,109);art(66,586,948,384);
      rect(66,1001,948,216,p.accent);if(subOk)cbody(1026,164,91,898,'#132824');else text(c.label||'LIVE GUIDE',91,1070,898,100,64,'#132824',850);
    }else if(end){text('SEE YOU\nUP FRONT.',60,285,960,323,142,p.accent);title(63,699,950,205,79);body(983,228);}
    else{text(num,61,287,261,177,155,p.accent);title(343,298,671,266,81);ctx.setLineDash([10,10]);ctx.strokeStyle=p.accent;ctx.beginPath();ctx.moveTo(66,626);ctx.lineTo(1014,626);ctx.stroke();ctx.setLineDash([]);body(685,294);if(!type)art(66,1020,948,186);}
    foot();
  }
  return true;
}

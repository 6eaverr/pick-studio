import {templates,demoContent} from './templates.js';
import {drawCard} from './renderer.js';
const grid=document.querySelector('#libraryGrid'),status=document.querySelector('#galleryStatus'),mode=document.querySelector('#galleryMode');
let run=0;
async function render(){
  const version=++run;grid.replaceChildren();let passed=0;const errors=[];
  for(const t of templates){
    const content=demoContent(t.id);
    if(mode.value==='stress')for(const c of content.cards){c.title='새로운 음악에서 발견하는 이야기와 장면들 '.repeat(4).slice(0,64);c.body='음악을 듣는 방식과 새로운 발견을 함께 나누는 이야기입니다. '.repeat(9).slice(0,260);c.label='음악과 사람의 이야기를 전하는 매거진 '.repeat(3).slice(0,40);c.note='사진과 원문 출처를 확인하는 긴 하단 문구 '.repeat(5).slice(0,100);}
    for(let i=0;i<(mode.value==='cover'?1:4);i++){
      if(version!==run)return;
      const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');
      figure.className='library-card';canvas.setAttribute('aria-label',`${t.name} ${i+1}장`);caption.textContent=`${t.name} / ${['표지','본문','강조','마무리'][i]} · ${t.tag}`;figure.append(canvas,caption);grid.append(figure);
      try{await drawCard(canvas,content,i);passed++;}catch(e){errors.push(`${t.name} ${i+1}장: ${e.message}`);caption.textContent=errors.at(-1);figure.classList.add('render-error');}
    }
  }
  status.textContent=errors.length?`${passed}장 표시 · ${errors.join(' / ')}`:`${passed}장 표시 완료 · 1080 × 1350`;
}
mode.onchange=render;render();

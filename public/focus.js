// 인물 중심 크롭용 초점 찾기. MediaPipe 얼굴 인식(오프라인, public/vendor/mediapipe)을 쓰고,
// 얼굴이 작아 못 찾으면 사진을 4칸으로 나눠 확대해서 다시 찾습니다. 그래도 없으면 화면 중앙 약간 위.
let detectorP=null;
function detector(){
  if(!detectorP)detectorP=(async()=>{
    const {FilesetResolver,FaceDetector}=await import('/vendor/mediapipe/vision_bundle.mjs');
    const files=await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
    return FaceDetector.createFromOptions(files,{baseOptions:{modelAssetPath:'/vendor/mediapipe/blaze_face_short_range.tflite',delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.45});
  })().catch(e=>{console.warn('얼굴 인식 불가:',e);return null;});
  return detectorP;
}
const cache=new Map(),work=document.createElement('canvas'),wctx=work.getContext('2d',{willReadFrequently:true});
function detectIn(det,m,sx,sy,sw,sh,max=640){
  const k=Math.min(1,max/Math.max(sw,sh));work.width=Math.round(sw*k);work.height=Math.round(sh*k);
  wctx.drawImage(m,sx,sy,sw,sh,0,0,work.width,work.height);
  return (det.detect(work).detections||[]).map(d=>{const b=d.boundingBox;return {x:(sx+b.originX/k),y:(sy+b.originY/k),w:b.width/k,h:b.height/k,score:d.categories?.[0]?.score||0};});
}
export async function findFocus(m,key){
  if(key&&cache.has(key))return cache.get(key);
  const vw=m.videoWidth||m.naturalWidth,vh=m.videoHeight||m.naturalHeight;
  let faces=[];
  const det=await detector();
  if(det&&vw&&vh){
    try{
      faces=detectIn(det,m,0,0,vw,vh);
      if(!faces.length){// 작은 얼굴: 겹치는 4칸을 확대해서 재탐색
        const tw=vw*.6,th=vh*.6;
        for(const [sx,sy] of [[0,0],[vw-tw,0],[0,vh-th],[vw-tw,vh-th]])faces.push(...detectIn(det,m,sx,sy,tw,th));
      }
    }catch(e){console.warn(e);}
  }
  // 겹치는 얼굴 정리, 큰 순서
  faces=faces.sort((a,b)=>b.w*b.h-a.w*a.h).filter((f,i,arr)=>!arr.slice(0,i).some(g=>Math.abs(g.x+g.w/2-(f.x+f.w/2))<g.w*.6&&Math.abs(g.y+g.h/2-(f.y+f.h/2))<g.h*.6)).slice(0,4);
  const norm=f=>({cx:(f.x+f.w/2)/vw,cy:(f.y+f.h/2)/vh,h:f.h/vh});
  let focus;
  if(faces.length){
    const n=faces.map(norm),x0=Math.min(...faces.map(f=>f.x)),x1=Math.max(...faces.map(f=>f.x+f.w)),y0=Math.min(...faces.map(f=>f.y)),y1=Math.max(...faces.map(f=>f.y+f.h));
    focus={x:(x0+x1)/2/vw,y:(y0+y1)/2/vh,faces:n};
  }else focus={x:.5,y:.42,faces:[]};
  if(key)cache.set(key,focus);
  return focus;
}

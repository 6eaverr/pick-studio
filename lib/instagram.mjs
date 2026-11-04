import { finalCaption } from './content.mjs';
import { createHash } from 'node:crypto';
import { assertApproved } from './content.mjs';
import { downloadImage } from './network.mjs';

export function instagramConfig(){return{token:process.env.PICK_INSTAGRAM_TOKEN||'',userId:process.env.PICK_INSTAGRAM_USER_ID||'',version:process.env.PICK_GRAPH_VERSION||'v23.0',host:process.env.PICK_INSTAGRAM_LOGIN==='facebook'?'graph.facebook.com':'graph.instagram.com'};}
export async function graph(config,endpoint,data,method='POST',request=fetch){
  if(!/^v\d+\.\d+$/.test(config.version)||!/^\d+(?:\/(?:media|media_publish))?$/.test(endpoint))throw new Error('Instagram API 설정을 확인하세요.');
  const u=new URL(`https://${config.host}/${config.version}/${endpoint}`);
  if(method==='GET')u.search=new URLSearchParams(data).toString();
  const res=await request(u,{method,headers:{Authorization:`Bearer ${config.token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='POST'?{body:new URLSearchParams(data)}:{}),signal:AbortSignal.timeout(30000)});
  const json=await res.json();if(!res.ok||json.error)throw new Error(`Instagram 연결 오류 (${json.error?.code||res.status}). 계정 권한과 토큰을 확인하세요.`);return json;
}
export async function publishCarousel(project,urls,config,save,deps={}){
  assertApproved(project);
  if(project.status!=='approved')throw new Error('게시 진행·완료 또는 결과 확인이 필요한 콘텐츠입니다. 중복 게시할 수 없습니다.');
  if(!config.token||!/^\d+$/.test(config.userId))throw new Error('Instagram 프로 계정 연결이 필요합니다. 연결 설정을 확인하세요.');
  if(!project.export || project.export.hash!==project.approval.hash)throw new Error('승인된 게시 패키지를 먼저 저장하세요.');
  if(!Array.isArray(urls)||urls.length!==project.content.cards.length)throw new Error('카드 순서대로 각 JPEG 파일의 공개 HTTPS URL을 입력하세요.');
  const getImage=deps.downloadImage||downloadImage,call=deps.graph||graph,wait=deps.wait||(ms=>new Promise(r=>setTimeout(r,ms)));
  const account=await call(config,config.userId,{fields:'username'},'GET');
  if(account.username!=='_pick.kr')throw new Error('연결된 Instagram 계정이 @_pick.kr과 다릅니다. 계정 ID와 토큰을 확인하세요.');
  for(let i=0;i<urls.length;i++){const {bytes}=await getImage(urls[i]);if(createHash('sha256').update(bytes).digest('hex')!==project.export.images[i].sha256)throw new Error(`${i+1}번 공개 이미지가 승인된 JPEG와 다릅니다. 압축·변환 없이 업로드하세요.`);}
  project.status='publishing';project.publish={stage:'containers',startedAt:new Date().toISOString()};save(project);
  try{
    const children=[];
    for(const url of urls){const c=await call(config,`${config.userId}/media`,{image_url:url,is_carousel_item:'true'});children.push(c.id);}
    const parent=await call(config,`${config.userId}/media`,{media_type:'CAROUSEL',children:children.join(','),caption:finalCaption(project.content)});project.publish.containerId=parent.id;save(project);
    let ready=false;for(let i=0;i<20;i++){const s=await call(config,parent.id,{fields:'status_code'},'GET');if(s.status_code==='FINISHED'){ready=true;break;}if(['ERROR','EXPIRED'].includes(s.status_code))throw new Error('Instagram 이미지 처리가 실패했습니다.');await wait(3000);}
    if(!ready)throw new Error('Instagram 이미지 처리가 지연되고 있습니다. 잠시 후 다시 시도하세요.');
    project.publish.stage='publish-request';save(project);
    const result=await call(config,`${config.userId}/media_publish`,{creation_id:parent.id});
    project.status='published';project.publish={...project.publish,stage:'complete',mediaId:result.id,at:new Date().toISOString()};save(project);return project;
  }catch(e){project.status=project.publish.stage==='publish-request'?'uncertain':'approved';project.publish.error=e.message;save(project);throw new Error(project.status==='uncertain'?'게시 요청 후 응답을 확인하지 못했습니다. 중복 게시 방지를 위해 재시도를 막았습니다. Instagram에서 실제 게시 여부를 확인하세요.':e.message);}
}

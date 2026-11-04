import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export function publicIP(ip){
  if(isIP(ip)===4){const a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||(a[0]===169&&a[1]===254)||(a[0]===172&&a[1]>=16&&a[1]<=31)||(a[0]===192&&[0,168].includes(a[1]))||(a[0]===100&&a[1]>=64&&a[1]<=127)||(a[0]===198&&[18,19,51].includes(a[1]))||(a[0]===203&&a[1]===0));}
  // IPv6 remote fetches intentionally excluded; DNS A records are used.
  return false;
}
export async function downloadImage(address,hops=0){
  const u=new URL(address);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||hops>3)throw new Error('공개 HTTPS 이미지 주소만 사용할 수 있습니다.');
  const addresses=await lookup(u.hostname,{all:true,family:4});
  if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw new Error('로컬·내부 네트워크 주소는 사용할 수 없습니다.');
  return new Promise((resolve,reject)=>{
    const req=https.get(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 PICK-Studio/1.0','Accept':'image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.5'},lookup:(_h,opts,cb)=>opts.all?cb(null,[addresses[0]]):cb(null,addresses[0].address,4)},res=>{
      if([301,302,303,307,308].includes(res.statusCode)){res.resume();downloadImage(new URL(res.headers.location,u).href,hops+1).then(resolve,reject);return;}
      if(res.statusCode!==200){res.resume();reject(new Error(`이미지를 가져오지 못했습니다 (${res.statusCode}).`));return;}
      let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024)req.destroy(new Error('이미지는 8MB 이하여야 합니다.'));else chunks.push(chunk);});res.on('error',reject);res.on('end',()=>{const bytes=Buffer.concat(chunks);try{resolve({bytes,...imageType(bytes)});}catch(e){reject(e);}});
    });req.setTimeout(25000,()=>req.destroy(new Error('이미지 서버 응답 시간이 초과되었습니다.')));req.on('error',reject);
  });
}
export function imageType(b){if(b[0]===255&&b[1]===216&&b[2]===255)return{extension:'jpg',mime:'image/jpeg'};if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{extension:'png',mime:'image/png'};if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return{extension:'webp',mime:'image/webp'};throw new Error('JPG, PNG, WEBP 이미지 파일만 지원합니다.');}

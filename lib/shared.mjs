import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';

// 두 앱(PICK Studio·PICK Reels)이 함께 쓰는 폴더: %LOCALAPPDATA%\PICK
// 트렌드 브리핑, 레퍼런스 노트, 에디터 기억이 여기 저장됩니다. 테스트는 PICK_SHARED_DIR로 바꿉니다.
// 이 파일은 두 앱에 똑같이 들어 있습니다(lib/shared.mjs).
export const SHARED_DIR=process.env.PICK_SHARED_DIR||path.join(process.env.LOCALAPPDATA||process.env.USERPROFILE||'.','PICK');
export function readShared(name,fallback=null){
  try{const f=path.join(SHARED_DIR,name);return existsSync(f)?JSON.parse(readFileSync(f,'utf8')):fallback;}catch{return fallback;}
}
// 두 앱이 동시에 켜져 있어도 자동 조사를 한 번만 하도록 하는 간단한 잠금(ttl이 지나면 자동 해제)
export function tryLock(name,ttlMs=20*60*1000){
  const lock=readShared(name+'.lock');if(lock&&Date.now()-lock.at<ttlMs&&lock.pid!==process.pid)return false;
  writeShared(name+'.lock',{at:Date.now(),pid:process.pid});return true;
}
export function unlock(name){try{writeShared(name+'.lock',{at:0,pid:0});}catch{}}
export function writeShared(name,value){
  mkdirSync(SHARED_DIR,{recursive:true});const f=path.join(SHARED_DIR,name),tmp=f+'.tmp';
  writeFileSync(tmp,JSON.stringify(value,null,2));renameSync(tmp,f);return value;
}

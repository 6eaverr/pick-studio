import { spawn } from 'node:child_process';
import { existsSync, mkdirSync,openSync,closeSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.join(here,'..');
const url=`http://127.0.0.1:${Number(process.env.PICK_PORT)||4318}`;
if(Number(process.versions.node.split('.')[0])<22){console.error('Node.js 22 or later is required. Install it from https://nodejs.org/');process.exit(1);}
console.log('Starting PICK Studio...');
async function running(){try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});return r.ok&&(await r.text()).includes('PICK Studio');}catch{return false;}}
if(!await running()){
  mkdirSync(path.join(root,'data'),{recursive:true});const log=openSync(path.join(root,'data','server.log'),'a');
  let startError;
  const child=spawn(process.execPath,[path.join(here,'server.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});
  child.on('error',e=>{startError=e;});child.unref();closeSync(log);
  for(let i=0;i<30&&!startError&&!await running();i++)await new Promise(r=>setTimeout(r,300));
  if(startError)console.error(startError.message);
}
if(!await running()){console.error(`PICK could not start. Check this log: ${path.join(root,'data','server.log')}`);process.exit(1);}
console.log(`PICK Studio is ready: ${url}/`);
try{
  const state=await (await fetch(`${url}/api/state`,{signal:AbortSignal.timeout(12000)})).json();
  if(state.codex?.loggedIn&&state.codex?.method==='ChatGPT')console.log('AI connection: ChatGPT ready (GPT-6 Astra available)');
  else console.log('AI connection: ChatGPT login required. Run AI connection.cmd once, then restart PICK.');
  if(state.claude?.loggedIn)console.log(`AI connection: Claude ready${state.claude.plan?` (${state.claude.plan} plan)`:''}`);
  else console.log('AI connection: Claude not connected. Run "claude auth login" to use Claude models.');
}catch{
  console.log('AI connection: could not verify. Check Connection Settings in PICK.');
}
if(!process.argv.includes('--check')){
  const edge=[process.env['ProgramFiles(x86)'],process.env.ProgramFiles,process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Microsoft','Edge','Application','msedge.exe')).find(existsSync);
  const browser=spawn(edge||path.join(process.env.WINDIR||'C:\\Windows','explorer.exe'),edge?[`--app=${url}`,'--window-size=1440,1000']:[url],{detached:true,windowsHide:false,stdio:'ignore'});
  browser.on('error',e=>{console.error(`Browser could not open: ${e.message}\nOpen this address in your browser: ${url}/`);process.exitCode=1;});
  browser.unref();
}

import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
const userData=path.resolve('.local/portable-test-'+Date.now());fs.mkdirSync(userData,{recursive:true});
const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
const child=spawn(path.resolve(process.env.TIMESCREEN_EXE || 'release/TimeScreen-'+version+'.exe'),['--remote-debugging-port='+port],{env:{...process.env,TIMESCREEN_DATA_DIR:userData},windowsHide:true,stdio:'ignore'});
let endpoint;
for(let i=0;i<120;i++){
  try{const response=await fetch('http://127.0.0.1:'+port+'/json/version');endpoint=(await response.json()).webSocketDebuggerUrl;if(endpoint)break;}catch{}
  await new Promise(r=>setTimeout(r,500));
}
if(!endpoint)throw Error('Portable application did not expose its test port');
const browser=await chromium.connectOverCDP(endpoint);
const page=browser.contexts()[0].pages()[0];
await page.getByRole('heading',{name:'项目列表',exact:false}).waitFor();
await page.getByRole('heading',{name:'当日统计',exact:true}).waitFor();
console.log('Portable EXE passed: extracted, launched, both home panels rendered.');
await page.evaluate(()=>window.close()).catch(()=>{});
await browser.close();
if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));

import {chromium} from '@playwright/test';
import fs from 'node:fs';
import {initialData} from '../src/model.js';
const data=initialData();
const now=new Date(),midnight=new Date(now);midnight.setHours(0,0,0,0);
data.projects=[
  {id:'design',name:'产品设计',description:'TimeScreen 界面与交互',color:'#7b8cde',icon:'palette',archived:false},
  {id:'ue5',name:'UE5 学习',description:'场景搭建与材质练习',color:'#72b9aa',icon:'graduation-cap',archived:false},
  {id:'read',name:'阅读',description:'专业书籍与日常阅读',color:'#dca06e',icon:'book-open',archived:false},
  {id:'code',name:'编程',description:'功能开发与测试',color:'#cc8bac',icon:'code-2',archived:false}
];
data.sessions=[];
for(let day=0;day<7;day++)for(let i=0;i<3;i++){
  const start=+midnight-day*86400000+(9+i*2)*3600000;
  const minutes=[45,30,25][i]+day*3;
  data.sessions.push({id:'s'+day+'_'+i,projectId:data.projects[i].id,mode:'down',target:minutes*60,startedAt:start,endedAt:start+minutes*60000,segments:[{start,end:start+minutes*60000}],status:'completed',note:''});
}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960},reducedMotion:'reduce'});
await page.addInitScript(d=>localStorage.setItem('timescreen-v1',JSON.stringify(d)),data);
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'开始专注',exact:true}).first().click();
fs.mkdirSync('artifacts',{recursive:true});
await page.screenshot({path:'artifacts/TimeScreen-home.png',fullPage:true,animations:'disabled'});
for(const [name,file] of [['时间统计','stats'],['我的项目','projects'],['专注记录','records'],['偏好设置','settings']]){
  await page.getByRole('button',{name,exact:true}).click();
  await page.screenshot({path:'artifacts/TimeScreen-'+file+'.png',fullPage:true,animations:'disabled'});
}
await browser.close();console.log('Preview screenshots generated with isolated sample data.');

import {_electron as electron} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {initialData,dateKey,validateData} from '../src/model.js';
const root=path.resolve('.local/groups-ui-'+Date.now());fs.mkdirSync(root,{recursive:true});
const data=initialData();delete data.folders;for(const key of ['fontSize','panelTransparency','fontFamily','distributionView'])delete data.settings[key];
data.projects=[{id:'e1',name:'阅读',color:'#7b8cde',icon:'book-open'},{id:'e2',name:'课程',color:'#72b9aa',icon:'graduation-cap'},{id:'e3',name:'运动',color:'#dca06e',icon:'dumbbell'}];
const day=new Date();day.setDate(day.getDate()-1);day.setHours(0,0,0,0);
data.sessions=data.projects.map((e,i)=>{const start=+day+(9+i)*3600000,end=start+(i+1)*600000;return {id:'s'+i,projectId:e.id,mode:'up',status:'completed',source:'manual',startedAt:start,endedAt:end,segments:[{start,end}],note:''};});
const original=JSON.stringify(data.sessions);const file=path.join(root,'timescreen.json');fs.writeFileSync(file,JSON.stringify(data));
const packaged=process.env.TEST_PACKAGED==='1',opts={executablePath:path.resolve(packaged?'release/win-unpacked/TimeScreen.exe':'node_modules/electron/dist/electron.exe'),args:packaged?[]:['.'],env:{...process.env,TIMESCREEN_DATA_DIR:root}};
let app=await electron.launch(opts),page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.getByRole('heading',{name:'事件与项目',exact:false}).waitFor();assert.equal(await page.locator('.event-row').count(),3);
async function move(id,parent){await page.locator('[data-event-id="'+id+'"]').getByTitle('编辑事件').click();await page.locator('#event-parent').selectOption(parent);await page.getByRole('button',{name:'保存修改',exact:true}).click();}
async function newFolder(name){await page.getByRole('button',{name:'新建项目',exact:true}).click();await page.locator('#folder-name').fill(name);await page.getByRole('button',{name:'创建项目',exact:true}).click();}
await newFolder('学习');await newFolder('个人');
const folders=await page.evaluate(()=>window.desktop.load().then(d=>d.folders));const a=folders.find(f=>f.name==='学习').id,b=folders.find(f=>f.name==='个人').id;
await move('e1',a);await move('e2',a);
assert.equal(await page.locator(`[data-drop-folder="${a}"] .event-row`).count(),2);
await page.getByRole('button',{name:'收起项目 学习',exact:true}).click();assert.equal(await page.locator(`[data-drop-folder="${a}"] .event-row`).count(),0);
await page.getByRole('button',{name:'展开项目 学习',exact:true}).click();
async function stats(){await page.getByRole('button',{name:'时间统计',exact:true}).click();await page.getByRole('button',{name:'按日统计',exact:true}).click();await page.locator('#stats-date').fill(dateKey(day));await page.locator('#stats-date').dispatchEvent('change');}
await stats();assert.equal(await page.locator('.legend [data-group-kind="project"]').count(),1);assert.equal(await page.locator('.legend-child').count(),2);
await page.getByLabel('周期统计层级').selectOption('projects');assert.equal(await page.locator('.legend [data-group-kind="project"]').count(),1);assert.equal(await page.locator('.legend [data-group-kind="event"]').count(),1);assert.ok((await page.locator('.legend').textContent()).includes('运动'));
await page.getByLabel('周期统计层级').selectOption('events');assert.equal(await page.locator('.legend [data-group-kind="event"]').count(),3);assert.equal(await page.locator('.legend [data-group-kind="project"]').count(),0);
await page.getByRole('button',{name:'专注时刻',exact:true}).click();await move('e1',b);await stats();await page.getByLabel('周期统计层级').selectOption('projects');assert.equal(await page.locator('.legend [data-group-kind="project"]').count(),2);
await page.getByRole('button',{name:'专注时刻',exact:true}).click();await move('e1','');await stats();assert.equal(await page.locator('.legend [data-group-kind="project"]').count(),1);assert.equal(await page.locator('.legend [data-group-kind="event"]').count(),2);
// Native drag-and-drop into a folder, including from the unassigned area.
await page.getByRole('button',{name:'专注时刻',exact:true}).click();await page.locator('[data-event-id="e3"]').dragTo(page.locator(`[data-drop-folder="${b}"] .folder-heading`));
await page.waitForFunction(id=>window.desktop.load().then(d=>d.projects.find(e=>e.id==='e3').parentId===id),b);
await page.locator(`[data-drop-folder="${b}"] [data-action="delete-folder"]`).click();await page.getByRole('button',{name:'确认解散',exact:true}).click();assert.equal(await page.locator('.unassigned-events [data-event-id="e3"]').count(),1);
// Create an event directly inside a project and retain the parent assignment.
await page.locator(`[data-drop-folder="${a}"] [data-action="new-event-in"]`).click();await page.locator('#project-name').fill('笔记');assert.equal(await page.locator('#event-parent').inputValue(),a);await page.getByRole('button',{name:'创建事件',exact:false}).click();
assert.ok((await page.locator(`[data-drop-folder="${a}"] .folder-children`).textContent()).includes('笔记'));
await page.getByRole('button',{name:'偏好设置',exact:true}).click();const before=await page.locator('.setting-row strong').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));
await page.locator('#panel-transparency').fill('70');await page.locator('#panel-transparency').dispatchEvent('change');await page.locator('#font-size').fill('125');await page.locator('#font-size').dispatchEvent('change');await page.locator('#font-family').selectOption('song');
const after=await page.locator('.setting-row strong').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(after>before*1.2);assert.ok((await page.locator('.card').first().evaluate(e=>getComputedStyle(e).backgroundColor)).includes('0.3'));assert.equal(await page.locator('#font-size-value').textContent(),'125%');
const backup=path.join(root,'group-backup.json');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},backup);
await page.getByRole('button',{name:'导出备份',exact:true}).click();await page.getByRole('status').filter({hasText:'备份已导出'}).waitFor();
const exported=JSON.parse(fs.readFileSync(backup,'utf8'));assert.equal(exported.folders.length,1);validateData(exported);
await page.locator('#font-size').fill('100');await page.locator('#font-size').dispatchEvent('change');
await page.locator('#import-file').setInputFiles(backup);await page.getByRole('button',{name:'替换并恢复',exact:true}).click();assert.equal(await page.locator('#font-size').inputValue(),'125');
await page.getByRole('button',{name:'专注时刻',exact:true}).click();await page.getByLabel('当日统计层级').selectOption('all');
fs.mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/hierarchy-home.png',animations:'disabled',fullPage:true});
// Expanded large-font layouts must not create horizontal scrolling at minimum window size.
await page.setViewportSize({width:1024,height:740});
for(const name of ['专注时刻','事件与项目','时间统计','专注记录','偏好设置']){await page.getByRole('button',{name,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow');}
await stats();await page.getByLabel('周期统计层级').selectOption('all');await page.screenshot({path:'artifacts/hierarchy-stats.png',animations:'disabled',fullPage:true});
await page.evaluate(()=>window.close());await new Promise(r=>app.process().once('exit',r));let saved=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(JSON.stringify(saved.sessions),original);assert.equal(saved.settings.fontFamily,'song');assert.equal(saved.settings.fontSize,125);validateData(saved);
app=await electron.launch(opts);page=await app.firstWindow();await page.getByRole('button',{name:'偏好设置',exact:true}).click();assert.equal(await page.locator('#font-family').inputValue(),'song');assert.equal(await page.locator('#panel-transparency').inputValue(),'70');assert.equal(await page.locator('#font-size').inputValue(),'125');
await app.close();assert.deepEqual(errors,[]);console.log('Hierarchy UI passed: legacy migration, create/collapse, dropdown/drag moves, three chart levels, dissolve, event creation, font/opacity, large-font layouts and native restart.');

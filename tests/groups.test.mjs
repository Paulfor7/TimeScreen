import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,validateData} from '../src/model.js';
import {normalizeGroups,moveEvent,removeFolder,distributionGroups,ensureChartColors,chartColorDistance} from '../src/groups.js';
import {sectorPath} from '../src/distribution.js';
function fixture(){const d=initialData();d.folders=[{id:'a',name:'学习',color:'#7b8cde'},{id:'b',name:'工作',color:'#72b9aa'}];d.projects=[{id:'e1',name:'阅读',color:'#dca06e',parentId:'a'},{id:'e2',name:'课程',color:'#cc8bac',parentId:'a',archived:true},{id:'e3',name:'运动',color:'#87a9c9',parentId:null}];return normalizeGroups(d);}
test('三种分布视图不重复计时，未归类事件在项目视图独立展示，归档事件仍计入',()=>{
 const d=fixture(),totals={e1:600,e2:1200,e3:1800};
 for(const mode of ['all','events','projects']){const groups=distributionGroups(d,totals,mode);assert.equal(groups.reduce((n,g)=>n+g.value,0),3600);}
 const groups=distributionGroups(d,totals,'all');const a=groups.find(g=>g.id==='a');assert.equal(a.value,1800);assert.equal(a.children.length,2);assert.equal(a.children.reduce((n,c)=>n+c.value,0),a.value);
 assert.equal(distributionGroups(d,totals,'events').length,3);assert.ok(distributionGroups(d,totals,'projects').some(g=>g.id==='e3'&&g.kind==='event'));
});
test('同色事件和项目获得独立颜色，跨视图、移动和备份恢复后保持一致',()=>{
 const d=fixture();for(const e of d.projects)e.color='#7b8cde';for(const f of d.folders)f.color='#7b8cde';
 const colors={...ensureChartColors(d)};assert.equal(new Set(Object.values(colors)).size,5);
 const values=Object.values(colors);for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)assert.ok(chartColorDistance(values[i],values[j])>=18,'颜色不能只是近似色号');
 distributionGroups(d,{e1:60,e2:120,e3:180},'events');distributionGroups(d,{e1:60,e2:120,e3:180},'projects');moveEvent(d,'e1','b');assert.deepEqual(ensureChartColors(d),colors);
 const restored=JSON.parse(JSON.stringify(d));validateData(restored);normalizeGroups(restored);assert.deepEqual(restored.settings.chartColors,colors);
 d.projects.push({id:'new',name:'新事件',color:'#7b8cde'});const expanded=ensureChartColors(d);for(const [key,color]of Object.entries(colors))assert.equal(expanded[key],color);assert.equal(new Set(Object.values(expanded)).size,6);
});
test('完整圆环和小扇区的路径有效',()=>{
 const whole=sectorPath(0,1,44,102),small=sectorPath(.75,.752,51,87);assert.equal((whole.match(/ A /g)||[]).length,4);assert.ok(!whole.includes('NaN'));assert.ok(small.endsWith(' Z'));assert.ok(!small.includes('NaN'));
});
test('移入、移动和移出项目后历史汇总立即变化，记录保持不变',()=>{
 const d=fixture(),totals={e1:600,e2:1200,e3:1800};d.sessions=[{id:'history',projectId:'e1',segments:[{start:0,end:600000}]}];const before=JSON.stringify(d.sessions);
 moveEvent(d,'e1','b');assert.equal(distributionGroups(d,totals,'projects').find(g=>g.id==='b').value,600);assert.equal(distributionGroups(d,totals,'projects').find(g=>g.id==='a').value,1200);
 moveEvent(d,'e1','');assert.ok(distributionGroups(d,totals,'projects').some(g=>g.id==='e1'&&g.kind==='event'));assert.equal(JSON.stringify(d.sessions),before);
 removeFolder(d,'a');assert.equal(d.projects.find(e=>e.id==='e2').parentId,null);assert.equal(d.sessions.length,1);assert.throws(()=>moveEvent(d,'e1','missing'));
});
test('旧备份兼容，文件夹与外观设置可导入导出，拒绝无效归属',()=>{
 const old=initialData();delete old.folders;delete old.settings.fontSize;old.projects=[{id:'old',name:'旧事件',color:'#7b8cde'}];validateData(old);normalizeGroups(old);assert.equal(old.projects[0].parentId,null);assert.equal(old.settings.fontSize,100);
 const d=fixture();d.settings.panelTransparency=75;d.settings.fontFamily='song';d.settings.fontSize=125;validateData(JSON.parse(JSON.stringify(d)));
 d.projects[0].parentId='missing';assert.throws(()=>validateData(d),/不存在/);d.projects[0].parentId='a';d.settings.fontSize=999;assert.throws(()=>validateData(d),/外观/);
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialData,validateData} from '../src/model.js';import {normalizeGroups} from '../src/groups.js';import {monthData} from '../src/calendar.js';
test('月历色块按实际时段跨日、跨月分配，与统计颜色一致',()=>{
 const d=normalizeGroups(initialData());d.projects=[{id:'a',name:'阅读',color:'#7b8cde'},{id:'b',name:'学习',color:'#7b8cde'}];
 const midnight=+new Date(2026,9,1);d.sessions=[{projectId:'a',segments:[{start:midnight-600000,end:midnight+1200000}],endedAt:midnight+1200000},{projectId:'b',segments:[{start:midnight+3600000,end:midnight+4200000}],endedAt:midnight+4200000}];
 const m=monthData(d,'2026-10-01');assert.equal(m.total,1800);const day=m.cells.find(c=>c.key==='2026-10-01');assert.equal(day.total,1800);assert.equal(day.entries.length,2);assert.equal(day.entries[0].seconds,1200);assert.equal(day.entries[0].color,d.settings.chartColors['event:a']);assert.notEqual(day.entries[0].color,day.entries[1].color);
 assert.equal(m.cells.find(c=>c.key==='2026-09-30').total,600);assert.equal(monthData(d,'2026-10-01','b').total,600);assert.equal(m.cells.length%7,0);
});
test('新外观选项兼容旧备份并校验颜色、字重和模糊范围',()=>{
 const d=initialData();delete d.settings.fontColor;delete d.settings.fontWeight;delete d.settings.panelBlur;normalizeGroups(d);assert.equal(d.settings.panelBlur,12);assert.equal(d.settings.fontWeight,'default');
 d.settings.fontColor='#163a5f';d.settings.fontWeight='600';d.settings.panelBlur=40;validateData(JSON.parse(JSON.stringify(d)));d.settings.panelBlur=41;assert.throws(()=>validateData(d),/外观/);d.settings.panelBlur=0;d.settings.fontColor='red; opacity:0';assert.throws(()=>validateData(d),/颜色/);
});

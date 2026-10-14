import {test} from 'node:test';
import assert from 'node:assert/strict';
import {elapsed,closeSegment,secondsIn,aggregate,rangeFor,buckets,initialData,validateData} from '../src/model.js';
import {createManualRecord} from '../src/model.js';
test('暂停不计入时间，继续后的多个时段正确相加',()=>{
  const a={segments:[{start:1000,end:11000},{start:21000,end:null}]};
  assert.equal(elapsed(a,26000),15000);closeSegment(a,26000);assert.equal(elapsed(a,99000),15000);
});
test('跨午夜的记录分配到两天，暂停跨日不产生用时',()=>{
  const midnight=+new Date(2026,9,14),s={segments:[{start:midnight-600000,end:midnight+1200000}]};
  assert.equal(secondsIn(s,midnight-86400000,midnight),600);assert.equal(secondsIn(s,midnight,midnight+86400000),1200);
  assert.equal(buckets([s],midnight-86400000,midnight+86400000).reduce((n,b)=>n+b.value,0),1800);
});
test('周从周一开始，月份范围正确跨年',()=>{
  const [a,b]=rangeFor('week',new Date(2026,9,14));assert.equal(new Date(a).getDay(),1);assert.equal((b-a)/86400000,7);
  const [c,d]=rangeFor('month',new Date(2026,11,31));assert.equal(new Date(c).getDate(),1);assert.equal(new Date(d).getFullYear(),2027);
});
test('项目归档不影响历史统计，提前结束仍计入时间',()=>{
  const data=initialData();data.projects=[{id:'p',name:'项目',color:'#7b8cde',archived:true}];
  data.sessions=[{id:'s',projectId:'p',startedAt:1000,mode:'up',segments:[{start:1000,end:61000}],endedAt:61000,status:'stopped'}];
  assert.deepEqual(aggregate(data.sessions,0,999999),{total:60,projects:{p:60},completed:0,stopped:1});assert.equal(validateData(data),data);
});
test('备份校验拒绝无效时段和丢失的项目引用',()=>{
  const d=initialData();d.sessions=[{projectId:'missing',segments:[],endedAt:1,status:'completed'}];assert.throws(()=>validateData(d));
  d.projects=[{id:'missing',name:'项目',color:'#7b8cde'}];d.sessions[0].segments=[{start:2,end:1}];assert.throws(()=>validateData(d));
});
test('项目 Logo 备份兼容旧项目，拒绝非图片地址',()=>{
  const d=initialData();d.projects=[{id:'p',name:'项目',color:'#7b8cde'}];assert.equal(validateData(d),d);
  d.projects[0].logo='data:image/png;base64,aGVsbG8=';assert.equal(validateData(d),d);
  d.projects[0].logo='https://example.com/image.png';assert.throws(()=>validateData(d));
});
test('手动记录跨日拆分、计入完成次数，兼容备份',()=>{
  const d=initialData();d.projects=[{id:'p',name:'项目',color:'#7b8cde',archived:true}];
  const midnight=+new Date(2026,9,14),r=createManualRecord({projectId:'p',startedAt:midnight-600000,durationMinutes:30,note:'补录'},d,midnight+86400000);
  d.sessions.push(r);assert.equal(secondsIn(r,midnight-86400000,midnight),600);assert.equal(secondsIn(r,midnight,midnight+86400000),1200);
  assert.equal(aggregate(d.sessions,0,Infinity).completed,1);assert.equal(r.source,'manual');assert.equal(validateData(d),d);
});
test('手动记录拒绝未来、非法时长和重复重叠，允许相邻时段',()=>{
  const d=initialData();d.projects=[{id:'p'}];const input={projectId:'p',startedAt:600000,durationMinutes:10};
  assert.throws(()=>createManualRecord(input,d,1000000),/当前时间/);
  assert.throws(()=>createManualRecord({...input,durationMinutes:0},d,9999999),/整数/);
  d.sessions.push(createManualRecord(input,d,9999999));assert.throws(()=>createManualRecord(input,d,9999999),/重叠/);
  assert.ok(createManualRecord({...input,startedAt:1200000},d,9999999));
  d.active={segments:[{start:1800000,end:null}]};assert.throws(()=>createManualRecord({...input,startedAt:1800000},d,9999999),/重叠/);
});

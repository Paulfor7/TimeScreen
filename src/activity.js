const validId=id=>typeof id==='string'&&/^[a-z\d_-]{1,80}$/i.test(id);
const dayKey=date=>{const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const defaultStatistics=()=>({period:'week',distributionView:'all',natureIds:['main'],targetIds:null});
export function normalizeActivity(data){
  data.natures??=[{id:'main',name:'主要'}];data.checkins??=[];
  data.settings.statsDefaults??=defaultStatistics();
  for(const folder of data.folders||[])folder.natureId??=null;
  for(const event of data.projects)event.natureId??='main';
  synchronizeNatures(data);
  return data;
}
export function eventNature(data,eventOrId){const event=typeof eventOrId==='string'?data.projects.find(e=>e.id===eventOrId):eventOrId;return (data.folders||[]).find(f=>f.id===event?.parentId)?.natureId||event?.natureId||'main';}
export function synchronizeNatures(data){for(const event of data.projects){const inherited=(data.folders||[]).find(f=>f.id===event.parentId)?.natureId;if(inherited)event.natureId=inherited;}for(const record of [...data.sessions,...(data.checkins||[]),...(data.active?[data.active]:[])])delete record.natureId;}
export function setFolderNature(data,id,natureId){const folder=data.folders.find(f=>f.id===id);if(!folder)throw Error('项目不存在');if(natureId&&!data.natures.some(n=>n.id===natureId))throw Error('性质不存在');synchronizeNatures(data);folder.natureId=natureId||null;synchronizeNatures(data);}
export function natureName(data,id){return (data.natures||[{id:'main',name:'主要'}]).find(n=>n.id===(id||'main'))?.name||'主要';}
export function matchesFilter(data,eventId,filter){
  if(!filter)return true;
  if(!filter.natureIds.includes(eventNature(data,eventId)))return false;
  if(filter.targetIds===null)return true;
  const event=data.projects.find(e=>e.id===eventId);
  return filter.targetIds.includes('event:'+eventId)||(event?.parentId&&filter.targetIds.includes('project:'+event.parentId))||false;
}
export function revealEvent(data,filter,eventId){
  const natureId=eventNature(data,eventId);
  if(!filter.natureIds.includes(natureId))filter.natureIds.push(natureId);
  if(!matchesFilter(data,eventId,filter)&&filter.targetIds!==null)filter.targetIds.push('event:'+eventId);
}
export const filteredSessions=(data,filter)=>data.sessions.filter(s=>matchesFilter(data,s.projectId,filter));
export function filteredCheckins(data,filter,start=-Infinity,end=Infinity){return (data.checkins||[]).filter(c=>{const time=+new Date(c.date+'T00:00');return time>=start&&time<end&&matchesFilter(data,c.eventId,filter);});}
export function addCheckin(data,{eventId,date},now=Date.now()){
  if(!data.projects.some(e=>e.id===eventId&&e.kind==='checkin'))throw Error('请选择打卡事件');
  const natureId=eventNature(data,eventId);
  if(!data.natures.some(n=>n.id===natureId))throw Error('请选择有效性质');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||dayKey(new Date(date+'T00:00'))!==date||date>dayKey(now))throw Error('请选择今天或之前的有效日期');
  if(data.checkins.some(c=>c.eventId===eventId&&c.date===date))throw Error('该事件当天已经打卡');
  const item={id:crypto.randomUUID(),eventId,date};data.checkins.push(item);return item;
}
export function validateActivity(data){
  const natures=data.natures??[{id:'main',name:'主要'}],ids=new Set();
  if(!Array.isArray(natures)||!natures.length)throw Error('计时性质数据无效');
  for(const n of natures){if(!n||!validId(n.id)||ids.has(n.id)||typeof n.name!=='string'||!n.name.trim()||n.name.length>30)throw Error('计时性质数据无效');ids.add(n.id);}
  if(!ids.has('main'))throw Error('缺少默认性质');
  for(const event of data.projects)if(event.natureId!==undefined&&!ids.has(event.natureId))throw Error('事件性质不存在');
  for(const folder of data.folders||[])if(folder.natureId!=null&&!ids.has(folder.natureId))throw Error('项目性质不存在');
  for(const p of data.projects)if(p.kind!==undefined&&!['timer','checkin'].includes(p.kind))throw Error('事件类型无效');
  const checks=data.checkins??[],seen=new Set(),recordIds=new Set();
  if(!Array.isArray(checks))throw Error('打卡数据无效');
  for(const c of checks){const key=c.eventId+':'+c.date;if(!validId(c.id)||recordIds.has(c.id)||!data.projects.some(e=>e.id===c.eventId&&e.kind==='checkin')||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||dayKey(new Date(c.date+'T00:00'))!==c.date||seen.has(key))throw Error('打卡数据无效');seen.add(key);recordIds.add(c.id);}
  const defaults=data.settings.statsDefaults;
  if(defaults){if(!['day','week','month'].includes(defaults.period)||!['all','events','projects'].includes(defaults.distributionView)||!Array.isArray(defaults.natureIds)||defaults.natureIds.some(id=>!ids.has(id))||!(defaults.targetIds===null||Array.isArray(defaults.targetIds)&&defaults.targetIds.every(id=>/^(event|project):[a-z\d_-]{1,80}$/i.test(id))))throw Error('默认统计方式无效');}
}

// Monotone cubic interpolation: smooth curves stay between adjacent samples.
export function smoothPath(points){
  if(!points.length)return '';
  if(points.length===1)return `M ${points[0].join(' ')}`;
  const slopes=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(p[0]-points[i][0]));
  const tangents=points.map((p,i)=>i===0?slopes[0]:i===points.length-1?slopes.at(-1):slopes[i-1]*slopes[i]<=0?0:2/(1/slopes[i-1]+1/slopes[i]));
  return `M ${points[0].join(' ')}`+points.slice(1).map((p,i)=>{const a=points[i],dx=(p[0]-a[0])/3;return ` C ${a[0]+dx} ${a[1]+dx*tangents[i]}, ${p[0]-dx} ${p[1]-dx*tangents[i+1]}, ${p.join(' ')}`;}).join('');
}

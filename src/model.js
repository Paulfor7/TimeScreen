export const COLORS = ['#7b8cde','#72b9aa','#dca06e','#cc8bac','#87a9c9','#aaa0cf','#9aaa72','#d57f7f'];
export const uid = () => crypto.randomUUID();
export function initialData() {
  return {version:1, projects:[],sessions:[],active:null,settings:{focus:25,shortBreak:5,longBreak:15,cycles:4,pomodoro:true,sound:true,background:'',overlay:35,dailyGoal:120}};
}
export const dateKey = date => {const d = new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function rangeFor(period, date) {
  const start=new Date(date); start.setHours(0,0,0,0);
  if(period==='week') start.setDate(start.getDate()-((start.getDay()+6)%7));
  if(period==='month') start.setDate(1);
  const end=new Date(start);
  if(period==='month') end.setMonth(end.getMonth()+1); else end.setDate(end.getDate()+(period==='week'?7:1));
  return [+start,+end];
}
export function elapsed(active, now=Date.now()) {
  if(!active) return 0;
  return active.segments.reduce((sum,s)=>sum+Math.max(0,(s.end??now)-s.start),0);
}
export function closeSegment(active, now=Date.now()) { const s=active.segments.at(-1); if(s && s.end==null) s.end=Math.max(s.start,now); }
export function secondsIn(session, start=-Infinity, end=Infinity) {
  return session.segments.reduce((n,s)=> n+Math.max(0,Math.min(s.end,end)-Math.max(s.start,start)),0)/1000;
}
export function aggregate(sessions, start, end) {
  const projects={}; let total=0, completed=0, stopped=0;
  for(const s of sessions) {
    const seconds=secondsIn(s,start,end);
    if(seconds>0) {total+=seconds; projects[s.projectId]=(projects[s.projectId]||0)+seconds;}
    if(s.endedAt>=start && s.endedAt<end) {if(s.status==='completed') completed++; else stopped++;}
  }
  return {total,projects,completed,stopped};
}
export function buckets(sessions,start,end,hourly=false) {
  const list=[]; let cursor=start;
  while(cursor<end) {
    const next=new Date(cursor);
    if(hourly) next.setHours(next.getHours()+1); else next.setDate(next.getDate()+1);
    const stop=Math.min(+next,end);
    list.push({date:cursor,value:sessions.reduce((sum,s)=>sum+secondsIn(s,cursor,stop),0)});
    cursor=stop;
  }
  return list;
}
export function validateData(d) {
  if(!d || d.version!==1 || !Array.isArray(d.projects)||!Array.isArray(d.sessions)||!d.settings) throw Error('这不是有效的 TimeScreen 备份文件');
  const ids=new Set(),validId=id=>typeof id==='string'&&/^[a-z\d_-]{1,80}$/i.test(id);
  const validIcons=['folder','book-open','code-2','palette','graduation-cap','dumbbell','headphones','sprout'];
  for(const p of d.projects) {if(!validId(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!/^#[a-f\d]{6}$/i.test(p.color)||(p.icon&&!validIcons.includes(p.icon))) throw Error('项目数据无效');ids.add(p.id);}
  const sessionIds=new Set();
  for (const p of d.projects) if(p.logo!==undefined && (typeof p.logo!=='string'||p.logo.length>1500000||(p.logo&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(p.logo)))) throw Error('项目 Logo 数据无效');
  for(const s of d.sessions) {
    if(!validId(s.id)||sessionIds.has(s.id)||!ids.has(s.projectId)||!Array.isArray(s.segments)||!Number.isFinite(s.startedAt)||!Number.isFinite(s.endedAt)||!['completed','stopped'].includes(s.status)||!['up','down'].includes(s.mode)) throw Error('记录数据无效');
    sessionIds.add(s.id);
    for(const seg of s.segments) if(!Number.isFinite(seg.start)||!Number.isFinite(seg.end)||seg.end<seg.start) throw Error('时间数据无效');
  }
  for(const key of ['focus','shortBreak','longBreak','cycles','dailyGoal']) if(!Number.isFinite(d.settings[key])||d.settings[key]<1||d.settings[key]>1440) throw Error('设置数据无效');
  if(typeof d.settings.background!=='string'||(d.settings.background&&!/^data:image\/(png|jpeg|webp);base64,/.test(d.settings.background))) throw Error('背景数据无效');
  return d;
}

export function createManualRecord(input, data, now=Date.now()) {
  if(!data.projects.some(p=>p.id===input.projectId)) throw Error('请选择项目');
  const startedAt=Number(input.startedAt),minutes=Number(input.durationMinutes);
  if(!Number.isFinite(startedAt)||startedAt<0) throw Error('请输入有效的开始时间');
  if(!Number.isInteger(minutes)||minutes<1||minutes>1440) throw Error('专注时长须为 1–1440 的整数分钟');
  const endedAt=startedAt+minutes*60000;
  if(endedAt>now) throw Error('结束时间不能晚于当前时间');
  const records=[...data.sessions,...(data.active?[data.active]:[])];
  if(records.some(s=>s.segments.some(seg=>seg.start<endedAt&&(seg.end??now)>startedAt))) throw Error('该时段与已有记录或正在进行的计时重叠，请调整时间');
  return {id:uid(),projectId:input.projectId,startedAt,endedAt,segments:[{start:startedAt,end:endedAt}],mode:'up',target:0,status:'completed',source:'manual',note:String(input.note||'').trim().slice(0,1000)};
}

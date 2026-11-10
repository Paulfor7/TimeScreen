import {filteredSessions,filteredCheckins} from './activity.js';
import {aggregate,dateKey,rangeFor} from './model.js';
import {ensureChartColors} from './groups.js';
export function monthData(data,selected,eventId=''){
  const filter=typeof eventId==='object'?eventId:null;
  const d=new Date(selected+'T12:00'),first=new Date(d.getFullYear(),d.getMonth(),1),start=new Date(first);
  start.setDate(1-(first.getDay()+6)%7);start.setHours(0,0,0,0);
  const count=Math.ceil(((first.getDay()+6)%7+new Date(d.getFullYear(),d.getMonth()+1,0).getDate())/7)*7;
  const sessions=filter?filteredSessions(data,filter):eventId?data.sessions.filter(s=>s.projectId===eventId):data.sessions;
  const colors=ensureChartColors(data),events=new Map(data.projects.map(e=>[e.id,e]));
  const entries=stats=>Object.entries(stats.projects).map(([id,seconds])=>({id,name:events.get(id)?.name||'',seconds,color:colors['event:'+id]})).sort((a,b)=>b.seconds-a.seconds);
  const cells=Array.from({length:count},(_,i)=>{const day=new Date(start);day.setDate(day.getDate()+i);const stats=aggregate(sessions,...rangeFor('day',day));return {key:dateKey(day),number:day.getDate(),outside:day.getMonth()!==d.getMonth(),total:stats.total,entries:entries(stats)};});
  for(const cell of cells)cell.checkins=filteredCheckins(data,filter,...rangeFor('day',cell.key+'T00:00')).filter(c=>!eventId||filter||c.eventId===eventId).map(c=>({...c,name:events.get(c.eventId)?.name||'',color:colors['event:'+c.eventId]}));
  const checks=filteredCheckins(data,filter,...rangeFor('month',first)).filter(c=>!eventId||filter||c.eventId===eventId);
  const month=aggregate(sessions,...rangeFor('month',first));
  return {year:d.getFullYear(),month:d.getMonth()+1,cells,checkins:checks,total:month.total,entries:entries(month)};
}

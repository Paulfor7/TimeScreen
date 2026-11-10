import {elapsed,secondsIn,rangeFor} from './model.js';
import {eventNature,natureName} from './activity.js';

export function miniSnapshot(data,{selected='',natureId='main',breakState=null,now=Date.now()}={}){
  const active=data.active;
  const event=data.projects.find(e=>e.id===active?.projectId)||data.projects.find(e=>e.id===selected&&!e.archived&&e.kind!=='checkin'&&eventNature(data,e)===natureId)||data.projects.find(e=>!e.archived&&e.kind!=='checkin'&&eventNature(data,e)===natureId);
  const folder=data.folders.find(f=>f.id===event?.parentId),[start,end]=rangeFor('day',now);
  const records=[...data.sessions,...(active?[{...active,segments:active.segments.map(s=>({...s,end:s.end??now}))}]:[])];
  const eventToday=records.filter(s=>s.projectId===event?.id).reduce((n,s)=>n+secondsIn(s,start,end),0);
  const members=new Set(folder?data.projects.filter(e=>e.parentId===folder.id).map(e=>e.id):[event?.id]);
  const projectToday=records.filter(s=>members.has(s.projectId)).reduce((n,s)=>n+secondsIn(s,start,end),0);
  const spent=active?elapsed(active,now)/1000:0;
  return {eventId:event?.id||'',eventName:event?.name||'暂无计时事件',folderName:folder?.name||'独立事件',nature:event?natureName(data,eventNature(data,event)):'',eventToday,projectToday,spent,
    seconds:breakState?Math.max(0,(breakState.end-now)/1000):active?(active.mode==='down'?Math.max(0,active.target-spent):spent):0,
    status:breakState?'休息中':active?(active.paused?'已暂停':active.mode==='down'?'倒计时':'正向计时'):'未开始',active:!!active,paused:!!active?.paused,rest:!!breakState};
}

export function miniView(snapshot,{pinned,esc,icon,clockText,shortTime,settings={}}){
  const s=snapshot,bg=settings.miniBackground||'',veil=Math.max(0,Math.min(95,Number(settings.miniOverlay??65)))/100;
  return `<section class="mini-timer" aria-label="TimeScreen 计时浮窗" style="--mini-bg:${bg?`url('${esc(bg)}')`:'none'};--mini-overlay:${veil}"><header class="mini-header"><span class="mini-brand">${icon('aperture')} TimeScreen</span><div class="mini-window-tools"><label class="mini-upload" title="自定义浮窗背景" aria-label="自定义浮窗背景">${icon('image')}<input type="file" id="mini-background-file" accept="image/png,image/jpeg,image/webp" hidden></label>${bg?`<button data-action="reset-mini-background" title="移除浮窗背景" aria-label="移除浮窗背景">${icon('x')}</button>`:''}<button data-action="mini-pin" title="${pinned?'取消置顶':'置顶浮窗'}" aria-label="${pinned?'取消置顶':'置顶浮窗'}" aria-pressed="${pinned}">${icon('flag')}</button><button data-action="mini-restore" title="恢复主窗口" aria-label="恢复主窗口">${icon('maximize-2')}</button></div></header><div class="mini-event"><div><h1 title="${esc(s.eventName)}">${esc(s.eventName)}</h1><p title="${esc(s.folderName)}">${esc(s.nature)}${s.nature?' · ':''}${esc(s.folderName)}</p></div><span class="mini-status ${s.paused?'paused':''}">${s.status}</span></div><div id="mini-clock" class="mini-clock" aria-label="当前计时">${clockText(s.seconds)}</div><div class="mini-totals"><span>今日事项 <b id="mini-event-total">${shortTime(s.eventToday)}</b></span><span>今日项目 <b id="mini-project-total">${shortTime(s.projectToday)}</b></span></div><div class="mini-controls">${s.rest?`<button class="mini-primary" data-action="skip-break">${icon('coffee')} 结束休息</button>`:s.active?`<button class="mini-secondary" data-action="pause" aria-label="${s.paused?'继续专注':'暂停'}">${icon(s.paused?'play':'pause')}${s.paused?'继续':'暂停'}</button><button class="mini-primary" data-action="finish" aria-label="完成并保存">${icon('check')}完成</button>`:s.eventId?`<button class="mini-primary" data-action="mini-start">${icon('play')} 开始计时</button>`:'<button class="mini-primary" data-action="mini-restore">打开主窗口创建事件</button>'}</div></section>`;
}

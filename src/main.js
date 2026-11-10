import {createIcons,ChevronDown,Aperture,Archive,ArchiveRestore,ArrowRight,ArrowUpRight,BarChart,BookOpen,CalendarDays,ChartNoAxesColumnIncreasing,ChartNoAxesCombined,Check,ChevronLeft,ChevronRight,CircleAlert,CircleCheck,Clock,Clock3,Code2,Coffee,Donut,Download,Dumbbell,File,Flag,Focus,Folder,FolderOpen,Fullscreen,GraduationCap,Headphones,Image,Infinity as InfinityIcon,Layers2,LineChart,Maximize2,MoveUpRight,NotebookPen,Palette,Pause,Pencil,PencilLine,Play,Plus,Radio,Scan,Settings,ShieldCheck,Sidebar,SkipForward,SlidersHorizontal,Sparkles,Sprout,Square,Sun,Timer,Upload,X} from 'lucide';
const icons={ChevronDown,Aperture,Archive,ArchiveRestore,ArrowRight,ArrowUpRight,BarChart,BookOpen,CalendarDays,ChartNoAxesColumnIncreasing,ChartNoAxesCombined,Check,ChevronLeft,ChevronRight,CircleAlert,CircleCheck,Clock,Clock3,Code2,Coffee,Donut,Download,Dumbbell,File,Flag,Focus,Folder,FolderOpen,Fullscreen,GraduationCap,Headphones,Image,Infinity:InfinityIcon,Layers2,LineChart,Maximize2,MoveUpRight,NotebookPen,Palette,Pause,Pencil,PencilLine,Play,Plus,Radio,Scan,Settings,ShieldCheck,Sidebar,SkipForward,SlidersHorizontal,Sparkles,Sprout,Square,Sun,Timer,Upload,X};
import {COLORS,uid,initialData,dateKey,rangeFor,elapsed,closeSegment,secondsIn,aggregate,buckets,validateData} from './model.js';
import './style.css';
import {importImage} from './images.js';
import {cropLogo} from './logo-crop.js';
import {createManualRecord,localDateTime} from './manual-record.js';
import {updateRecord,discardActive} from './model.js';
import {normalizeGroups,moveEvent,removeFolder,FONT_FAMILIES,ensureChartColors} from './groups.js';
import {distribution} from './distribution.js';
import {eventList} from './event-list.js';
import {recordsView} from './records-view.js';
import {eventNature,revealEvent,synchronizeNatures,setFolderNature,natureName,filteredSessions,filteredCheckins,addCheckin,smoothPath} from './activity.js';
import {filterControls} from './filter-controls.js';
import {miniView,miniSnapshot} from './mini-view.js';
import {appearanceControls as appearanceFields} from './appearance-controls.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<i data-lucide="${name}" class="${cls}"></i>`;
const projectArtwork=p=>p?.logo?`<img class="project-logo" src="${esc(p.logo)}" alt="${esc(p.name)} Logo">`:icon(p?.icon||'folder');
let data=initialData(), page='focus', selected='', mode='down', duration=25, period='week', anchor=dateKey(Date.now()), archived=false, recordDate=dateKey(Date.now()), filterProject='', cycle=0, breakState=null, dialog=null, toastTimeout, saveQueue=Promise.resolve();
let windowState={compact:false,pinned:false};
try{if(window.desktop?.getWindowMode)windowState=await window.desktop.getWindowMode();}catch{}
let bootError=false;
try {data=(window.desktop?await window.desktop.load():JSON.parse(localStorage.getItem('timescreen-v1')))||initialData();} catch {bootError=true;}
normalizeGroups(data);
data.settings={...initialData().settings,...data.settings};
if(data.settings.background && !data.settings.backgroundVersion){data.settings.overlay=Math.min(Number(data.settings.overlay)||35,45);data.settings.backgroundVersion=2;}
cycle=Number.isInteger(data.cycle)?data.cycle:0;
selected=data.projects.find(p=>!p.archived&&p.kind!=='checkin')?.id||''; duration=data.settings.focus;
// Reopening never adds unattended hours. Recover only up to the last persisted heartbeat.
let recovered=false;
if(data.active){closeSegment(data.active,data.active.lastSeen||data.active.startedAt);data.active.paused=true;selected=data.active.projectId;mode=data.active.mode;if(data.active.target)duration=data.active.target/60;recovered=true;}
let selectedNature=data.active?eventNature(data,data.active.projectId):'main',statsFilter=structuredClone(data.settings.statsDefaults),calendarFilter=structuredClone(data.settings.statsDefaults);
period=statsFilter.period;
function enterStatistics(){statsFilter=structuredClone(data.settings.statsDefaults);period=statsFilter.period;data.settings.distributionView=statsFilter.distributionView;}
function persist(){
  synchronizeNatures(data);
  ensureChartColors(data);
  const snapshot=JSON.parse(JSON.stringify(data));
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{const saved=window.desktop?await window.desktop.save(snapshot):localStorage.setItem('timescreen-v1',JSON.stringify(snapshot));if(saved===false)throw Error('保存失败');return true;}).catch(()=>{toast('保存失败，请导出备份并检查磁盘空间',true);return false;});
  return saveQueue;
}
const project=id=>data.projects.find(p=>p.id===id);
const eventPath=p=>{if(!p)return '';const f=data.folders.find(f=>f.id===p.parentId);return f?f.name+' / '+p.name:p.name;};
const timeText=seconds=>{seconds=Math.max(0,Math.floor(seconds));if(seconds<60)return `${seconds} 秒`;const m=Math.floor(seconds/60);return m>=60?`${Math.floor(m/60)} 小时 ${m%60} 分钟`:`${m} 分钟`;};
const shortTime=seconds=>{const m=Math.floor(seconds/60);return m>=60?`${Math.floor(m/60)}h ${m%60}m`:seconds<60?`${Math.floor(seconds)}s`:`${m}m`;};
const clockText=seconds=>{seconds=Math.max(0,Math.ceil(seconds));const h=Math.floor(seconds/3600);return `${h?String(h).padStart(2,'0')+':':''}${String(Math.floor(seconds%3600/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const hm=t=>new Date(t).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
function toast(text,error=false){$('#toast')?.remove();document.body.insertAdjacentHTML('beforeend',`<div id="toast" class="toast ${error?'error':''}" role="status">${icon(error?'circle-alert':'circle-check')} ${esc(text)}</div>`);createIcons({icons});clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast')?.remove(),4200);}
function todayStats(){return aggregate(filteredSessions(data,{natureIds:[selectedNature],targetIds:null}),...rangeFor('day',Date.now()));}
function applyBackground(){applyAppearance();if(data.settings.background&&!data.settings.backgroundVersion){data.settings.overlay=Math.min(Number(data.settings.overlay)||35,45);data.settings.backgroundVersion=2;}document.body.style.setProperty('--bg-image',data.settings.background?`url("${data.settings.background}")`:'none');document.body.style.setProperty('--veil',Math.min(95,Math.max(0,Number(data.settings.overlay)||0))/100);document.body.classList.toggle('custom-bg',!!data.settings.background);if($('#overlay-value'))$('#overlay-value').textContent=data.settings.overlay+'%';}
function currentMini(){return miniSnapshot(data,{selected,natureId:selectedNature,breakState});}
function render(){
  applyBackground();
  document.body.classList.toggle('compact-mode',windowState.compact);
  if(windowState.compact){$('#app').innerHTML=miniView(currentMini(),{pinned:windowState.pinned,esc,icon,clockText,shortTime,settings:data.settings});createIcons({icons});updateClock();return;}
  const today=todayStats();
  $('#app').innerHTML=`<aside class="sidebar"><a class="brand" href="#" data-action="nav" data-page="focus"><span class="brand-symbol">${icon('aperture')}</span><span>TimeScreen<small>专注 · 记录 · 统计</small></span></a><div class="nav-label">我的空间</div><nav>${[['focus','timer','专注时刻'],['projects','layers-2','事件与项目'],['stats','chart-no-axes-combined','时间统计'],['records','calendar-days','专注记录']].map(([id,i,label])=>`<button class="nav-item ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(i)}<span>${label}</span>${page===id?'<span class="nav-dot"></span>':''}</button>`).join('')}</nav><div class="sidebar-bottom"><button class="nav-item ${page==='settings'?'active':''}" data-action="nav" data-page="settings">${icon('sliders-horizontal')}<span>偏好设置</span></button><div class="local-badge"><span></span> 数据仅保存在本机</div></div></aside><main><header class="topbar"><div class="breadcrumb">我的空间 <span>/</span> ${{focus:'专注时刻',projects:'事件与项目',stats:'时间统计',records:'专注记录',settings:'偏好设置'}[page]}</div><div class="topbar-right">${window.desktop?.setCompact?`<button class="mini-entry" data-action="mini-open" title="切换为置顶小浮窗">${icon('scan')} 小浮窗</button>`:''}${data.active&&page!=='focus'?`<button class="live-pill" data-action="nav" data-page="focus"><span></span> ${data.active.paused?'已暂停':'专注中'} · ${esc(project(data.active.projectId)?.name)}</button>`:''}<span>${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</span><div class="avatar">T</div></div></header><div class="page-content">${({focus:focusPage,projects:projectsPage,stats:statsPage,records:recordsPage,settings:settingsPage}[page])()}</div><footer>TimeScreen <span>1.4.0</span></footer></main><div id="modal-root"></div>`;
  createIcons({icons});updateClock();
}
function heading(kicker,title,subtitle,actions=''){return `<div class="page-heading"><div>${kicker?`<div class="eyebrow">${kicker}</div>`:''}<h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;}
function applyAppearance(){
  const alpha=1-Math.max(0,Math.min(100,Number(data.settings.panelTransparency)||0))/100;
  document.body.style.setProperty('--panel-alpha',alpha);
  document.body.style.setProperty('--font-scale',Math.max(.8,Math.min(1.3,(Number(data.settings.fontSize)||100)/100)));
  document.body.style.fontFamily=FONT_FAMILIES[data.settings.fontFamily]||FONT_FAMILIES.system;
  document.body.style.setProperty('--panel-blur',Math.max(0,Math.min(40,Number(data.settings.panelBlur)||0))+'px');
  document.body.style.setProperty('--font-color',data.settings.fontColor);
  document.body.style.setProperty('--font-weight',data.settings.fontWeight==='default'?'400':data.settings.fontWeight);
  document.body.classList.toggle('custom-font-color',data.settings.fontColor.toLowerCase()!=='#343747');
  document.body.classList.toggle('custom-font-weight',data.settings.fontWeight!=='default');
  if($('#panel-blur-value'))$('#panel-blur-value').textContent=data.settings.panelBlur+'px';
  if($('#font-color-value'))$('#font-color-value').textContent=data.settings.fontColor.toUpperCase();
  for(const [id,key] of [['panel-transparency','panelTransparency'],['font-size','fontSize']])if($('#'+id+'-value'))$('#'+id+'-value').textContent=data.settings[key]+'%';
}
function applyAppearanceSetting(input){const keys={'font-size':'fontSize','panel-transparency':'panelTransparency','panel-blur':'panelBlur'};data.settings[keys[input.id]]=Number(input.value);applyAppearance();}
function appearanceControls(){return appearanceFields(data.settings);}
function entityNatureFields(prefix,value,allowNone=false){return `<label class="field">${prefix==='folder'?'项目性质':'事件性质'}<select id="${prefix}-nature">${allowNone?`<option value="" ${!value?'selected':''}>不统一指定（事件各自设置）</option>`:''}${data.natures.map(n=>`<option value="${n.id}" ${value===n.id?'selected':''}>${esc(n.name)}</option>`).join('')}</select></label><label class="field nature-create-field">新增性质 <small>可选，填写后使用新性质</small><input id="${prefix}-new-nature" maxlength="30" placeholder="例如：工作、学习、生活、休闲"></label>`;}
function readNatureChoice(id,newId,allowNone=false){const name=$('#'+newId)?.value.trim();if(name){const old=data.natures.find(n=>n.name===name);if(old)return old.id;const item={id:uid(),name};data.natures.push(item);return item.id;}return $('#'+id).value||(allowNone?null:'main');}
function eventNatureFields(event,parentId){const folder=data.folders.find(f=>f.id===(event?.parentId||parentId)),value=folder?.natureId||(event?eventNature(data,event):selectedNature);return `<div class="event-nature-fields">${entityNatureFields('event',value)}<p class="manual-hint" id="event-nature-inherited"></p></div>`;}
function syncEventNature(){if(!$('#event-parent'))return;const folder=data.folders.find(f=>f.id===$('#event-parent').value),select=$('#event-nature'),input=$('#event-new-nature'),forced=folder?.natureId;select.disabled=!!forced;input.disabled=!!forced;input.closest('label').hidden=!!forced;select.value=forced||dialog.ownNature||'main';$('#event-nature-inherited').textContent=forced?'跟随项目「'+folder.name+'」的性质；可在编辑项目中修改。':'';}
function folderModal(id){
  const folder=data.folders.find(f=>f.id===id);
  openModal(folder?'编辑项目':'新建项目',`<label class="field">项目名称<input id="folder-name" required maxlength="40" value="${esc(folder?.name||'')}" placeholder="例如：工作、学习、个人项目"></label>${entityNatureFields('folder',folder?folder.natureId:selectedNature,true)}<div class="field">项目颜色<div class="color-picker folder-colors">${COLORS.map((c,i)=>`<label style="--swatch:${c}"><input type="radio" name="folder-color" value="${c}" ${(folder?folder.color===c:i===0)?'checked':''}><span>${icon('check')}</span></label>`).join('')}</div></div><p class="manual-hint">项目用于收纳事件。移动事件后，历史用时会按最新归属汇总。</p>`,`<button class="primary" type="submit">${folder?'保存项目':'创建项目'}</button>`,()=>{const name=$('#folder-name').value.trim();if(!name)return toast('请输入项目名称');const natureId=readNatureChoice('folder-nature','folder-new-nature',true);if(natureId===undefined)return;const values={name,color:$('.folder-colors input:checked').value};if(folder){Object.assign(folder,values);setFolderNature(data,folder.id,natureId);}else data.folders.push({id:uid(),...values,natureId,collapsed:false});persist();closeModal();render();toast(folder?'项目已更新':'项目已创建');});
}
function deleteFolderModal(id){const f=data.folders.find(f=>f.id===id);if(!f)return;const count=data.projects.filter(p=>p.parentId===id).length;openModal('解散项目？',`<p class="modal-copy">${esc(f.name)} 中的 ${count} 个事件会移回独立事件，事件和历史记录会保留。</p>`,'<button class="primary danger" type="submit">确认解散</button>',()=>{removeFolder(data,id);persist();closeModal();render();toast('项目已解散，事件已移出');});}
function assignEvent(eventId,folderId){try{moveEvent(data,eventId,folderId);const f=data.folders.find(f=>f.id===folderId);if(f)f.collapsed=false;persist();render();toast('归属已更新，统计已同步');}catch(err){toast(err.message,true);}}
function natureDirectory(){return `<section class="nature-directory" aria-label="性质分类"><div class="nature-directory-label">${icon('folder-open')} 性质分类</div><nav aria-label="打开性质文件夹">${data.natures.map(n=>`<button class="nature-directory-item ${n.id===selectedNature?'selected':''}" data-action="open-nature" data-id="${n.id}" aria-pressed="${n.id===selectedNature}">${icon(n.id===selectedNature?'folder-open':'folder')}<span>${esc(n.name)}</span><small>${data.projects.filter(e=>!e.archived&&eventNature(data,e)===n.id).length}</small></button>`).join('')}</nav><button class="text-button" data-action="manage-natures">管理分类</button></section>`;}
function focusPage(){
  const today=todayStats(),live=!!data.active||!!breakState,events=data.projects.filter(p=>!p.archived&&eventNature(data,p)===selectedNature);
  return heading('','专注计时','')+natureDirectory()+`<div class="home-layout"><section class="card home-projects"><div class="card-title"><h2>事件与项目 <span class="count-badge">${events.length}</span></h2><div class="header-actions"><button class="secondary" data-action="new-folder">${icon('folder')} 新建项目</button><button class="secondary" data-action="new-checkin">${icon('check')} 新建打卡</button><button class="secondary" data-action="new-project">${icon('plus')} 新建事件</button></div></div><div class="list-timer-settings"><div class="segmented"><button data-action="mode" data-mode="down" class="${mode==='down'?'selected':''}" ${live?'disabled':''}>倒计时</button><button data-action="mode" data-mode="up" class="${mode==='up'?'selected':''}" ${live?'disabled':''}>正向计时</button></div>${mode==='down'?`<label class="list-duration"><input id="duration" type="number" min="1" max="1440" value="${duration}" aria-label="计时分钟" ${live?'disabled':''}> 分钟</label>`:'<span class="muted">手动结束计时</span>'}${data.active&&eventNature(data,data.active.projectId)!==selectedNature?`<button class="text-button" data-action="show-active">返回正在计时的事件</button>`:''}<label class="list-pomodoro"><span class="switch"><input id="pomodoro" type="checkbox" ${data.settings.pomodoro?'checked':''} ${live?'disabled':''} aria-label="番茄休息"><span></span></span>番茄休息</label></div>${breakState?`<div class="break-banner">${icon('coffee')}<span>休息中</span><strong id="clock"></strong><button class="text-button" data-action="skip-break">结束休息 ${icon('skip-forward')}</button></div>`:''}${eventList(data,events,today,false,{esc,icon,projectArtwork,shortTime,clockText,onBreak:!!breakState,natureId:selectedNature})}</section><section class="card home-today"><div class="card-title"><h2>当日统计</h2><span class="muted">${esc(natureName(data,selectedNature))} · ${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric'})}</span></div><div class="home-today-metrics"><div><strong>${Math.floor(today.total/60)}<small>分钟</small></strong><span>专注时长</span></div><div><strong>${today.completed}<small>次</small></strong><span>完成专注</span></div></div>${distribution(data,today,'today')}<div class="today-summary"><span>仅统计已保存记录</span><button class="text-button" data-action="nav" data-page="stats">详细统计 ${icon('arrow-up-right')}</button></div></section></div>`;
}
function projectsPage(){
  const events=data.projects.filter(p=>!!p.archived===archived);
  return heading('','事件与项目','在编辑事件中选择归属，也可将事件拖入项目；归属变动会同步更新历史统计。',`<div class="header-actions"><button class="secondary" data-action="new-folder">${icon('folder')} 新建项目</button><button class="secondary" data-action="new-checkin">${icon('check')} 新建打卡</button><button class="primary" data-action="new-project">${icon('plus')} 新建事件</button></div>`)+`<div class="project-toolbar"><div class="segmented"><button data-action="archive-tab" data-value="active" class="${!archived?'selected':''}">进行中 <span>${data.projects.filter(p=>!p.archived).length}</span></button><button data-action="archive-tab" data-value="archived" class="${archived?'selected':''}">已归档 <span>${data.projects.filter(p=>p.archived).length}</span></button></div><span>${data.folders.length} 个项目 · ${events.length} 个事件</span></div><section class="card home-projects event-manager">${eventList(data,events,todayStats(),true,{esc,icon,projectArtwork,shortTime,clockText,onBreak:!!breakState})}</section>`;
}
function rangeLabel(start,end){if(period==='day')return new Date(start).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'});if(period==='month')return new Date(start).toLocaleDateString('zh-CN',{year:'numeric',month:'long'});return `${dateKey(start).replaceAll('-','.')} — ${dateKey(end-1).slice(5).replace('-','.')}`;}
function metric(label,value,unit,i,note){return `<section class="card metric"><div>${label}<span>${icon(i)}</span></div><strong>${value}<small>${unit}</small></strong><p>${note}</p></section>`;}
function statsPage(){
  const sessions=filteredSessions(data,statsFilter),[start,end]=rangeFor(period,anchor),stats=aggregate(sessions,start,end),all=aggregate(sessions,-Infinity,Infinity),days=Math.max(1,Math.ceil((Math.min(end,Date.now())-start)/86400000)),entries=Object.entries(stats.projects).sort((a,b)=>b[1]-a[1]),bs=buckets(sessions,start,end,period==='day');
  const hours=Array.from({length:24},(_,hour)=>({hour,value:0}));
  for(let d=new Date(start);+d<end;d.setDate(d.getDate()+1))for(let h=0;h<24;h++){const a=new Date(d);a.setHours(h,0,0,0);const b=new Date(a);b.setHours(h+1);hours[h].value+=sessions.reduce((n,s)=>n+secondsIn(s,+a,+b),0);}
  return `${heading('','时间统计','按日、周、月查看项目和事件用时。',`<button class="secondary" data-action="export-csv">${icon('download')} 导出记录</button>`)}<div class="stats-toolbar"><div class="segmented">${[['day','日'],['week','周'],['month','月']].map(([id,label])=>`<button data-action="period" data-period="${id}" class="${period===id?'selected':''}">按${label}统计</button>`).join('')}</div><div class="date-nav"><button class="icon-button" data-action="shift-date" data-dir="-1" title="上一个周期">${icon('chevron-left')}</button><label>${rangeLabel(start,end)}<input type="date" id="stats-date" value="${anchor}" aria-label="选择统计日期"></label><button class="icon-button" data-action="shift-date" data-dir="1" title="下一个周期">${icon('chevron-right')}</button><button class="text-button" data-action="today">今天</button></div></div>${filterControls(data,statsFilter,'stats')}<div class="metrics">${metric('专注时长',Math.floor(stats.total/60),'分钟','clock-3','所选周期内的实际计时时长')}${metric('完成专注',stats.completed,'次','circle-check','包含手动添加的记录')}${metric('日均时长',Math.floor(stats.total/60/days),'分钟','chart-no-axes-column-increasing','按所选周期内已过的天数计算')}${metric('累计专注',Math.floor(all.total/3600),'小时','infinity',`${all.completed} 次完成 · 共 ${timeText(all.total)}`)}</div><div class="stats-grid"><section class="card distribution"><div class="card-title"><h2>用时分布</h2><span class="muted">项目 / 事件</span></div>${distribution(data,stats,'period')}</section><section class="card trend-card"><div class="card-title"><h2>专注趋势</h2><span class="muted">单位：分钟</span></div>${lineChart(bs)}<div class="chart-foot">${icon('move-up-right')} ${stats.total?'按实际专注日期统计':'所选周期暂无专注记录'}</div></section><section class="card hours-card"><div class="card-title"><h2>小时分布</h2><span class="muted">所选周期 · 按小时汇总</span></div><div class="bar-chart">${hours.map(x=>`<div class="bar-col"><div class="bar-zone"><div class="bar ${x.value===Math.max(...hours.map(x=>x.value))&&x.value?'peak':''}" style="height:${x.value?Math.max(3,x.value/Math.max(...hours.map(x=>x.value))*100):0}%" title="${x.hour}:00–${x.hour+1}:00 · ${timeText(x.value)}"></div></div><small>${x.hour%3===0?String(x.hour).padStart(2,'0')+':00':''}</small></div>`).join('')}</div><div class="chart-foot">${icon('sun')} ${stats.total?'按专注发生的小时累计':'所选周期暂无专注记录'}<span>休息与暂停时间不计入统计</span></div></section>${checkinStatistics(start,end)}</div>`;
}
function lineChart(bs){const max=Math.max(60,...bs.map(b=>b.value)),w=540,h=165,points=bs.map((b,i)=>[40+i/(bs.length-1||1)*(w-55),20+(1-b.value/max)*(h-25)]),path=smoothPath(points);return `<div class="line-chart"><svg viewBox="0 0 550 220" role="img" aria-label="专注时间趋势图"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8d9ad9" stop-opacity=".26"/><stop offset="100%" stop-color="#8d9ad9" stop-opacity=".01"/></linearGradient></defs>${[0,1,2,3].map(i=>`<line x1="40" y1="${20+i/3*(h-25)}" x2="525" y2="${20+i/3*(h-25)}" stroke="#eef0f4" stroke-dasharray="4 5"/><text x="28" y="${24+i/3*(h-25)}" text-anchor="end">${Math.round(max/60*(1-i/3))}</text>`).join('')}<path d="${path} L ${points.at(-1)[0]} ${h-5} L 40 ${h-5} Z" fill="url(#area)"/><path d="${path}" fill="none" stroke="#8593ce" stroke-width="2.8" stroke-linejoin="round"/>${points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${bs.length>10?2:4}" fill="#8593ce"><title>${period==='day'?new Date(bs[i].date).getHours()+':00':dateKey(bs[i].date)} · ${timeText(bs[i].value)}</title></circle>${i%Math.max(1,Math.ceil(bs.length/7))===0?`<text x="${x}" y="193" text-anchor="middle">${period==='day'?new Date(bs[i].date).getHours()+':00':new Date(bs[i].date).getDate()+'日'}</text>`:''}`).join('')}</svg></div>`;}
function recordsPage(){return recordsView(data,{recordDate,filter:calendarFilter},{esc,icon,heading,timeText,shortTime,hm,eventPath});}
function miniAppearance(){return `<section class="card settings-card"><div class="card-title"><h2>${icon('scan')} 浮窗背景</h2></div><p class="muted">独立于主界面，浮窗内也可点击图片按钮导入。</p><div class="background-actions"><label class="secondary upload-label">${icon('upload')} 上传浮窗背景<input id="mini-background-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="text-button" data-action="reset-mini-background">移除图片</button></div><div class="setting-row"><div><strong>浮窗背景遮罩</strong><p>数值越小，背景越清晰</p></div><input type="range" id="mini-overlay" min="0" max="95" value="${data.settings.miniOverlay??65}" aria-label="浮窗背景遮罩"><output id="mini-overlay-value">${data.settings.miniOverlay??65}%</output></div></section>`;}
function settingsPage(){return `${heading('','偏好设置','调整计时、休息、背景和本地数据。')}<div class="settings-layout"><section class="card settings-card"><div class="card-title"><h2>${icon('timer')} 专注与休息</h2></div>${[['focus','默认专注时长','每次倒计时的初始时长','分钟',1440],['shortBreak','短休息','完成一次专注后的休息时长','分钟',120],['longBreak','长休息','达到设定次数后的休息时长','分钟',180],['cycles','长休息间隔','每完成几次专注，安排一次长休息','次',12],['dailyGoal','每日目标','用于显示每日进度','分钟',1440]].map(([key,label,hint,unit,max])=>`<div class="setting-row"><div><strong>${label}</strong><p>${hint}</p></div><label class="number-setting"><input type="number" data-setting="${key}" min="1" max="${max}" value="${data.settings[key]}" aria-label="${label}"><span>${unit}</span></label></div>`).join('')}<div class="setting-row"><div><strong>完成提示音</strong><p>在专注或休息结束时播放声音</p></div><label class="switch"><input id="sound" type="checkbox" ${data.settings.sound?'checked':''}><span></span></label></div><div class="setting-row"><div><strong>事项性质与统计默认值</strong><p>在事件或项目中设置性质；项目指定后所属事件统一跟随。</p></div><button class="secondary" data-action="manage-natures">管理性质</button></div><p class="settings-footnote">计时期间修改的设置，将在下一次专注生效。</p></section><div><section class="card settings-card"><div class="card-title"><h2>${icon('image')} 空间外观</h2></div><div class="background-preview" ${data.settings.background?`style="background-image:url('${data.settings.background}')"`:''}><div class="preview-window"><span></span><div><i></i><i></i><i></i></div></div><p>${data.settings.background?'自定义背景':'默认背景'}</p></div><div class="background-actions"><label class="secondary upload-label">${icon('upload')} 上传背景<input id="background-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="text-button" data-action="reset-background">恢复默认</button></div><p class="muted">支持 JPG、PNG、WebP，最大 8 MB</p><div class="setting-row"><div><strong>背景遮罩</strong><p>数值越小，背景越清晰</p></div><input id="overlay" type="range" min="0" max="95" value="${data.settings.overlay}" aria-label="背景遮罩透明度"><output id="overlay-value">${data.settings.overlay}%</output><input type="hidden"></div>${appearanceControls()}</section>${miniAppearance()}<section class="card settings-card data-settings"><div class="card-title"><h2>${icon('shield-check')} 本地数据</h2><span class="local-dot">离线可用</span></div><p>事件和专注记录保存在本机。定期导出备份，可在换电脑时恢复。</p><div class="data-actions"><button class="secondary" data-action="backup">${icon('download')} 导出备份</button><label class="secondary upload-label">${icon('folder-open')} 导入备份<input type="file" id="import-file" accept="application/json,.json" hidden></label></div><small class="muted">TimeScreen 1.0</small></section></div></div>`;}

function openModal(title,body,footer,onSubmit){dialog={onSubmit,previous:document.activeElement};$('#modal-root').innerHTML=`<div class="modal-backdrop"><form class="modal" id="dialog-form" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-heading"><h2>${title}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="关闭">${icon('x')}</button></div>${body}<div class="modal-footer"><button type="button" class="secondary" data-action="close-modal">取消</button>${footer}</div></form></div>`;createIcons({icons});setTimeout(()=>$('.modal input:not([type=radio]),.modal textarea,.modal button')?.focus(),50);}
function closeModal(){if(dialog?.saving)return;const prev=dialog?.previous;dialog?.cropController?.abort();dialog=null;$('#modal-root').innerHTML='';prev?.focus();}
function projectModal(id,parentId='',kind='timer',onCreated){let createdId='';const p=project(id);openModal(p?'编辑事件':kind==='checkin'?'新建打卡':'新建事件',`<label class="field">事件名称<input id="project-name" required maxlength="40" placeholder="例如：阅读、产品设计、学习 UE5" value="${esc(p?.name||'')}"></label><label class="field">所属项目<select id="event-parent"><option value="">独立事件（不归入项目）</option>${data.folders.map(f=>`<option value="${f.id}" ${(p?.parentId||parentId)===f.id?'selected':''}>${esc(f.name)}</option>`).join('')}</select></label>${eventNatureFields(p,parentId)}<label class="field">事件描述 <small>可选</small><input id="project-description" maxlength="100" placeholder="输入事件描述" value="${esc(p?.description||'')}"></label><div class="field">事件 Logo<div class="logo-editor"><span id="logo-preview" class="project-icon large" style="--project-color:${p?.color||COLORS[0]}">${projectArtwork(p)}</span><label class="secondary upload-label">${icon('upload')} 导入 Logo<input id="project-logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico" hidden></label><button type="button" class="text-button" data-action="remove-logo">移除 Logo</button></div><small>支持 PNG、JPG、WebP、ICO，最大 4 MB。导入后可框选裁剪，保留透明背景。</small></div><div class="field">默认图标 <small>未设置 Logo 时显示</small><div class="icon-picker">${['folder','book-open','code-2','palette','graduation-cap','dumbbell','headphones','sprout'].map((i,n)=>`<label><input name="icon" type="radio" value="${i}" ${(p?(p.icon||'folder')===i:n===0)?'checked':''}><span>${icon(i)}</span></label>`).join('')}</div></div>`,`<button class="primary" type="submit">${p?'保存修改':'创建事件'} ${icon('arrow-right')}</button>`,()=>{if(dialog.logoBusy)return toast('图片正在处理，请稍候');const name=$('#project-name').value.trim();if(!name)return toast('请输入事件名称');const forced=data.folders.find(f=>f.id===$('#event-parent').value)?.natureId;const natureId=forced||readNatureChoice('event-nature','event-new-nature');if(!natureId)return;const values={name,natureId,kind:p?.kind||kind,description:$('#project-description').value.trim(),color:p?.color||COLORS[0],icon:$('.icon-picker input:checked').value,logo:dialog.logo||'',parentId:$('#event-parent').value||null};if(p)Object.assign(p,values);else{const item={id:uid(),...values,archived:false,createdAt:Date.now()};data.projects.push(item);createdId=item.id;const colors=ensureChartColors(data);item.color=colors['event:'+item.id];data.settings.chartColorSources['event:'+item.id]=item.color;if(!selected)selected=item.id;if(item.parentId){const f=data.folders.find(f=>f.id===item.parentId);if(f)f.collapsed=false;}}persist();closeModal();render();toast(p?'事件已更新':'事件已创建');if(!p&&onCreated)onCreated(createdId);});dialog.logo=p?.logo||'';dialog.ownNature=p?eventNature(data,p):selectedNature;syncEventNature();}
function start(){if(data.active||breakState)return;if(project(selected)&&eventNature(data,selected)!==selectedNature)return toast('请先打开该事件所属的性质分类');if(!selected||!project(selected)||project(selected).archived||project(selected).kind==='checkin'){if(!data.projects.some(p=>!p.archived))projectModal();else toast('先选择一个想要专注的事件');return;}const now=Date.now();data.active={id:uid(),projectId:selected,mode,target:mode==='down'?duration*60:0,startedAt:now,lastSeen:now,segments:[{start:now,end:null}],paused:false,pomodoro:data.settings.pomodoro,shortBreak:data.settings.shortBreak,longBreak:data.settings.longBreak,cycles:data.settings.cycles};persist();render();}
function finish(status='completed',automatic=false){const a=data.active;if(!a)return;const total=elapsed(a);let ended=Date.now();if(automatic&&a.target){const excess=Math.max(0,total-a.target*1000);ended-=excess;}closeSegment(a,ended);data.sessions.push({...a,endedAt:ended,status,note:''});data.active=null;persist();if(status==='completed'&&a.pomodoro){cycle++;data.cycle=cycle;persist();const mins=cycle%a.cycles===0?a.longBreak:a.shortBreak;breakState={end:Date.now()+mins*60000,total:mins*60};}render();toast(status==='completed'?'专注记录已保存':'本次实际专注时间已保存');if(automatic)notify('专注完成','记录已保存。');}
function notify(title,body){window.desktop?.notify(title,body);if(data.settings.sound){try{const ctx=new AudioContext();for(let i=0;i<3;i++){const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=[523,659,784][i];gain.gain.setValueAtTime(0,ctx.currentTime+i*.18);gain.gain.linearRampToValueAtTime(.12,ctx.currentTime+i*.18+.025);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+i*.18+.5);osc.connect(gain);gain.connect(ctx.destination);osc.start(ctx.currentTime+i*.18);osc.stop(ctx.currentTime+i*.18+.5);}setTimeout(()=>ctx.close(),1800);}catch{}}}
function updateClock(){
  const a=data.active;
  if(a&&!a.paused&&a.target&&elapsed(a)>=a.target*1000){finish('completed',true);return;}
  if(breakState&&Date.now()>=breakState.end){breakState=null;notify('休息结束','可以开始下一次专注。');render();toast('休息结束');return;}
  let seconds=0;
  if(a)seconds=a.mode==='down'?a.target-elapsed(a)/1000:elapsed(a)/1000;
  if(breakState)seconds=(breakState.end-Date.now())/1000;
  document.title=a?clockText(seconds)+' · TimeScreen':'TimeScreen';
  if($('#clock'))$('#clock').textContent=clockText(seconds);
  if($('#mini-clock')){const snapshot=currentMini();$('#mini-clock').textContent=clockText(snapshot.seconds);$('#mini-event-total').textContent=shortTime(snapshot.eventToday);$('#mini-project-total').textContent=shortTime(snapshot.projectToday);}
}
async function exportFile(content,name){if(window.desktop)return window.desktop.export(content,name);const url=URL.createObjectURL(new Blob([content],{type:name.endsWith('.csv')?'text/csv;charset=utf-8':'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}
function preciseLocalTime(value){const d=new Date(value);return new Date(value-d.getTimezoneOffset()*60000).toISOString().slice(0,23);}
function editRecordModal(id){
  const record=data.sessions.find(s=>s.id===id);if(!record)return toast('这条记录已不存在');
  const original={start:preciseLocalTime(record.startedAt),end:preciseLocalTime(record.endedAt),duration:String(Number((secondsIn(record)/60).toFixed(8)))};
  openModal('编辑记录',`<label class="field">事件 / 事项<select id="edit-project" required>${data.projects.filter(p=>p.kind!=='checkin').map(p=>`<option value="${p.id}" ${p.id===record.projectId?'selected':''}>${esc(eventPath(p))}${p.archived?'（已归档）':''}</option>`).join('')}</select></label><p class="record-nature-info" id="edit-nature-info">性质：${esc(natureName(data,eventNature(data,record.projectId)))} · 跟随事件</p><div class="record-time-fields"><label class="field">开始时间<input id="edit-start" type="datetime-local" step="0.001" required value="${original.start}"></label><label class="field">结束时间<input id="edit-end" type="datetime-local" step="0.001" required value="${original.end}"></label></div><label class="field">专注时长（分钟）<input id="edit-duration" type="number" min="0.00000001" step="any" required value="${original.duration}"></label><p class="manual-hint">专注时长不包含暂停，不能超过起止时间范围。增加时长超出范围时，会自动延后结束时间；调整起止时间会保留可容纳的专注时长。</p><label class="field">备注<textarea id="edit-record-note" rows="3" maxlength="1000">${esc(record.note)}</textarea></label><p id="edit-record-error" class="form-error" role="alert"></p>`,`<button class="primary" type="submit">保存修改</button>`,()=>{
    try{
      const unchanged=$('#edit-start').value===original.start&&$('#edit-end').value===original.end&&$('#edit-duration').value===original.duration;
      const edited=updateRecord(id,{projectId:$('#edit-project').value,startedAt:unchanged?record.startedAt:+new Date($('#edit-start').value),endedAt:unchanged?record.endedAt:+new Date($('#edit-end').value),durationSeconds:unchanged?secondsIn(record):Number($('#edit-duration').value)*60,note:$('#edit-record-note').value},data);
      const index=data.sessions.findIndex(s=>s.id===id);data.sessions[index]=edited;recordDate=dateKey(edited.startedAt);filterProject='';persist();closeModal();render();toast('记录已修改，统计已更新');
    }catch(err){$('#edit-record-error').textContent=err.message;}
  });
}
function syncRecordFields(field){
  const start=+new Date($('#edit-start').value),end=+new Date($('#edit-end').value),focus=Number($('#edit-duration').value)*60000;
  if(Number.isFinite(start)&&Number.isFinite(end)&&focus>0){
    if(field==='edit-duration'&&focus>end-start&&Number.isFinite(+new Date(start+focus)))$('#edit-end').value=preciseLocalTime(start+focus);
    else if(field!=='edit-duration'&&end>start&&focus>end-start)$('#edit-duration').value=String(Number(((end-start)/60000).toFixed(8)));
  }
  $('#edit-record-error').textContent='';
}
function deleteRecordModal(id){
  const record=data.sessions.find(s=>s.id===id);if(!record)return;
  openModal('删除这条记录？',`<p class="modal-copy">${esc(project(record.projectId)?.name)} · ${esc(new Date(record.startedAt).toLocaleString('zh-CN',{hour12:false}))} · ${timeText(secondsIn(record))}<br>删除后，相关用时和次数会从统计中移除。</p>`,'<button class="primary danger" type="submit">确认删除</button>',()=>{data.sessions=data.sessions.filter(s=>s.id!==id);persist();closeModal();render();toast('记录已删除，统计已更新');});
}
function manualRecordModal(){
  if(!data.projects.some(p=>p.kind!=='checkin')){projectModal(undefined,'','timer',()=>manualRecordModal());return;}
  const end=new Date();end.setSeconds(0,0);
  const start=recordDate===dateKey(Date.now())?new Date(+end-25*60000):new Date(recordDate+'T09:00');
  const chosen=data.projects.find(p=>p.id===selected&&p.kind!=='checkin')?.id||data.projects.find(p=>p.kind!=='checkin').id;
  openModal('手动添加记录',`<label class="field">事件<select id="manual-project" required>${data.projects.filter(p=>p.kind!=='checkin').map(p=>`<option value="${p.id}" ${p.id===chosen?'selected':''}>${esc(eventPath(p))}${p.archived?'（已归档）':''}</option>`).join('')}</select></label><p class="record-nature-info" id="manual-nature-info">性质：${esc(natureName(data,eventNature(data,chosen)))} · 跟随事件</p><label class="field">开始时间<input id="manual-start" type="datetime-local" required value="${localDateTime(start)}" max="${localDateTime(Date.now())}"></label><label class="field">专注时长（分钟）<input id="manual-duration" type="number" min="1" max="1440" step="1" required value="25"></label><p id="manual-end" class="manual-end"></p><label class="field">备注 <small>可选</small><textarea id="manual-note" rows="3" maxlength="1000" placeholder="输入备注"></textarea></label><p class="manual-hint">保存为已完成记录，计入统计；不触发番茄休息。</p><p id="manual-error" class="form-error" role="alert"></p>`,'<button class="primary" type="submit">保存记录</button>',async()=>{
    if(dialog?.saving)return;
    try{
      const record=createManualRecord({projectId:$('#manual-project').value,startedAt:+new Date($('#manual-start').value),durationMinutes:$('#manual-duration').value,note:$('#manual-note').value},data);
      const target=dialog;if(target.saving)return;target.saving=true;$('#dialog-form button[type=submit]').disabled=true;data.sessions.push(record);const saved=await persist();if(!saved){data.sessions=data.sessions.filter(s=>s.id!==record.id);if(dialog===target){target.saving=false;$('#dialog-form button[type=submit]').disabled=false;$('#manual-error').textContent='保存失败，本次记录未添加，请重试。';}return;}recordDate=dateKey(record.startedAt);revealEvent(data,calendarFilter,record.projectId);filterProject='';target.saving=false;if(dialog===target)closeModal();render();toast('手动记录已保存');
    }catch(err){$('#manual-error').textContent=err.message;}
  });
  updateManualEnd();
}
function updateManualEnd(){
  if(!$('#manual-start'))return;
  const start=+new Date($('#manual-start').value),minutes=+$('#manual-duration').value;
  $('#manual-end').textContent=Number.isFinite(start)&&minutes>0&&minutes<=1440?'结束时间：'+new Date(start+minutes*60000).toLocaleString('zh-CN',{hour12:false}):'请填写开始时间和专注时长';
  $('#manual-error').textContent='';
}
function manageNatures(){
  openModal('管理性质',data.natures.map(n=>`<label class="field">${n.id==='main'?'默认性质':'性质名称'}<input data-nature-name="${n.id}" value="${esc(n.name)}" maxlength="30" required></label>`).join('')+'<label class="field">新增性质 <small>可选</small><input id="new-nature-name" maxlength="30" placeholder="例如：休闲、日常"></label><p class="form-error" id="nature-error"></p>','<button class="primary" type="submit">保存性质</button>',()=>{const updated=[...document.querySelectorAll('[data-nature-name]')].map(e=>({id:e.dataset.natureName,name:e.value.trim()}));const name=$('#new-nature-name').value.trim();if(name)updated.push({id:uid(),name});if(updated.some(n=>!n.name)||new Set(updated.map(n=>n.name)).size!==updated.length){$('#nature-error').textContent='性质名称不能为空或重复';return;}data.natures=updated;persist();closeModal();render();toast('性质已保存，历史记录同步显示新名称');});
}
function checkinStatistics(start,end){const checks=filteredCheckins(data,statsFilter,start,end),colors=ensureChartColors(data),totals=new Map();for(const c of checks)totals.set(c.eventId,(totals.get(c.eventId)||0)+1);return `<section class="card checkin-statistics"><div class="card-title"><h2>打卡统计</h2><span class="muted">${checks.length} 次 · ${new Set(checks.map(c=>c.date)).size} 天</span></div><div class="checkin-stat-list">${[...totals].map(([id,count])=>`<div><span class="color-dot" style="--dot:${colors['event:'+id]}"></span><span>${esc(eventPath(project(id)))}</span><strong>${count} 次</strong></div>`).join('')||'<p class="muted">所选范围暂无打卡</p>'}</div></section>`;}
function createCheckinForCalendar(date=recordDate){projectModal(undefined,'','checkin',id=>manualCheckinModal(id,date));}
function manualCheckinModal(preferredId='',date=recordDate){
  const events=data.projects.filter(e=>e.kind==='checkin'&&!e.archived);
  if(!events.length){createCheckinForCalendar(date);return;}
  const chosen=events.find(e=>e.id===preferredId)||events[0];
  openModal('添加打卡',`<label class="field">打卡事件<select id="checkin-event">${events.map(e=>`<option value="${e.id}" ${e.id===chosen.id?'selected':''}>${esc(eventPath(e))}</option>`).join('')}</select></label><button type="button" class="text-button" data-action="create-calendar-checkin">＋ 新建打卡事项</button><label class="field">日期<input type="date" id="checkin-date" value="${date}" max="${dateKey(Date.now())}" required></label><p class="record-nature-info" id="checkin-nature-info">性质：${esc(natureName(data,eventNature(data,chosen.id)))} · 跟随事件</p><p class="manual-hint">保存后自动打开所选日期并显示本条打卡；每天每个事项只能打卡一次。</p><p class="form-error" id="checkin-error" role="alert"></p>`,'<button class="primary" type="submit">保存打卡</button>',async()=>{
    const target=dialog;if(target.saving)return;
    let record;
    try{record=addCheckin(data,{eventId:$('#checkin-event').value,date:$('#checkin-date').value});}catch(e){$('#checkin-error').textContent=e.message;return;}
    target.saving=true;$('#dialog-form button[type=submit]').disabled=true;
    const saved=await persist();
    if(!saved){data.checkins=data.checkins.filter(c=>c.id!==record.id);if(dialog===target){target.saving=false;$('#dialog-form button[type=submit]').disabled=false;$('#checkin-error').textContent='保存失败，本次打卡未添加，请重试。';}return;}
    recordDate=record.date;revealEvent(data,calendarFilter,record.eventId);target.saving=false;if(dialog===target)closeModal();render();toast('打卡已保存并显示在日历中');
  });
}
let checkinSaving=false;
async function saveCheckinChange(change,success){
  if(checkinSaving){render();return;}checkinSaving=true;
  const before=[...data.checkins];try{change();}catch(e){checkinSaving=false;render();toast(e.message,true);return;}
  const saved=await persist();checkinSaving=false;if(!saved){data.checkins=before;render();return;}render();toast(success);
}

const actions={
  'reset-mini-background':()=>{data.settings.miniBackground='';persist();render();},
  'mini-open':async()=>{if(document.fullscreenElement)await document.exitFullscreen();windowState=await window.desktop.setCompact(true);render();},
  'mini-restore':async()=>{windowState=await window.desktop.setCompact(false);render();},
  'mini-pin':async()=>{windowState=await window.desktop.setPinned(!windowState.pinned);render();},
  'mini-start':()=>{const snapshot=currentMini();if(snapshot.eventId){selected=snapshot.eventId;start();}},
  'open-nature':b=>{if(data.natures.some(n=>n.id===b.dataset.id)){selectedNature=b.dataset.id;render();}},
  'show-active':()=>{if(data.active){selectedNature=eventNature(data,data.active.projectId);selected=data.active.projectId;render();}},
  'manage-natures':manageNatures,
  'new-checkin':()=>projectModal(undefined,'','checkin'),
  'manual-checkin':()=>manualCheckinModal(),
  'create-calendar-checkin':()=>createCheckinForCalendar($('#checkin-date')?.value||recordDate),
  'show-all-calendar-records':()=>{calendarFilter.natureIds=data.natures.map(n=>n.id);calendarFilter.targetIds=null;render();},
  'toggle-checkin':b=>{b.disabled=true;const date=dateKey(Date.now()),old=data.checkins.find(c=>c.eventId===b.dataset.id&&c.date===date);return saveCheckinChange(()=>{if(old)data.checkins=data.checkins.filter(c=>c.id!==old.id);else addCheckin(data,{eventId:b.dataset.id,date});},old?'已取消今日打卡':'今日已打卡');},
  'delete-checkin':b=>{b.disabled=true;return saveCheckinChange(()=>{data.checkins=data.checkins.filter(c=>c.id!==b.dataset.id);},'打卡已删除');},
  'save-stats-defaults':()=>{data.settings.statsDefaults={...structuredClone(statsFilter),period,distributionView:data.settings.distributionView};persist();toast('已保存：再次打开时间统计时应用此选择');},
  'all-natures':b=>{(b.dataset.scope==='stats'?statsFilter:calendarFilter).natureIds=data.natures.map(n=>n.id);render();},
  'all-targets':b=>{(b.dataset.scope==='stats'?statsFilter:calendarFilter).targetIds=null;render();},
  'clear-targets':b=>{(b.dataset.scope==='stats'?statsFilter:calendarFilter).targetIds=[];render();},
  'reset-typography':()=>{Object.assign(data.settings,{fontFamily:'system',fontSize:100,fontColor:'#343747',fontWeight:'default'});persist();render();toast('字体设置已恢复默认');},
  'new-folder':()=>folderModal(),
  'edit-folder':b=>folderModal(b.dataset.id),
  'delete-folder':b=>deleteFolderModal(b.dataset.id),
  'toggle-folder':b=>{const f=data.folders.find(f=>f.id===b.dataset.id);if(f){f.collapsed=!f.collapsed;persist();render();}},
  'new-event-in':b=>projectModal(undefined,b.dataset.id),
  'manual-record':manualRecordModal,
  'edit-record':b=>editRecordModal(b.dataset.id),
  'delete-record':b=>deleteRecordModal(b.dataset.id),
  nav:b=>{if(b.dataset.page==='stats'&&page!=='stats')enterStatistics();page=b.dataset.page;render();},'new-project':()=>projectModal(),'edit-project':b=>projectModal(b.dataset.id),
  mode:b=>{if(!data.active&&!breakState){mode=b.dataset.mode;render();}},duration:b=>{duration=+b.dataset.minutes;render();},
  'select-project':b=>{if(!data.active&&!breakState){selected=b.dataset.id;render();}},
  'focus-project':b=>{if(data.active||breakState){toast('先结束当前专注或休息，再切换事件');page='focus';render();return;}selected=b.dataset.id;selectedNature=eventNature(data,selected);page='focus';render();},
  'archive-tab':b=>{archived=b.dataset.value==='archived';render();},
  'archive-project':b=>{const p=project(b.dataset.id);if(data.active?.projectId===p.id)return toast('请先结束这个事件的计时');p.archived=!p.archived;if(selected===p.id&&p.archived)selected=data.projects.find(x=>!x.archived)?.id||'';persist();render();toast(p.archived?'事件已归档，历史统计和记录已保留':'事件已恢复');},
  'row-start':b=>{selected=b.dataset.id;start();},start,pause:()=>{const a=data.active;if(!a)return;if(a.paused){a.segments.push({start:Date.now(),end:null});a.paused=false;}else{closeSegment(a);a.paused=true;}a.lastSeen=Date.now();persist();render();},
  finish:()=>finish(),stop:()=>{if(!data.active)return;const id=data.active.id;openModal('放弃本次计时？','<p class="modal-copy">本次计时将被丢弃，不保存记录，也不计入统计。</p>','<button class="primary danger" type="submit">确认放弃</button>',()=>{if(data.active?.id!==id){closeModal();return toast('本次计时已经结束');}discardActive(data);persist();closeModal();render();toast('已放弃本次计时');});},
  'skip-break':()=>{breakState=null;render();},'close-modal':closeModal,
  fullscreen:()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>toast('当前环境不支持全屏'));},
  period:b=>{period=b.dataset.period;render();},'shift-date':b=>{const d=new Date(anchor),dir=+b.dataset.dir;if(period==='month'){d.setDate(1);d.setMonth(d.getMonth()+dir);}else d.setDate(d.getDate()+dir*(period==='week'?7:1));anchor=dateKey(d);render();},today:()=>{anchor=dateKey(Date.now());render();},
  'record-day':b=>{recordDate=b.dataset.date;render();},'record-today':()=>{recordDate=dateKey(Date.now());render();},'calendar-month':b=>{const d=new Date(recordDate);d.setDate(1);d.setMonth(d.getMonth()+Number(b.dataset.dir));recordDate=dateKey(d);render();},
  'edit-note':b=>{const s=data.sessions.find(s=>s.id===b.dataset.id);openModal('编辑备注',`<label class="field">${esc(project(s.projectId)?.name)} · ${timeText(secondsIn(s))}<textarea id="session-note" maxlength="1000" rows="5" placeholder="输入备注">${esc(s.note)}</textarea></label>`,'<button class="primary" type="submit">保存备注</button>',()=>{s.note=$('#session-note').value.trim();persist();closeModal();render();toast('备注已保存');});},
  'remove-logo':()=>{if(!dialog)return;dialog.logo='';dialog.logoToken=null;dialog.logoBusy=false;$('#dialog-form button[type=submit]').disabled=false;$('#logo-preview').innerHTML=icon($('.icon-picker input:checked').value);createIcons({icons});},
  'reset-background':()=>{data.settings.background='';persist();render();},
  backup:async()=>{if(await exportFile(JSON.stringify({...data,active:null},null,2),`TimeScreen-备份-${dateKey(Date.now())}.json`))toast('备份已导出（不含正在进行的计时）');},
  'export-csv':async()=>{const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';const content='\uFEFF'+[['项目','事件','性质','开始时间','结束时间','专注秒数','模式','状态','备注'],...data.sessions.map(s=>[data.folders.find(f=>f.id===project(s.projectId)?.parentId)?.name||'',project(s.projectId)?.name,natureName(data,eventNature(data,s.projectId)),new Date(s.startedAt).toLocaleString('zh-CN'),new Date(s.endedAt).toLocaleString('zh-CN'),Math.floor(secondsIn(s)),s.source==='manual'?'手动添加':s.mode==='up'?'正向':'倒计时',s.status==='completed'?'已完成':'已保存',s.note])].map(row=>row.map(v=>q(/^[=+@\-\t\r]/.test(String(v))?"'"+v:v)).join(',')).join('\r\n');if(await exportFile(content,`TimeScreen-全部记录-${dateKey(Date.now())}.csv`))toast('全部专注记录已导出');}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b&&!b.disabled){e.preventDefault();actions[b.dataset.action]?.(b);}});
let draggingEvent=null;
document.addEventListener('dragstart',e=>{const row=e.target.closest('[data-event-id]');if(!row)return;draggingEvent=row.dataset.eventId;e.dataTransfer.setData('application/x-timescreen-event',draggingEvent);e.dataTransfer.effectAllowed='move';row.classList.add('dragging');});
document.addEventListener('dragover',e=>{const target=e.target.closest('[data-drop-folder]');if(draggingEvent&&target){e.preventDefault();e.dataTransfer.dropEffect='move';document.querySelectorAll('.drop-active').forEach(n=>n.classList.remove('drop-active'));target.classList.add('drop-active');}});
document.addEventListener('drop',e=>{const target=e.target.closest('[data-drop-folder]');if(!draggingEvent||!target)return;e.preventDefault();const eventId=draggingEvent;draggingEvent=null;assignEvent(eventId,target.dataset.dropFolder);});
document.addEventListener('dragend',()=>{draggingEvent=null;document.querySelectorAll('.dragging,.drop-active').forEach(n=>n.classList.remove('dragging','drop-active'));});
document.addEventListener('submit',e=>{if(e.target.id==='dialog-form'){e.preventDefault();dialog?.onSubmit();}});
document.addEventListener('keydown',e=>{if(!dialog)return;if(e.key==='Escape')closeModal();if(e.key==='Tab'){const fs=[...$('.modal').querySelectorAll('button,input,textarea,select')].filter(x=>!x.disabled&&x.getClientRects().length);const first=fs[0],last=fs.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.id==='event-parent')syncEventNature();
  if(t.id==='event-nature'&&dialog)dialog.ownNature=t.value;
  for(const [id,info] of [['manual-project','manual-nature-info'],['edit-project','edit-nature-info'],['checkin-event','checkin-nature-info']])if(t.id===id&&$('#'+info))$('#'+info).textContent='性质：'+natureName(data,eventNature(data,t.value))+' · 跟随事件';
  if(t.dataset.filterScope){const filter=t.dataset.filterScope==='stats'?statsFilter:calendarFilter,key=t.dataset.filterType==='nature'?'natureIds':'targetIds';const values=new Set(filter[key]||[]);if(t.checked)values.add(t.value);else values.delete(t.value);filter[key]=[...values];render();const panel=document.querySelector('[data-filter-panel="'+t.dataset.filterScope+'"] '+(t.dataset.filterType==='target'?'.target-filter':'.filter-popover:not(.target-filter)'));if(panel)panel.open=true;return;}
  if(t.id==='focus-project')selected=t.value;
  if(t.hasAttribute('data-distribution-select')){data.settings.distributionView=t.value;persist();render();}
  if(t.id==='font-color'){data.settings.fontColor=t.value;applyAppearance();persist();}
  if(t.id==='font-weight'){data.settings.fontWeight=t.value;applyAppearance();persist();}
  if(t.id==='font-family'){data.settings.fontFamily=t.value;applyAppearance();persist();}
  if(['panel-transparency','font-size','panel-blur'].includes(t.id)){applyAppearanceSetting(t);persist();}
  if(t.id==='duration'){duration=Math.max(1,Math.min(1440,+t.value||25));render();}
  if(t.id==='pomodoro'){data.settings.pomodoro=t.checked;persist();}
  if(t.id==='sound'){data.settings.sound=t.checked;persist();}
  if(t.id==='stats-date'&&t.value){anchor=t.value;render();}
  if(t.id==='record-project'){filterProject=t.value;render();}
  if(t.dataset.setting){const n=Math.max(1,Math.min(+t.max,+t.value||1));data.settings[t.dataset.setting]=n;t.value=n;if(t.dataset.setting==='focus'&&!data.active)duration=n;persist();}
  if(t.id==='overlay'){data.settings.overlay=+t.value;persist();}
  if(t.id==='focus-project')render();
  if(t.id==='mini-overlay'){data.settings.miniOverlay=+t.value;persist();if($('#mini-overlay-value'))$('#mini-overlay-value').textContent=t.value+'%';}
  if(t.id==='mini-background-file'&&t.files[0]){t.disabled=true;try{const image=await importImage(t.files[0],'background');const before=data.settings.miniBackground;data.settings.miniBackground=image;if(!await persist()){data.settings.miniBackground=before;return;}render();toast('浮窗背景已设置');}catch(err){toast(err.message,true);}finally{t.disabled=false;t.value='';}}
  if(t.id==='background-file'&&t.files[0]){
    t.disabled=true;
    try{const image=await importImage(t.files[0],'background');data.settings.background=image;data.settings.overlay=Math.min(Number(data.settings.overlay)||35,55);data.settings.backgroundVersion=2;await persist();render();toast('背景已设置');}
    catch(err){toast(err.message,true);}finally{t.disabled=false;t.value='';}
  }
  if(t.id==='project-logo-file'&&t.files[0]&&dialog){
    const target=dialog,token={};target.logoToken=token;target.logoBusy=true;$('#dialog-form button[type=submit]').disabled=true;
    try{target.cropController?.abort();target.cropController=new AbortController();const logo=await cropLogo(t.files[0],target.cropController.signal);if(!logo||dialog!==target||target.logoToken!==token)return;target.logo=logo;$('#logo-preview').innerHTML=projectArtwork({logo,name:$('#project-name').value});}
    catch(err){if(dialog===target&&target.logoToken===token)toast(err.message,true);}
    finally{if(dialog===target&&target.logoToken===token){target.logoBusy=false;$('#dialog-form button[type=submit]').disabled=false;}t.value='';}
  }
  if(t.id==='import-file'&&t.files[0]){if(data.active)return toast('请先完成当前计时，再导入备份');try{if(t.files[0].size>20*1024*1024)throw Error('备份文件过大');const imported=validateData(JSON.parse(await t.files[0].text()));openModal('恢复这份备份？',`<p class="modal-copy">备份包含 ${(imported.folders||[]).length} 个项目、${imported.projects.length} 个事件和 ${imported.sessions.length} 条记录。恢复会替换本机现有数据，建议先导出当前备份。</p>`,'<button class="primary" type="submit">替换并恢复</button>',()=>{data=normalizeGroups({...imported,active:null,settings:{...initialData().settings,...imported.settings}});selected=data.projects.find(p=>!p.archived&&p.kind!=='checkin')?.id||'';selectedNature='main';statsFilter=structuredClone(data.settings.statsDefaults);calendarFilter=structuredClone(data.settings.statsDefaults);duration=data.settings.focus;breakState=null;persist();closeModal();render();toast('数据已恢复');});}catch(err){toast(err.message||'无法读取备份',true);}t.value='';}
});
document.addEventListener('input',e=>{if(e.target.id==='font-color'){data.settings.fontColor=e.target.value;applyAppearance();}if(['panel-transparency','font-size','panel-blur'].includes(e.target.id))applyAppearanceSetting(e.target);if(['manual-start','manual-duration'].includes(e.target.id))updateManualEnd();if(['edit-start','edit-end','edit-duration'].includes(e.target.id))syncRecordFields(e.target.id);if(e.target.id==='overlay'){data.settings.overlay=+e.target.value;applyBackground();}});
setInterval(updateClock,250);
window.desktop?.onSuspend(time=>{if(data.active&&!data.active.paused){closeSegment(data.active,time);data.active.paused=true;data.active.lastSeen=time;window.desktop.saveSync(data);render();toast('电脑进入睡眠，专注已自动暂停');}});
setInterval(()=>{if(data.active&&!data.active.paused){data.active.lastSeen=Date.now();persist();}},5000);
window.addEventListener('beforeunload',()=>{if(data.active)data.active.lastSeen=Date.now();if(window.desktop)window.desktop.saveSync(data);else localStorage.setItem('timescreen-v1',JSON.stringify(data));});
window.desktop?.onWindowMode?.(state=>{windowState=state;render();});
render();
if(recovered){persist();toast('已恢复上次计时并暂停，点击继续即可');}
if(bootError)toast('读取本地数据失败，请从备份恢复',true);

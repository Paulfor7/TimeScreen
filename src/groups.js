import {normalizeActivity,eventNature,synchronizeNatures} from './activity.js';
export const FONT_FAMILIES={system:'Inter, "Segoe UI", "Microsoft YaHei", sans-serif',yahei:'"Microsoft YaHei", sans-serif',deng:'DengXian, "Microsoft YaHei", sans-serif',song:'SimSun, serif',mono:'Consolas, "Microsoft YaHei", monospace'};
export function normalizeGroups(data){
  normalizeActivity(data);
  data.folders??=[];
  for(const event of data.projects)event.parentId??=null;
  data.settings={panelTransparency:13,panelBlur:12,fontFamily:'system',fontSize:100,fontColor:'#343747',fontWeight:'default',distributionView:'all',...data.settings};
  ensureChartColors(data);
  return data;
}
const CHART_PALETTE=['#7b8cde','#e4a16c','#57ad98','#ce799c','#6ba6cf','#b6985d','#9982c6','#75a05b','#cf766a','#5da9b9','#b79bcf','#d7ad4d','#6f84a8','#b46a91','#8bbdaf','#d29157','#8f9a52','#729cce','#bc7960','#6eae76','#ac88aa','#5d8e92','#cf947f','#a3a0cc'];
export function chartColorDistance(a,b){
  const lab=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);const [x,y,z]=[(r*.4124+g*.3576+b*.1805)/.95047,r*.2126+g*.7152+b*.0722,(r*.0193+g*.1192+b*.9505)/1.08883].map(v=>v>.008856?Math.cbrt(v):7.787*v+16/116);return [116*y-16,500*(x-y),200*(y-z)];};
  const x=lab(a),y=lab(b);return Math.hypot(...x.map((v,i)=>v-y[i]));
}
export function ensureChartColors(data){
  if(data.settings.chartPaletteVersion!==2){data.settings.chartColors={};data.settings.chartColorSources={};data.settings.chartPaletteVersion=2;}
  const colors=data.settings.chartColors??={},sources=data.settings.chartColorSources??={};
  const entries=[...data.projects.map(e=>({key:'event:'+e.id,color:e.color})),...(data.folders||[]).map(f=>({key:'project:'+f.id,color:f.color}))];
  const valid=new Set(entries.map(e=>e.key)),used=new Set();
  for(const key of Object.keys(colors))if(!valid.has(key)){delete colors[key];delete sources[key];}
  for(const e of entries){const c=colors[e.key];if(typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c)&&sources[e.key]===e.color&&!used.has(c.toLowerCase()))used.add(c.toLowerCase());else delete colors[e.key];}
  for(const e of entries){
    if(colors[e.key])continue;
    const distance=c=>used.size?Math.min(...[...used].map(other=>chartColorDistance(c,other))):Infinity;
    let color=[e.color,...CHART_PALETTE].find(c=>!used.has(c.toLowerCase())&&distance(c)>=18);
    if(!color){let best=-1;for(let i=1;i<=720;i++){const hue=(i*137.508)%360,s=.52,l=[.4,.54,.68][i%3];const rgb=[0,8,4].map(n=>{const k=(n+hue/30)%12;return Math.round(255*(l-s*Math.min(l,1-l)*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');});const candidate='#'+rgb.join(''),score=distance(candidate);if(!used.has(candidate)&&score>best){color=candidate;best=score;}}}
    colors[e.key]=color;sources[e.key]=e.color;used.add(color.toLowerCase());
  }
  return colors;
}
export function validateGroups(data){
  const folders=data.folders??[],ids=new Set();
  if(!Array.isArray(folders))throw Error('项目分组数据无效');
  for(const f of folders){
    if(!f||typeof f.id!=='string'||!/^[a-z\d_-]{1,80}$/i.test(f.id)||ids.has(f.id)||typeof f.name!=='string'||!f.name.trim()||f.name.length>40||!/^#[a-f\d]{6}$/i.test(f.color))throw Error('项目分组数据无效');
    ids.add(f.id);
  }
  for(const event of data.projects)if(event.parentId!=null&&!ids.has(event.parentId))throw Error('事件所属项目不存在');
  for(const [key,min,max] of [['panelTransparency',0,100],['panelBlur',0,40],['fontSize',80,130]])if(data.settings[key]!==undefined&&(!Number.isFinite(data.settings[key])||data.settings[key]<min||data.settings[key]>max))throw Error('外观设置无效');
  if(data.settings.fontFamily!==undefined&&!Object.hasOwn(FONT_FAMILIES,data.settings.fontFamily))throw Error('字体设置无效');
  if(data.settings.fontColor!==undefined&&(typeof data.settings.fontColor!=='string'||!/^#[a-f\d]{6}$/i.test(data.settings.fontColor)))throw Error('文字颜色无效');
  if(data.settings.fontWeight!==undefined&&!['default','400','500','600'].includes(data.settings.fontWeight))throw Error('文字字重无效');
  if(data.settings.distributionView!==undefined&&!['all','events','projects'].includes(data.settings.distributionView))throw Error('统计视图无效');
  for(const key of ['chartColors','chartColorSources'])if(data.settings[key]!==undefined){const value=data.settings[key];if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([id,color])=>!/^(event|project):[a-z\d_-]{1,80}$/i.test(id)||typeof color!=='string'||!/^#[a-f\d]{6}$/i.test(color)))throw Error('图表颜色设置无效');}
}
export function moveEvent(data,eventId,folderId){
  const event=data.projects.find(e=>e.id===eventId);
  if(!event)throw Error('事件不存在');
  if(folderId&&!data.folders.some(f=>f.id===folderId))throw Error('项目不存在');
  event.natureId=eventNature(data,event);
  event.parentId=folderId||null;
  synchronizeNatures(data);
}
export function removeFolder(data,id){synchronizeNatures(data);for(const event of data.projects)if(event.parentId===id)event.parentId=null;data.folders=data.folders.filter(f=>f.id!==id);}
export function distributionGroups(data,totals,view='all'){
  const colors=ensureChartColors(data);
  const events=data.projects.filter(e=>(totals[e.id]||0)>0).map(e=>({id:e.id,name:e.name,color:colors['event:'+e.id],archived:e.archived,kind:'event',value:totals[e.id],parentId:e.parentId,children:[]}));
  if(view==='events')return events.sort((a,b)=>b.value-a.value);
  const parents=new Map(data.folders.map(f=>[f.id,{id:f.id,name:f.name,color:colors['project:'+f.id],kind:'project',value:0,children:[]}])) , standalone=[];
  for(const event of events){const parent=parents.get(event.parentId);if(parent){parent.value+=event.value;parent.children.push(event);}else standalone.push(event);}
  const result=[...parents.values()].filter(p=>p.value>0).concat(standalone).sort((a,b)=>(a.kind==='project'?0:1)-(b.kind==='project'?0:1)||b.value-a.value);
  for(const group of result)group.children.sort((a,b)=>b.value-a.value);
  return result;
}

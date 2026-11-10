import {distributionGroups} from './groups.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label=seconds=>seconds<60?`${Math.floor(seconds)} 秒`:`${Math.floor(seconds/60)} 分钟`;
export function sectorPath(start,end,inner,outer){
  const point=(r,t)=>[110+r*Math.cos(t*2*Math.PI-Math.PI/2),110+r*Math.sin(t*2*Math.PI-Math.PI/2)].map(n=>Number(n.toFixed(5))).join(' ');
  if(end-start>=.999999){const mid=start+.5;return `M ${point(outer,start)} A ${outer} ${outer} 0 1 1 ${point(outer,mid)} A ${outer} ${outer} 0 1 1 ${point(outer,end)} L ${point(inner,end)} A ${inner} ${inner} 0 1 0 ${point(inner,mid)} A ${inner} ${inner} 0 1 0 ${point(inner,start)} Z`;}
  const large=end-start>.5?1:0;
  return `M ${point(outer,start)} A ${outer} ${outer} 0 ${large} 1 ${point(outer,end)} L ${point(inner,end)} A ${inner} ${inner} 0 ${large} 0 ${point(inner,start)} Z`;
}
export function distribution(data,stats,scope){
  const view=data.settings.distributionView,groups=distributionGroups(data,stats.projects,view),total=stats.total;
  let offset=0,arcs='';
  const wedge=(g,start,end,inner,outer,parent='')=>`<path class="distribution-sector ${parent?'child-sector':g.kind==='project'?'project-sector':'event-sector'}" data-sector-id="${g.id}" data-sector-kind="${g.kind}" ${parent?`data-parent-id="${parent}"`:''} data-start="${start}" data-end="${end}" data-inner="${inner}" data-outer="${outer}" d="${sectorPath(start,end,inner,outer)}" fill="${g.color}" stroke="#fff" stroke-width="${parent?'.65':'1.4'}"><title>${g.kind==='project'?'项目':'事件'}：${esc(g.name)} · ${label(g.value)} · ${(g.value/total*100).toFixed(1)}%</title></path>`;
  for(const g of groups){
    const pct=g.value/total;
    arcs+=wedge(g,offset,offset+pct,44,102);
    if(view==='all'&&g.kind==='project'){
      let childOffset=offset;
      for(const c of g.children){const cpct=c.value/total,pad=Math.min(.002,cpct*.1);arcs+=wedge(c,childOffset+pad,childOffset+cpct-pad,51,87,g.id);childOffset+=cpct;}
    }
    offset+=pct;
  }
  const item=(g,child=false)=>`<div class="legend-item ${child?'legend-child':''}" data-group-id="${g.id}" data-group-kind="${g.kind}"><span class="color-dot" style="--dot:${g.color}"></span><div><strong>${esc(g.name)}${g.archived?'<small> 已归档</small>':''}</strong><small>${g.kind==='project'?'项目 · ':''}${label(g.value)}</small></div><b>${(g.value/total*100).toFixed(1)}<small>%</small></b></div>`;
  const parents=groups.filter(g=>g.kind==='project'),standalone=groups.filter(g=>g.kind==='event');
  const legend=view==='events'?standalone.map(g=>item(g)).join(''):parents.map(g=>`<div class="legend-project">${item(g)}${view==='all'?`<div class="legend-project-children">${g.children.map(c=>item(c,true)).join('')}</div>`:''}</div>`).join('')+standalone.map(g=>item(g)).join('');
  return `<div class="distribution-view"><select class="distribution-select" aria-label="${scope==='today'?'当日':'周期'}统计层级" data-distribution-select>${[['all','事件＋项目'],['events','纯事件'],['projects','纯项目']].map(([id,name])=>`<option value="${id}" ${view===id?'selected':''}>${name}</option>`).join('')}</select></div><div class="distribution-body ${scope==='today'?'today-distribution':''}"><div class="donut hierarchy-donut" data-distribution-view="${view}"><svg viewBox="0 0 220 220" role="img" aria-label="${view==='all'?'项目大扇区包含所属事件子扇区':'用时分布'}"><circle cx="110" cy="110" r="73" fill="none" stroke="#e9edf4" stroke-width="58"/>${arcs}</svg><div><strong>${Math.floor(total/60)}</strong><small>分钟</small></div></div><div class="legend hierarchy-legend">${legend||'<p class="muted">所选时间暂无专注记录</p>'}</div></div>${view==='all'?'<p class="distribution-note">项目色块包围所属事件，独立事件单独显示。<br>百分比均为总用时占比，项目和事件颜色独立。</p>':''}`;
}

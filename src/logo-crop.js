import {decodeImage} from './images.js';

// Selection coordinates stay in source pixels; only the preview is scaled.
export async function cropLogo(file,signal){
  const img=await decodeImage(file,'logo');
  if(signal?.aborted)return null;
  return new Promise(resolve=>{
    const previous=document.activeElement,overlay=document.createElement('div');
    overlay.className='logo-crop-overlay';
    overlay.innerHTML=`<section class="logo-crop-dialog" role="dialog" aria-modal="true" aria-label="裁剪 Logo"><h2>裁剪 Logo</h2><p>拖动图片框选，拖动选框移动，拖动右下角调整大小。</p><div class="logo-crop-stage"><canvas class="logo-crop-canvas" aria-label="Logo 图片裁剪区域"></canvas><div class="logo-crop-selection" tabindex="0" role="group" aria-label="裁剪选框，方向键移动，Shift 加方向键调整大小"><span class="logo-crop-handle"></span></div></div><div class="logo-crop-footer"><button type="button" class="secondary" data-crop="reset">重置选框</button><button type="button" class="secondary" data-crop="cancel">取消裁剪</button><button type="button" class="primary" data-crop="confirm">使用裁剪结果</button></div></section>`;
    document.body.append(overlay);
    const stage=overlay.querySelector('.logo-crop-stage'),canvas=overlay.querySelector('canvas'),box=overlay.querySelector('.logo-crop-selection');
    const scale=Math.min(1,460/img.naturalWidth,Math.max(160,Math.min(420,innerHeight-300))/img.naturalHeight),w=img.naturalWidth,h=img.naturalHeight;
    canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);stage.style.width=canvas.width+'px';stage.style.height=canvas.height+'px';
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    let size=Math.min(w,h),x=(w-size)/2,y=(h-size)/2,drag=null,done=false;
    const paint=()=>{box.style.left=x/w*100+'%';box.style.top=y/h*100+'%';box.style.width=size/w*100+'%';box.style.height=size/h*100+'%';};
    const reset=()=>{size=Math.min(w,h);x=(w-size)/2;y=(h-size)/2;paint();};
    const point=e=>{const r=stage.getBoundingClientRect();return {x:Math.max(0,Math.min(w,(e.clientX-r.left)/r.width*w)),y:Math.max(0,Math.min(h,(e.clientY-r.top)/r.height*h))};};
    const finish=value=>{if(done)return;done=true;document.removeEventListener('keydown',keys,true);signal?.removeEventListener('abort',cancel);overlay.remove();previous?.focus();resolve(value);};
    const cancel=()=>finish(null);
    const keys=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
      if(e.key==='Tab'){const controls=[...overlay.querySelectorAll('button,[tabindex]')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}e.stopImmediatePropagation();return;}
      if(document.activeElement!==box||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();e.stopImmediatePropagation();const step=Math.max(1,Math.min(w,h)/100);
      if(e.shiftKey){size=Math.max(1,Math.min(w-x,h-y,size+(['ArrowRight','ArrowDown'].includes(e.key)?step:-step)));}
      else{x=Math.max(0,Math.min(w-size,x+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0)));y=Math.max(0,Math.min(h-size,y+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)));}paint();
    };
    document.addEventListener('keydown',keys,true);signal?.addEventListener('abort',cancel,{once:true});
    stage.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const p=point(e),mode=e.target.closest('.logo-crop-handle')?'resize':e.target.closest('.logo-crop-selection')?'move':'draw';drag={mode,p,x,y,size};stage.setPointerCapture(e.pointerId);box.focus();};
    stage.onpointermove=e=>{if(!drag)return;const p=point(e),dx=p.x-drag.p.x,dy=p.y-drag.p.y;
      if(drag.mode==='move'){x=Math.max(0,Math.min(w-size,drag.x+dx));y=Math.max(0,Math.min(h-size,drag.y+dy));}
      else if(drag.mode==='resize'){size=Math.max(1,Math.min(w-x,h-y,drag.size+Math.max(dx,dy)));}
      else{size=Math.max(1,Math.min(Math.max(Math.abs(dx),Math.abs(dy)),dx<0?drag.p.x:w-drag.p.x,dy<0?drag.p.y:h-drag.p.y));x=dx<0?drag.p.x-size:drag.p.x;y=dy<0?drag.p.y-size:drag.p.y;}paint();};
    stage.onpointerup=stage.onpointercancel=()=>{drag=null;};
    overlay.querySelector('[data-crop="cancel"]').onclick=cancel;
    overlay.querySelector('[data-crop="reset"]').onclick=reset;
    overlay.querySelector('[data-crop="confirm"]').onclick=()=>{const output=document.createElement('canvas');output.width=output.height=256;output.getContext('2d').drawImage(img,x,y,size,size,0,0,256,256);finish(output.toDataURL('image/png'));};
    paint();box.focus();
  });
}

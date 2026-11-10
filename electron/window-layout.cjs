const MINI_SIZE = {width: 350, height: 258};
function compactBounds(saved, areas) {
  const screens=areas.length?areas:[{x:0,y:0,width:1280,height:720}];
  const valid=saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y);
  const area=valid?screens.find(a=>saved.x>=a.x&&saved.x<a.x+a.width&&saved.y>=a.y&&saved.y<a.y+a.height)||screens[0]:screens[0];
  const width=Math.min(MINI_SIZE.width,area.width),height=Math.min(MINI_SIZE.height,area.height);
  return {x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,valid?saved.x:area.x+area.width-width-24))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,valid?saved.y:area.y+40))),width,height};
}
module.exports={MINI_SIZE,compactBounds};

// Standard Gamepad mapping; only active while the visible game owns input.
export function gamepadActions(pad){
  if(!pad?.connected||pad.mapping!=='standard')return new Set();
  const pressed=index=>Boolean(pad.buttons[index]?.pressed),x=pad.axes[0]||0,y=pad.axes[1]||0;
  const result=new Set();
  if(pressed(14)||x<-.5)result.add('left');else if(pressed(15)||x>.5)result.add('right');
  if(pressed(13)||y>.5)result.add('soft');
  if(pressed(0))result.add('cw');if(pressed(2))result.add('ccw');if(pressed(3))result.add('hard');
  if(pressed(4)||pressed(5))result.add('hold');if(pressed(9))result.add('pause');
  return result;
}
export function createGamepadController({enabled,press,release,pause,onConnect=()=>{}}){
  let held=new Set(),lastIndex=null,armed=false;
  return {poll(){
    const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
    if(pad&&pad.index!==lastIndex){lastIndex=pad.index;onConnect();}if(!pad)lastIndex=null;
    const next=gamepadActions(pad);
    if(!enabled()||document.hidden){for(const action of held)release(action);held.clear();armed=next.size===0;return;}
    if(!armed){if(next.size===0)armed=true;return;}
    for(const action of held)if(!next.has(action))release(action);
    for(const action of next)if(!held.has(action)){if(action==='pause')pause();else press(action);}
    held=next;
  },clear(){for(const action of held)release(action);held.clear();armed=false;}};
}

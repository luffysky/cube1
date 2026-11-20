// Original four-lane rhythm challenge. Audio uses procedurally generated tones.
export const LANES=4, BPM=120, BEAT=60/BPM, SONG_SECONDS=32;
export const NOTES=Object.freeze(Array.from({length:48},(_,i)=>({
  at:2+i*BEAT, lane:(i*3+(Math.floor(i/4)%4))%LANES
})));
export function judge(offsetSeconds){
  const difference=Math.abs(offsetSeconds);
  if(difference<=.075)return {grade:'perfect',points:300};
  if(difference<=.15)return {grade:'good',points:150};
  return {grade:'miss',points:0};
}
export function makeState(){
 return {active:false,elapsed:0,index:0,score:0,combo:0,bestCombo:0,judgement:'',hits:[],over:false,calibrationMs:0};
}
export function start(state){
 Object.assign(state,makeState(),{active:true});return state;
}
export function tap(state,lane,time){
 if(!state.active||lane<0||lane>=LANES||!Number.isInteger(lane))return false;
 const adjust=time+(state.calibrationMs/1000);
 const next=NOTES.findIndex((note,i)=>!state.hits.includes(i)&&note.lane===lane&&Math.abs(note.at-adjust)<=.15);
 if(next===-1){state.combo=0;state.judgement='MISS';return false;}
 const result=judge(NOTES[next].at-adjust);
 state.hits.push(next);state.score+=result.points+Math.min(state.combo,50)*5;
 state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);
 state.judgement=result.grade.toUpperCase();return true;
}
export function advance(state,dt){
 if(!state.active)return state;
 state.elapsed=Math.min(SONG_SECONDS,state.elapsed+Math.max(0,Math.min(dt,.1)));
 const missed=NOTES.filter((n,i)=>n.at<state.elapsed-.15&&!state.hits.includes(i));
 if(missed.length>state.index){state.index=missed.length;state.combo=0;state.judgement='MISS';}
 if(state.elapsed>=SONG_SECONDS){state.active=false;state.over=true;}
 return state;
}

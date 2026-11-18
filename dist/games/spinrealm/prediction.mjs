import { Game } from './engine.mjs';

// Prediction can consume the five published next pieces, never invent another bag.
// The server retains all RNG state and is the only source of scores and outcomes.
export function predictionFromSnapshot(data){
  const game=new Game({seed:1,gravity:700,lockDelay:500});
  for(const key of ['board','active','queue','held','canHold','status','stats'])game[key]=structuredClone(data[key]);
  game.events=[];game._history=[];game._gravityTimer=0;game._lockTimer=0;
  game._fillQueue=()=>{};
  const spawn=game._spawn.bind(game);
  game._spawn=(type=null)=>{
    if(!type&&!game.queue.length){game.active=null;game.status='waiting';return;}
    spawn(type);
  };
  game._turnStart=game._snapshot();
  return game;
}

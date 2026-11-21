import { CONFIG } from '../../dist/games/spinrealm/config.mjs';

// Product catalog labels describe published channels, independently of live service health.
export const gameCatalog = [
  { id:'spinrealm', name:'旋界 SPINREALM', status:'playable', source:'cube1', team:'旋界開發', version:CONFIG.build, channel:'Games Web', href:'/games/spinrealm/' },
  { id:'brickduel', name:'轉磚 BRICKDUEL', status:'playable', source:'cube2', team:'轉磚開發', channel:'BRICKDUEL Web', href:'https://brickduel.snowrealm.pet/' },
  { id:'52hunt', name:'52 HUNT 命運追獵', status:'development', source:'cube1', channel:'概念介紹', href:'/games/52hunt/' },
  { id:'next-floor', name:'NEXT FLOOR 下一層', status:'development', source:'cube1', channel:'概念介紹', href:'/games/next-floor/' },
  ...[
    ['zero-dodge','零界閃避'], ['refract-maze','折光迷陣'], ['beat-overdrive','節奏超載'],
    ['orbit-escape','環域逃脫'], ['gravity-reversal','重力逆轉'], ['territory-conquest','領域爭奪'],
  ].map(([id,name])=>({id,name,status:'playable',source:'cube1',channel:'Games Web Arcade',href:'/games/'+id+'/'})),
];

const KEY='spinrealm.local-results.v1';
export function localResults(){try{const rows=JSON.parse(globalThis.localStorage?.getItem(KEY)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&Number.isFinite(x.score)).slice(0,100):[];}catch{return [];}}
export function saveLocalResult(result){
  if(!['duel','party','practice','drill'].includes(result.mode))return;
  const entry={...result,recordedAt:new Date().toISOString(),verified:false};
  try{globalThis.localStorage?.setItem(KEY,JSON.stringify([entry,...localResults()].slice(0,100)));}catch{}
  return entry;
}
export const bestLocalScore=mode=>Math.max(0,...localResults().filter(x=>x.mode===mode).map(x=>x.score));

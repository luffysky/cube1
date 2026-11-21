import {exactKeys,fail,hash,validateUuid} from './domain.mjs';
import {ledger,lockUser,transaction} from './store.mjs';

export const ownerOperations=new Set(['suspension','coins','match-correction']);

function optionalText(value,max){
 if(value===undefined||value===null)return null;
 if(typeof value!=='string'||[...value].length>max||/\x00/.test(value))fail('invalid_text');
 return value.trim()||null;
}

export class GamesOwnerStore {
 constructor(pool){this.pool=pool;}
 async suspendStatus(userId){
  const {rows}=await this.pool.query('SELECT reason,suspended_at FROM sr_games_suspensions WHERE user_id=$1',[userId]);
  const row=rows[0];
  return {suspended:Boolean(row),reason:row?.reason??null,suspendedAt:row?.suspended_at??null};
 }
 async playerNotices(userId){
  const {rows}=await this.pool.query(`
   SELECT a.operation,a.public_reason,a.result,a.created_at
   FROM sr_games_owner_actions a
   WHERE (a.operation IN ('coins','suspension') AND a.target_id=$1)
      OR (a.operation='match-correction' AND EXISTS (
        SELECT 1 FROM sr_ranked_matches m WHERE m.id::text=a.target_id AND $1 IN (m.player_one,m.player_two)))
   ORDER BY a.created_at DESC LIMIT 25`,[userId]);
  return {items:rows.map(row=>({operation:row.operation,reason:row.public_reason,
   createdAt:row.created_at,change:row.result}))};
 }
 async audit(includeNotes){
  const {rows}=await this.pool.query(`
   SELECT owner_subject,operation,target_id,public_reason,internal_note,result,created_at
   FROM sr_games_owner_actions ORDER BY created_at DESC,owner_subject,request_key LIMIT 50`);
  return {items:rows.map(row=>({actorId:row.owner_subject,operation:row.operation,targetId:row.target_id,reason:row.public_reason,
   ...(includeNotes?{note:row.internal_note}:{}),result:row.result,createdAt:row.created_at}))};
 }
 async apply(owner,key,operation,data,protectedOwner=owner){
  const field={suspension:'suspended',coins:'delta','match-correction':'outcome'}[operation];
  if(!field)fail('route_not_found',404);
  exactKeys(data,['targetId',field,'reason','note'],['targetId',field]);
  const target=data.targetId;
  const value=data[field];
  if(operation==='match-correction')validateUuid(target);
  else if(typeof target!=='string'||!target.length||target.length>128)fail('invalid_player');
  if(operation==='suspension'&&(typeof value!=='boolean'||target===protectedOwner))fail('invalid_suspension');
  if(operation==='coins'&&(!Number.isSafeInteger(value)||value===0||Math.abs(value)>2147483647))fail('invalid_coins');
  if(operation==='match-correction'&&!['player-one','player-two','draw','void'].includes(value))fail('invalid_outcome');
  const reason=optionalText(data.reason,500),note=optionalText(data.note,1000);
  const fingerprint=hash([operation,target,value,reason,note]);
  return transaction(this.pool,async client=>{
   const inserted=await client.query(`INSERT INTO sr_games_owner_actions
    (owner_subject,request_key,operation,target_id,payload_hash,public_reason,internal_note)
    VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING request_key`,
    [owner,key,operation,target,fingerprint,reason,note]);
   if(!inserted.rowCount){
    const {rows}=await client.query('SELECT payload_hash,result FROM sr_games_owner_actions WHERE owner_subject=$1 AND request_key=$2',[owner,key]);
    if(rows[0]?.payload_hash!==fingerprint)fail('idempotency_conflict',409);
    return rows[0].result;
   }
   let result;
   if(operation==='coins'){
    await lockUser(client,target);
    const wallet=await ledger(client,target,value,'owner_adjustment','owner:'+hash([owner,key]),{publicReason:reason});
    result={targetId:target,delta:value,balance:wallet.balance};
   }else if(operation==='suspension'){
    await lockUser(client,target);
    if(value){
     await client.query(`INSERT INTO sr_games_suspensions(user_id,reason) VALUES($1,$2)
       ON CONFLICT(user_id) DO UPDATE SET reason=EXCLUDED.reason,suspended_at=now()`,[target,reason]);
     await client.query('DELETE FROM sr_ranked_queue WHERE user_id=$1',[target]);
    }else await client.query('DELETE FROM sr_games_suspensions WHERE user_id=$1',[target]);
    result={targetId:target,suspended:value};
   }else{
    const {rows}=await client.query('SELECT status FROM sr_ranked_matches WHERE id=$1 FOR UPDATE',[target]);
    if(!rows[0])fail('match_not_found',404);
    if(rows[0].status!=='ended')fail('match_still_running',409);
    await client.query(`INSERT INTO sr_ranked_match_corrections(match_id,outcome,public_reason) VALUES($1,$2,$3)
      ON CONFLICT(match_id) DO UPDATE SET outcome=EXCLUDED.outcome,public_reason=EXCLUDED.public_reason,updated_at=now()`,[target,value,reason]);
    result={matchId:target,outcome:value};
   }
   await client.query('UPDATE sr_games_owner_actions SET result=$3 WHERE owner_subject=$1 AND request_key=$2',[owner,key,result]);
   return result;
  });
 }
}

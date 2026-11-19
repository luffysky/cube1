// Central SnowRealm Games administration, read-only v1.
// Every request must first pass existing EdDSA JWT verification and a server-side
// explicit allowlist. The UI cannot add admins and this module never reads cookies.
import { fail } from './domain.mjs';

const MAX_LIST=50;
export function adminAllowlist(raw=''){
  return new Set(String(raw).split(',').map(x=>x.trim()).filter(x=>/^[A-Za-z0-9_-]{8,128}$/.test(x)));
}
export function assertAdmin(userId,allowlist){
  if(typeof userId!=='string'||!allowlist?.has(userId))fail('forbidden',403);
}
export class AdminStore {
  constructor(pool){this.pool=pool;}
  async overview(){
    // Aggregated counters only. Don't disclose authentication emails/IPs.
    const [profiles,wallets,matches,queue,settlements]=await Promise.all([
      this.pool.query('SELECT count(*)::integer AS n FROM sr_profiles'),
      this.pool.query('SELECT count(*)::integer AS n,coalesce(sum(balance),0)::bigint AS balance FROM sr_wallets'),
      this.pool.query("SELECT count(*)::integer AS total,count(*) FILTER (WHERE status='running')::integer AS running FROM sr_ranked_matches"),
      this.pool.query('SELECT count(*)::integer AS n FROM sr_ranked_queue'),
      this.pool.query('SELECT count(*)::integer AS n FROM sr_rank_settlements')
    ]);
    return {service:'snowrealm-games',scope:'cube1',readOnly:true,
      players:profiles.rows[0]?.n||0,
      wallets:wallets.rows[0]?.n||0,
      outstandingCoins:String(wallets.rows[0]?.balance||'0'),
      rankedMatches:matches.rows[0]?.total||0,
      runningMatches:matches.rows[0]?.running||0,
      queuedPlayers:queue.rows[0]?.n||0,
      settlements:settlements.rows[0]?.n||0,
      fetchedAt:new Date().toISOString()
    };
  }
  async players(limit=25){
    const n=Math.min(MAX_LIST,Math.max(1,Number(limit)||25));
    const rows=(await this.pool.query(`SELECT p.user_id,p.nickname,p.friend_code,p.created_at,
      coalesce(w.balance,0) AS coins,coalesce(r.rating,1000) AS rating,
      coalesce(r.games,0) AS games
      FROM sr_profiles p
      LEFT JOIN sr_wallets w ON w.user_id=p.user_id
      LEFT JOIN sr_ratings r ON r.user_id=p.user_id
      ORDER BY p.created_at DESC,p.user_id DESC LIMIT $1`,[n])).rows;
    return {scope:'cube1',items:rows.map(x=>({
      playerId:x.user_id,nickname:x.nickname,friendCode:x.friend_code,
      createdAt:x.created_at,coins:x.coins,rating:x.rating,games:x.games
    })),limit:n};
  }
  async ledger(limit=25){
    const n=Math.min(MAX_LIST,Math.max(1,Number(limit)||25));
    const rows=(await this.pool.query(`SELECT l.id,l.user_id,l.delta,l.balance_after,l.reason,l.created_at
      FROM sr_wallet_ledger l ORDER BY l.created_at DESC,l.id DESC LIMIT $1`,[n])).rows;
    return {scope:'cube1',items:rows.map(x=>({
      eventId:x.id,playerId:x.user_id,delta:x.delta,balanceAfter:x.balance_after,
      reason:x.reason,createdAt:x.created_at
    })),limit:n};
  }
  async matches(limit=25){
    const n=Math.min(MAX_LIST,Math.max(1,Number(limit)||25));
    const rows=(await this.pool.query(`SELECT m.id,m.player_one,m.player_two,m.status,
      m.started_at,m.settled_at FROM sr_ranked_matches m
      ORDER BY m.created_at DESC,m.id DESC LIMIT $1`,[n])).rows;
    return {scope:'cube1',items:rows.map(x=>({
      matchId:x.id,players:[x.player_one,x.player_two],status:x.status,
      startedAt:x.started_at,settledAt:x.settled_at
    })),limit:n};
  }
}
export async function adminRead(path,method,adminStore){
  if(method!=='GET')fail('method_not_allowed',405);
  if(path==='/v1/admin/overview')return adminStore.overview();
  if(path==='/v1/admin/players')return adminStore.players();
  if(path==='/v1/admin/ledger')return adminStore.ledger();
  if(path==='/v1/admin/matches')return adminStore.matches();
  // Games from Claude must have their own scoped service-to-service integration.
  // No untrusted browser can submit third-party game metrics here.
  fail('route_not_found',404);
}

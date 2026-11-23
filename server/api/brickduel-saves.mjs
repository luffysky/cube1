import { exactKeys, fail, hash, isUuid, object } from './domain.mjs';
import { transaction } from './store.mjs';

const integers = ['coins','rp','peak','rgames','streak','xp'];
const strings = ['name','season','title'];
const maps = ['owned','equip','sub','custom','sign','pvp','daily','mini','box','wheel','slot','lv','tot','first','rpg'];
const lists = ['titles','items','bring'];
const stateFields = ['v','steam','note',...integers,...strings,...maps,...lists];
const forbidden = /^(?:__proto__|constructor|prototype|srv|secret|token|authorization|email|password|cookie|deviceKey|transferCode|ip|fileContent)$/i;
const positive = value => Number.isSafeInteger(value) && value > 0;
const unsigned = value => Number.isSafeInteger(value) && value >= 0;

function canonical(value, depth = 0) {
  if (depth > 12) fail('invalid_save_state');
  if (Array.isArray(value)) {
    if (value.length > 2048) fail('invalid_save_state');
    return value.map(item => canonical(item, depth + 1));
  }
  if (object(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length > 128 || keys.some(key => forbidden.test(key) || key.length > 64)) fail('invalid_save_state');
    return Object.fromEntries(keys.map(key => [key, canonical(value[key], depth + 1)]));
  }
  if (typeof value === 'string' && value.length > 4096 ||
      typeof value === 'number' && !Number.isFinite(value)) fail('invalid_save_state');
  return value;
}

export function parseBrickduelSnapshot(platformId, payload) {
  const base = ['schema','platformId','gameUserId','generation','ver','at','event'];
  const full = payload?.event === 'upsert' ? [...base,'publicTag','state'] : base;
  exactKeys(payload, full, full);
  if (payload.schema !== 'brickduel.save.v1' || !isUuid(platformId) || payload.platformId !== platformId ||
      !isUuid(payload.gameUserId) || !positive(payload.generation) || !positive(payload.ver) ||
      !['upsert','hide','purge'].includes(payload.event) || typeof payload.at !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(payload.at) ||
      !Number.isFinite(Date.parse(payload.at))) fail('invalid_snapshot');
  if (payload.event === 'upsert') {
    const {state} = payload;
    if (typeof payload.publicTag !== 'string' || !/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/.test(payload.publicTag)) fail('invalid_snapshot');
    exactKeys(state, stateFields, stateFields);
    if (state.v !== 1 || typeof state.steam !== 'boolean' ||
        integers.some(key => !unsigned(state[key])) || strings.some(key => typeof state[key] !== 'string') ||
        maps.some(key => !object(state[key])) || lists.some(key => !Array.isArray(state[key])) ||
        state.note !== null && !object(state.note)) fail('invalid_save_state');
  }
  return canonical(payload);
}

export class BrickduelSaveStore {
  constructor(pool) { this.pool = pool; }
  async put(snapshot) {
    const {platformId, gameUserId, generation, ver, event, publicTag, state, at} = snapshot;
    const fingerprint = hash(snapshot);
    return transaction(this.pool, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['brickduel:' + platformId]);
      const {rows: identities} = await client.query('SELECT 1 FROM public.sr_platform_identities WHERE platform_player_id=$1', [platformId]);
      if (!identities.length) fail('identity_not_found', 404);
      const {rows: [current]} = await client.query('SELECT * FROM public.sr_brickduel_save_snapshots WHERE platform_id=$1', [platformId]);
      if (current) {
        if (generation < Number(current.generation)) return 'stale';
        if (generation === Number(current.generation)) {
          if (gameUserId !== current.game_user_id) fail('binding_conflict', 409);
          if (ver < Number(current.version)) return 'stale';
          if (ver === Number(current.version)) {
            if (fingerprint !== current.fingerprint) fail('version_conflict', 409);
            return 'duplicate';
          }
          if (current.event === 'purge') fail('binding_terminated', 409);
        } else if (current.event !== 'purge' || event !== 'upsert' || gameUserId === current.game_user_id) {
          fail('binding_conflict', 409);
        }
      }
      await client.query(`INSERT INTO public.sr_brickduel_save_snapshots
        (platform_id,generation,game_user_id,version,event,public_tag,state,source_at,fingerprint)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        ON CONFLICT (platform_id) DO UPDATE SET generation=EXCLUDED.generation,
          game_user_id=EXCLUDED.game_user_id,version=EXCLUDED.version,event=EXCLUDED.event,
          public_tag=EXCLUDED.public_tag,state=EXCLUDED.state,source_at=EXCLUDED.source_at,
          fingerprint=EXCLUDED.fingerprint,synced_at=now()`,
      [platformId,generation,gameUserId,ver,event,publicTag ?? null,state ? JSON.stringify(state) : null,event === 'upsert' ? at : null,fingerprint]);
      return 'applied';
    });
  }
  async getForPlayer(subject) {
    const {rows:[row]} = await this.pool.query(`SELECT s.public_tag,s.version,s.source_at,s.synced_at,s.state
      FROM public.sr_brickduel_save_snapshots s JOIN public.sr_platform_identities p
        ON p.platform_player_id=s.platform_id
      WHERE p.neon_subject=$1 AND s.event='upsert'`, [subject]);
    return row ? {publicTag:row.public_tag,ver:Number(row.version),at:row.source_at,syncedAt:row.synced_at,state:row.state} : null;
  }
}

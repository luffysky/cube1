import { randomUUID } from 'node:crypto';
import { fail } from './domain.mjs';

// Maps a verified Neon Auth subject onto a permanent, independent SnowRealm UUID.
// No email-based matching, no player data copied across games.
export class PlatformIdentityStore {
  constructor(pool){ this.pool=pool; }
  static validateSubject(subject){
    if(typeof subject!=='string'||subject.length<8||subject.length>128||/[\x00-\x1f]/.test(subject))fail('invalid_identity_subject',400);
  }
  async find(subject){
    PlatformIdentityStore.validateSubject(subject);
    const {rows}=await this.pool.query('SELECT platform_player_id FROM sr_platform_identities WHERE neon_subject=$1',[subject]);
    return rows[0]?.platform_player_id||null;
  }
  async ensure(subject){
    PlatformIdentityStore.validateSubject(subject);
    const uuid=randomUUID();
    // ON CONFLICT DO NOTHING ensures concurrent sign-ins return the SAME UUID.
    // We never replace an existing platform UUID or alter the source subject.
    await this.pool.query('INSERT INTO sr_platform_identities(neon_subject,platform_player_id) VALUES($1,$2) ON CONFLICT (neon_subject) DO NOTHING',[subject,uuid]);
    const identity=await this.find(subject);
    if(!identity)throw new Error('platform_identity_unavailable');
    return identity;
  }
}

/** Persistent server-side authorization code + revocation state.
 * Requires migration 004; no DELETE, DROP or modification of game wallets. */
export class OAuthStore {
 constructor(pool){this.pool=pool;}
 async saveCode(rec){
  const sql='INSERT INTO sr_identity_authorization_codes (code_hash,client_id,redirect_uri,code_challenge,player_id,state_hash,nonce_hash,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)';
  await this.pool.query(sql,[rec.codeHash,rec.clientId,rec.redirectUri,rec.codeChallenge,
   rec.playerId,rec.stateHash,rec.nonceHash,rec.expiresAt]);
 }
 async consumeCode({codeHash,clientId,redirectUri,codeChallenge}){
  // This UPDATE is atomic: the first exchange wins; replay returns no rows.
  const sql='UPDATE sr_identity_authorization_codes SET consumed_at=now() WHERE code_hash=$1 AND client_id=$2 AND redirect_uri=$3 AND code_challenge=$4 AND consumed_at IS NULL AND expires_at>now() RETURNING player_id';
  const {rows}=await this.pool.query(sql,[codeHash,clientId,redirectUri,codeChallenge]);
  return rows[0]?.player_id||null;
 }
 async isActive(playerId){
  const sql='SELECT EXISTS (SELECT 1 FROM sr_platform_identities WHERE platform_player_id=$1) AS identity_exists, COALESCE((SELECT suspended FROM sr_identity_account_status WHERE player_id=$1),false) AS suspended';
  const {rows}=await this.pool.query(sql,[playerId]);
  return rows[0]?.identity_exists===true&&rows[0]?.suspended===false;
 }
 async isTokenActive({playerId,jti,kid,issuedAt}){
  const sql='SELECT EXISTS (SELECT 1 FROM sr_platform_identities WHERE platform_player_id=$1) AS identity_exists, COALESCE((SELECT suspended FROM sr_identity_account_status WHERE player_id=$1),false) AS suspended, (SELECT revoked_after FROM sr_identity_account_status WHERE player_id=$1) AS revoked_after, EXISTS (SELECT 1 FROM sr_identity_revoked_jti WHERE jti=$2) AS jti_revoked, EXISTS (SELECT 1 FROM sr_identity_revoked_kids WHERE kid=$3) AS kid_revoked';
  const {rows}=await this.pool.query(sql,[playerId,jti,kid]);const r=rows[0];
  return Boolean(r?.identity_exists===true&&r?.suspended===false&&
   r?.jti_revoked===false&&r?.kid_revoked===false&&Number.isSafeInteger(issuedAt)&&
   (!r?.revoked_after||issuedAt*1000>new Date(r.revoked_after).getTime()));
 }
}

import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {createRemoteJWKSet,jwtVerify} from 'jose';
import {createIdentityAuthority,verifyBrickduelLinkToken} from '../authority.mjs';
import {createOAuthCore} from '../oauth-core.mjs';
import {OAuthStore} from '../oauth-store.mjs';
import {PlatformIdentityStore} from '../../server/api/platform-identity.mjs';
import {createTrustedIdentityApp} from './trusted-app.mjs';

const issuer='https://identity.snowrealm.pet';
const neonBase=process.env.NEON_AUTH_BASE_URL;
const neonJwks=process.env.NEON_AUTH_JWKS_URL;
const keyPem=process.env.IDENTITY_ED25519_PRIVATE_PEM;
const kid=process.env.IDENTITY_ACTIVE_KID;
const clientSecret=process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET;
const callback='https://brickduel.snowrealm.pet/api/auth/callback';
let app;

async function initialize(){
  // Safe failure, do not start any signing/authorization route without real
  // configured private key, trusted Neon issuer and confidential client.
  if(!neonBase||!neonJwks||!keyPem||!kid||!clientSecret||clientSecret.length<32||
     !process.env.IDENTITY_DATABASE_URL)throw Error('identity_environment_incomplete');
  const pool=new pg.Pool({connectionString:process.env.IDENTITY_DATABASE_URL,
    max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  attachDatabasePool(pool);
  pool.on('error',()=>{ /* Never log credentials. pg removes dead idle clients. */ });
  const authority=createIdentityAuthority({privateKeyPem:keyPem,kid});
  const authJwks=createRemoteJWKSet(new URL(neonJwks),{timeoutDuration:5000,cooldownDuration:30000});
  const authenticate=async req=>{
    const authorization=req.headers.get('authorization');
    if(!authorization||!/^Bearer [^\s]+$/.test(authorization)||authorization.length>16384)return null;
    try{
      const {payload}=await jwtVerify(authorization.slice(7),authJwks,{
        issuer:new URL(neonBase).origin,algorithms:['EdDSA'],
        requiredClaims:['sub','exp','iat']});
      return typeof payload.sub==='string'&&payload.sub.length<=128?payload.sub:null;
    }catch{return null;}
  };
  const store=new OAuthStore(pool);
  const oauth=createOAuthCore({store,identityMapping:new PlatformIdentityStore(pool),
    signer:authority,clients:[{clientId:'brickduel-bff',redirectUri:callback}]});
  const verifyToken=token=>verifyBrickduelLinkToken(token,{
    jwks:authority.publicJwks(),
    checkStatus:async info=>store.isTokenActive(info)
  });
  const dbReady=async()=>{
    try {
      const result=await pool.query("SELECT to_regclass('public.sr_identity_authorization_codes') IS NOT NULL AS ready");
      return result.rows[0]?.ready===true;
    }catch{return false;}
  };
  return createTrustedIdentityApp({authority,authenticate,oauth,verifyToken,dbReady,clientSecret});
}

export default {
  async fetch(req){
    try{
      app??=await initialize();
      return app.fetch(req);
    }catch{
      return new Response(JSON.stringify({error:'identity_unavailable'}),{
        status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }
  }
};

import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {createIdentityAuthority,verifyBrickduelLinkToken} from '../authority.mjs';
import {OAuthStore} from '../oauth-store.mjs';
import {createTrustedIdentityApp} from './trusted-app.mjs';
import {identityDatabaseReady} from './database-readiness.mjs';

const keyPem=process.env.IDENTITY_ED25519_PRIVATE_PEM;
const kid=process.env.IDENTITY_ACTIVE_KID;
let app;

async function initialize(){
  if(!keyPem||!kid||!process.env.IDENTITY_DATABASE_URL)
    throw Error('identity_environment_incomplete');
  const pool=new pg.Pool({connectionString:process.env.IDENTITY_DATABASE_URL,
    max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  attachDatabasePool(pool);
  pool.on('error',()=>{ /* Never log credentials. pg removes dead idle clients. */ });
  const authority=createIdentityAuthority({privateKeyPem:keyPem,kid});
  const store=new OAuthStore(pool);
  const verifyToken=token=>verifyBrickduelLinkToken(token,{
    jwks:authority.publicJwks(),
    checkStatus:async info=>store.isTokenActive(info)
  });
  const dbReady=()=>identityDatabaseReady(pool,store,kid);
  return createTrustedIdentityApp({authority,verifyToken,dbReady});
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

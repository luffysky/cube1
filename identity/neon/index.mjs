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
  const databaseUrl=new URL(process.env.IDENTITY_DATABASE_URL);
  const allowedHosts=new Set([
    'ep-crimson-truth-b3j5tyvk.c-4.ap-southeast-1.aws.neon.tech',
    'ep-crimson-truth-b3j5tyvk-pooler.c-4.ap-southeast-1.aws.neon.tech'
  ]);
  if(databaseUrl.protocol!=='postgresql:'||!allowedHosts.has(databaseUrl.hostname)||
     databaseUrl.username!=='sr_identity_service'||databaseUrl.pathname!=='/cube1'||
     !databaseUrl.password||(databaseUrl.port&&databaseUrl.port!=='5432'))
    throw Error('identity_database_target_invalid');
  // Build pg's options explicitly so URL query options cannot override TLS.
  const pool=new pg.Pool({host:databaseUrl.hostname,port:5432,database:'cube1',
    user:'sr_identity_service',password:decodeURIComponent(databaseUrl.password),
    ssl:{rejectUnauthorized:true},enableChannelBinding:true,
    max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  attachDatabasePool(pool);
  pool.on('error',()=>{ /* Never log credentials. pg removes dead idle clients. */ });
  const authority=createIdentityAuthority({privateKeyPem:keyPem,kid});
  const store=new OAuthStore(pool);
  const verifyToken=token=>verifyBrickduelLinkToken(token,{
    jwks:authority.publicJwks(),
    checkStatus:async info=>store.isTokenActive(info)
  });
  const dbReady=()=>identityDatabaseReady(pool,store,kid,'sr_identity_service');
  return createTrustedIdentityApp({authority,verifyToken,dbReady,clientSecret:process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET});
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

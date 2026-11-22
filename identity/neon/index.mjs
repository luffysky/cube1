import pg from 'pg';
import {attachDatabasePool} from '@neon/functions';
import {createIdentityAuthority,verifyBrickduelLinkToken} from '../authority.mjs';
import {createAdminAuthority} from '../admin-authority.mjs';
import {stagingIdentityConfig} from '../staging-config.mjs';
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
  const mode=process.env.IDENTITY_ENVIRONMENT || 'production';
  if(!['production','staging'].includes(mode))throw Error('identity_environment_invalid');
  const staging=mode==='staging'?stagingIdentityConfig(process.env.IDENTITY_STAGING_ISSUER):null;
  const stagingHost=process.env.IDENTITY_STAGING_DATABASE_HOST;
  if(staging&&(!/^ep-[a-z0-9-]+\.c-[0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$/.test(stagingHost??'') ||
      allowedHosts.has(stagingHost)||stagingHost.split('.')[0].replace(/-pooler$/,'')==='ep-crimson-truth-b3j5tyvk'))
    throw Error('identity_staging_database_invalid');
  const database=staging?'cube1_identity_staging':'cube1';
  if(databaseUrl.protocol!=='postgresql:'||!(staging?databaseUrl.hostname===stagingHost:allowedHosts.has(databaseUrl.hostname))||
     databaseUrl.username!=='sr_identity_service'||databaseUrl.pathname!=='/'+database||
     !databaseUrl.password||(databaseUrl.port&&databaseUrl.port!=='5432'))
    throw Error('identity_database_target_invalid');
  // Build pg's options explicitly so URL query options cannot override TLS.
  const pool=new pg.Pool({host:databaseUrl.hostname,port:5432,database,
    user:'sr_identity_service',password:decodeURIComponent(databaseUrl.password),
    ssl:{rejectUnauthorized:true},enableChannelBinding:true,
    max:5,connectionTimeoutMillis:5000,idleTimeoutMillis:10000});
  attachDatabasePool(pool);
  pool.on('error',()=>{ /* Never log credentials. pg removes dead idle clients. */ });
  const authority=createIdentityAuthority({privateKeyPem:keyPem,kid,issuer:staging?.issuer});
  const store=new OAuthStore(pool);
  const verifyToken=token=>verifyBrickduelLinkToken(token,{
    issuer:staging?.issuer,
    jwks:authority.publicJwks(),
    checkStatus:async info=>store.isTokenActive(info)
  });
  const dbReady=()=>identityDatabaseReady(pool,store,kid,'sr_identity_service');
  const adminPublicKeys=JSON.parse(process.env.IDENTITY_ADMIN_PUBLIC_JWKS || '{"keys":[]}').keys;
  if(!Array.isArray(adminPublicKeys))throw Error('identity_admin_jwks_invalid');
  const adminAuthority=staging&&process.env.IDENTITY_STAGING_ADMIN_PRIVATE_PEM
    ? createAdminAuthority({privateKeyPem:process.env.IDENTITY_STAGING_ADMIN_PRIVATE_PEM,
      kid:process.env.IDENTITY_STAGING_ADMIN_KID,issuer:staging.issuer,canIssue:async adminKid=>
        await dbReady() && await store.canIssue(adminKid)})
    : null;
  return createTrustedIdentityApp({authority,verifyToken,dbReady,issuer:staging?.issuer,
    adminPublicKeys:[...(adminAuthority?.publicJwks().keys??[]),...adminPublicKeys],
    issueAdminToken:adminAuthority?.issueAdminToken,
    adminServiceSecret:staging?process.env.IDENTITY_STAGING_ADMIN_SERVICE_SECRET:undefined,
    clientSecret:process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET});
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

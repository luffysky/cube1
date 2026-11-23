import pg from 'pg';
import {createPrivateKey} from 'node:crypto';
import {attachDatabasePool} from '@neon/functions';
import {createIdentityAuthority,verifyBrickduelLinkToken} from '../authority.mjs';
import {createAdminAuthority} from '../admin-authority.mjs';
import {stagingIdentityConfig} from '../staging-config.mjs';
import {ISSUER} from '../authority.mjs';
import {jwtAuthenticator} from '../../server/api/auth.mjs';
import {createProductionAuthorization} from './production-authorization.mjs';
import {createOAuthCore} from '../oauth-core.mjs';
import {BRICKDUEL_CLIENT,BRICKDUEL_CALLBACK} from '../../dist/sso-flow.mjs';
import {PlatformIdentityStore} from '../../server/api/platform-identity.mjs';
import {OAuthStore} from '../oauth-store.mjs';
import {createTrustedIdentityApp} from './trusted-app.mjs';
import {identityDatabaseTarget} from './database-target.mjs';
import {createStagingLogin} from './staging-login.mjs';
import {createBrowserAuthorization} from './browser-authorization.mjs';
import {identityDatabaseReady} from './database-readiness.mjs';

const kid=process.env.IDENTITY_ACTIVE_KID;
let app;

async function initialize(){
  const existingKey=process.env.IDENTITY_ED25519_PKCS8_BASE64;
  const keyPem=process.env.IDENTITY_ED25519_PRIVATE_PEM || (existingKey
    ? createPrivateKey({key:Buffer.from(existingKey,'base64'),format:'der',type:'pkcs8'})
      .export({format:'pem',type:'pkcs8'}) : undefined);
  if(!keyPem||!kid||!process.env.IDENTITY_DATABASE_URL)
    throw Error('identity_environment_incomplete');
  const mode=process.env.IDENTITY_ENVIRONMENT || 'production';
  if(!['production','staging'].includes(mode))throw Error('identity_environment_invalid');
  const staging=mode==='staging'?stagingIdentityConfig(process.env.IDENTITY_STAGING_ISSUER):null;
  if(staging&&staging.issuer!=='https://identity-staging.snowrealm.pet')throw Error('identity_staging_issuer_invalid');
  const pool=new pg.Pool(identityDatabaseTarget(process.env.IDENTITY_DATABASE_URL,{
    staging:Boolean(staging),stagingHost:process.env.IDENTITY_STAGING_DATABASE_HOST
  }));
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
  const clients=staging?.clients??[{clientId:BRICKDUEL_CLIENT,redirectUri:BRICKDUEL_CALLBACK}];
  const oauth=createOAuthCore({
    store,signer:authority,identityMapping:new PlatformIdentityStore(pool),
    issuer:staging?.issuer,clients
  });
  const productionAuthorization=!staging &&
    process.env.IDENTITY_PRODUCTION_OAUTH_EXCHANGE_ENABLED==='true' &&
    process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET?.length>=32 &&
    process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_JWKS_URL && process.env.AUTH_AUDIENCE
    ? createProductionAuthorization({issuer:ISSUER,clients,authorize:oauth.authorize,
        authenticate:jwtAuthenticator({authBaseUrl:process.env.NEON_AUTH_BASE_URL,
          jwksUrl:process.env.NEON_AUTH_JWKS_URL,audience:process.env.AUTH_AUDIENCE}),
        secret:process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET})
    : undefined;
  const browserAuthorization=staging&&process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET?.length>=32
    ? createBrowserAuthorization({issuer:staging.issuer,clients:staging.clients,authorize:oauth.authorize,
        secret:process.env.IDENTITY_BRICKDUEL_CLIENT_SECRET,
        ...createStagingLogin({issuer:staging.issuer,
          base:'https://ep-green-pond-bici1klg.neonauth.c-5.ap-southeast-1.aws.neon.tech/cube1_identity_staging/auth',
          accounts:["947d7f1f-370e-43d6-b156-20ac43b0324d","f3cd7632-fa4d-4d8e-958d-7e32bfa5d9ac"]})})
    : productionAuthorization;
  return createTrustedIdentityApp({authority,verifyToken,dbReady,issuer:staging?.issuer,
    adminPublicKeys:[...(adminAuthority?.publicJwks().keys??[]),...adminPublicKeys],
    exchangeCode:staging||productionAuthorization
      ? oauth.exchange : undefined,
    browserAuthorization,
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

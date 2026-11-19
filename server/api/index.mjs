import pg from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { createApp } from './app.mjs';
import { jwtAuthenticator } from './auth.mjs';
import { Store } from './store.mjs';
import { AdminStore } from './admin.mjs';

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
// Direct connection is preferred for transaction-bound row/advisory locks.
const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
attachDatabasePool(pool);
pool.on('error', error => console.error('snowrealm_pool_error', { code: error.code || 'connection_error' }));

export default createApp({
  store: new Store(pool),
  adminStore: new AdminStore(pool),
  adminSubjects: process.env.SNOWREALM_ADMIN_SUBJECTS || '',
  rewardedAdSecret: process.env.REWARDED_AD_ADAPTER_SECRET || '',
  rewardedAdUnit: process.env.REWARDED_AD_UNIT || '',
  rewardedAdsReady: process.env.REWARDED_AD_PROVIDER_ENABLED === 'true',
  authenticate: jwtAuthenticator({ jwksUrl: process.env.NEON_AUTH_JWKS_URL, authBaseUrl: process.env.NEON_AUTH_BASE_URL, audience: process.env.AUTH_AUDIENCE || undefined }),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
  entitlementWebhookSecret: process.env.ENTITLEMENT_WEBHOOK_SECRET || '',
  expectedDatabase: process.env.EXPECTED_DATABASE || 'cube1',
});

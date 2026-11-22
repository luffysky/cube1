const productionHost = 'ep-crimson-truth-b3j5tyvk.c-4.ap-southeast-1.aws.neon.tech';
const productionEndpoint = productionHost.split('.')[0];
const neonHost = /^ep-[a-z0-9-]+\.c-[0-9]+\.[a-z0-9-]+\.aws\.neon\.tech$/;

export function identityDatabaseTarget(connectionString, { staging = false, stagingHost } = {}) {
  const url = new URL(connectionString);
  const database = staging ? 'cube1_identity_staging' : 'cube1';
  const directHost = url.hostname.replace(/-pooler\./, '.');
  const endpoint = directHost.split('.')[0];
  const validHost = staging
    ? neonHost.test(stagingHost ?? '') && url.hostname === stagingHost && endpoint !== productionEndpoint
    : directHost === productionHost;
  if (url.protocol !== 'postgresql:' || !validHost || url.username !== 'sr_identity_service' ||
      url.pathname !== '/' + database || !url.password || (url.port && url.port !== '5432')) {
    throw new Error('identity_database_target_invalid');
  }
  return {
    host: url.hostname, port: 5432, database, user: 'sr_identity_service',
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: true }, enableChannelBinding: true,
    max: 5, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000,
  };
}

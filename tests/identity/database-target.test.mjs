import assert from 'node:assert/strict';
import test from 'node:test';
import { identityDatabaseTarget } from '../../identity/neon/database-target.mjs';

const stagingHost = 'ep-staging-example.c-4.ap-southeast-1.aws.neon.tech';
const productionHost = 'ep-crimson-truth-b3j5tyvk.c-4.ap-southeast-1.aws.neon.tech';
const uri = (host, db = 'cube1_identity_staging', role = 'sr_identity_service') =>
  'postgresql://' + role + ':fixture@' + host + '/' + db + '?sslmode=disable';

test('staging database target pins the host, database, login, and TLS', () => {
  const settings = { staging:true, stagingHost };
  const options = identityDatabaseTarget(uri(stagingHost), settings);
  assert.equal(options.database, 'cube1_identity_staging');
  assert.deepEqual(options.ssl, { rejectUnauthorized:true });
  for (const url of [uri(stagingHost,'cube1'), uri(stagingHost,undefined,'cube1_owner'), uri(productionHost)]) {
    assert.throws(() => identityDatabaseTarget(url, settings), /identity_database_target_invalid/);
  }
  for (const host of [productionHost, productionHost.replace('.', '-pooler.')]) {
    assert.throws(() => identityDatabaseTarget(uri(host), { staging:true, stagingHost:host }), /identity_database_target_invalid/);
  }
  assert.equal(identityDatabaseTarget(uri(productionHost,'cube1')).host, productionHost);
  assert.throws(() => identityDatabaseTarget(uri(stagingHost,'cube1')), /identity_database_target_invalid/);
});

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../../server/api/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');

// Real Postgres/WASM schema/transaction tests. PGlite exposes one backend, so this
// adapter serializes connections; live multi-backend advisory locks need staging QA.
export async function testPool({ownerOperations=false,platformIdentity=false}={}) {
  const db = new PGlite();
  await db.exec(await readFile(new URL('../../server/migrations/001_accounts_ranked.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../server/migrations/002_rewarded_ads.sql', import.meta.url), 'utf8'));
  if(platformIdentity)await db.exec(await readFile(new URL('../../server/migrations/003_platform_identity.sql',import.meta.url),'utf8'));
  if(ownerOperations)await db.exec(await readFile(new URL('../../server/migrations/005_games_owner_operations.sql',import.meta.url),'utf8'));
  let pending = Promise.resolve();
  const pool = {
    async connect() {
      const prior = pending; let release;
      pending = new Promise(resolve => { release = resolve; });
      await prior;
      return { async query(sql, params) { const result = await db.query(sql, params); return { rows: result.rows, rowCount: result.rowCount ?? (result.command === 'SELECT' ? result.rows.length : result.affectedRows) }; }, release };
    },
    async query(sql, params) { const client = await this.connect(); try { return await client.query(sql, params); } finally { client.release(); } },
    async end() { await pending; await db.close(); },
  };
  return pool;
}

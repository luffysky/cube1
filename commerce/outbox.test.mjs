import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {enqueueCommerceEvent,dispatchCommerceEvent,requeueDeadCommerceEvent} from './outbox.mjs';
const require=createRequire(new URL('../server/api/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');

test('transaction rollback, retry, dead letter and replay preserve the same event',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('./outbox.sql',import.meta.url),'utf8'));
  const pool={async query(...args){const r=await db.query(...args);return {...r,rowCount:r.affectedRows};}};
  const event={eventId:'b44f6de4-3fe5-4fc9-94ca-1b96c4fffe0d',version:1};
  await db.exec('BEGIN');
  assert.equal(await enqueueCommerceEvent(pool,event),'queued');
  await db.exec('ROLLBACK');
  assert.equal(await dispatchCommerceEvent(pool,{}),'idle');
  assert.equal(await enqueueCommerceEvent(pool,event),'queued');
  assert.equal(await enqueueCommerceEvent(pool,event),'duplicate');
  await assert.rejects(enqueueCommerceEvent(pool,{...event,version:2}),/commerce_event_conflict/);
  const send=status=>({deliver:async value=>{assert.deepEqual(value,event);return {status};}});
  assert.equal(await dispatchCommerceEvent(pool,send('retry')),'ready');
  assert.equal(await dispatchCommerceEvent(pool,{}),'idle');
  await db.exec("UPDATE sr_commerce_outbox SET due_at=now(),attempts=11");
  assert.equal(await dispatchCommerceEvent(pool,send('retry')),'dead');
  assert.equal(await requeueDeadCommerceEvent(pool,event.eventId),true);
  assert.equal(await dispatchCommerceEvent(pool,send('delivered')),'delivered');
 } finally {await db.close();}
});

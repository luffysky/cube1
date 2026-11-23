import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { testPool } from './pglite-helper.mjs';
import { fail } from '../../server/api/domain.mjs';
import { BrickduelSaveStore,parseBrickduelSnapshot } from '../../server/api/brickduel-saves.mjs';
import { createBrickduelSync } from '../../server/api/brickduel-sync.mjs';

const platformId = '7fe63343-c39c-482c-9257-23ac7acc6d34';
const gameUserId = '3315fdee-104b-40db-a7e4-cd04d51078a4';
const state = {
  v:1,coins:200,name:'Player',rp:0,peak:0,season:'',rgames:0,streak:0,xp:0,titles:[],title:'',
  owned:{},steam:false,equip:{},items:[],bring:[],sub:{},custom:{},sign:{},pvp:{},daily:{},mini:{},
  box:{},wheel:{},slot:{},lv:{},tot:{},first:{},rpg:{best:0},note:null,
};
const envelope = {schema:'brickduel.save.v1',platformId,gameUserId,generation:1,ver:1,at:'2026-11-23T15:00:00Z'};
const initial = {...envelope,event:'upsert',publicTag:'brxcks23',state};

test('snapshots are owner-scoped, ordered, idempotent, and protected from resurrection', async t => {
  const migrations = await Promise.all(['003_platform_identity','005_brickduel_save_snapshots'].map(migration =>
    readFile(new URL('../../server/migrations/' + migration + '.sql', import.meta.url),'utf8')));
  const pool = await testPool({setup:['CREATE ROLE sr_identity_runtime', ...migrations]});
  t.after(() => pool.end());
  await pool.query('INSERT INTO sr_platform_identities(neon_subject,platform_player_id) VALUES($1,$2)', ['verified-player',platformId]);
  const store = new BrickduelSaveStore(pool);
  const put = data => store.put(parseBrickduelSnapshot(platformId,data));
  assert.equal(await put(initial),'applied');
  assert.equal(await put({...initial,state:Object.fromEntries(Object.entries(state).reverse())}),'duplicate');
  await assert.rejects(put({...initial,state:{...state,coins:201}}),{status:409});
  assert.equal((await store.getForPlayer('verified-player')).state.coins,200);
  assert.equal(await store.getForPlayer('different-player'),null);
  assert.equal(await put({...envelope,event:'hide',ver:2}),'applied');
  assert.equal(await store.getForPlayer('verified-player'),null);
  assert.equal(await put(initial),'stale');
  assert.equal(await put({...initial,ver:3}),'applied');
  assert.equal(await put({...envelope,event:'purge',ver:4}),'applied');
  assert.equal(await store.getForPlayer('verified-player'),null);
  await assert.rejects(put({...initial,ver:5}),{status:409});
  assert.equal(await put({...initial,generation:2,gameUserId:'51694691-cf52-4e8e-8502-ea82c00634fa'}),'applied');
  assert.equal(await put({...initial,ver:500}),'stale');
});

test('ingress verifies the service before accepting a bounded snapshot', async () => {
  const handler = createBrickduelSync({
    verify: request => {
      if (request.headers.get('authorization') !== 'Bearer fixture') {
        fail('invalid_service_token',401);
      }
    },
    store:{put: async ()=>'applied'},
  });
  const request = (data,headers = {}) => new Request('https://example.test/',{
    method:'PUT',headers:{'content-type':'application/json',authorization:'Bearer fixture',...headers},body:JSON.stringify(data),
  });
  assert.equal((await handler(request(initial),platformId)).status,200);
  assert.equal((await handler(request(initial,{authorization:'Bearer invalid'}),platformId)).status,401);
  assert.equal((await handler(request(initial,{origin:'https://example.test'}),platformId)).status,403);
  assert.equal((await handler(request({...initial,state:{...state,owned:{deviceKey:'forbidden'}}}),platformId)).status,400);
  assert.equal((await handler(request({...initial,extra:'x'.repeat(129*1024)}),platformId)).status,413);
});

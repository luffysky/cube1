import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REGION_POLICIES,REGIONS,AGE_GROUPS,legalWarning} from '../dist/region-policies.mjs';
import {localizedRegionSummary} from '../dist/region-policy-locales.mjs';

test('all eleven named jurisdictions and fallback contain policy, gaps and official source links',()=>{
  assert.deepEqual(REGIONS,['tw','hk','mo','cn','jp','kr','my','sg','au','us','uk','other']);
  for(const id of REGIONS){
    const value=REGION_POLICIES[id];
    assert.ok(value.summary.length>20,id);
    assert.ok(value.gap.length>20,id);
    assert.ok(value.headline.length>3,id);
    assert.ok(Array.isArray(value.sources));
    if(id!=='other')assert.ok(value.sources.length>0,id);
    for(const [,url]of value.sources)assert.match(url,/^https:\/\//);
  }
});

test('every jurisdiction has readable localized overview in all five language selections',()=>{
  for(const id of REGIONS)for(const language of ['zh-TW','zh-CN','en','ja','ko']){
    assert.ok(localizedRegionSummary(id,language).length>20,id+' '+language);
  }
});

test('specific child privacy rules do not conflate Australian gaming with social media ban',()=>{
  assert.match(legalWarning('us','under13'),/COPPA/);
  assert.match(legalWarning('kr','13'),/14/);
  assert.match(legalWarning('my','16-17'),/18/);
  assert.match(legalWarning('cn','adult'),/實名/);
  assert.match(legalWarning('au','14-15'),/遊戲/);
  assert.equal(legalWarning('not-a-region','adult'),null);
  assert.deepEqual(AGE_GROUPS,['under13','13','14-15','16-17','adult']);
});

test('first-use consent is language-first with device language and no IP-based geolocation',async()=>{
  const source=await readFile(new URL('../dist/legal.mjs',import.meta.url),'utf8');
  assert.match(source,/navigator\.languages/);
  assert.match(source,/srgLanguageStage/);
  assert.match(source,/srgRegionStage/);
  assert.match(source,/showStep\(1\)/);
  assert.match(source,/srg\.consent\.v2/);
  assert.doesNotMatch(source,/geoip|ipapi|ipinfo|geolocation|Cloudflare-IPCountry/i);
  assert.match(source,/localizedRegionSummary/);
});

test('age group label remains concise in every consent language',async()=>{
  const source=await readFile(new URL('../dist/legal.mjs',import.meta.url),'utf8');
  for(const label of ["'年齡區間'","'年龄区间'","'Age group'","'年齢区分'","'연령대'"]){
    assert.ok(source.includes(label),'missing '+label);
  }
  for(const oldText of ['不收生日','no date of birth collected','誕生日は収集しません','생일을 수집하지 않음']){
    assert.equal(source.includes(oldText),false,'outdated parenthetical '+oldText);
  }
});

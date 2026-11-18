import {coreRows} from './core.mjs';
import {gameRows} from './game.mjs';
import {dynamicRows} from './dynamic.mjs';
import {platformRows} from './platform.mjs';
import {memberRows} from './members.mjs';
export const CATALOG_ROWS=Object.freeze([...coreRows,...gameRows,...dynamicRows,...platformRows,...memberRows]);
export const LOCALE_CODES=Object.freeze(['zh-TW','zh-CN','en','ja','ko']);
export function makeLocale(code){const index=LOCALE_CODES.indexOf(code)+1;if(index<1)throw new TypeError('Unknown locale');return Object.freeze(Object.fromEntries(CATALOG_ROWS.map(row=>[row[0],row[index]])));}

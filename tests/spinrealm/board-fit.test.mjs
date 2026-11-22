import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { boardHeight, BOARD_COLUMNS, BOARD_ROWS } from '../../dist/games/spinrealm/board-fit.mjs';

test('field always uses exactly ten columns and twenty rows with square cells',()=>{
 assert.equal(BOARD_COLUMNS,10);
 assert.equal(BOARD_ROWS,20);
 for(const width of [132,190,266,360,500,720]){
   const h=boardHeight({availableWidth:width,viewportHeight:900,touch:true});
   assert.ok(h <= width*2, 'height must fit available width with 1:2 aspect ratio');
   assert.ok(h>=160,'minimum field height');
 }
});

test('phone portrait prioritizes board size instead of squeezing controls into same viewport',()=>{
 const tall=boardHeight({availableWidth:266,viewportHeight:740,top:290,below:260,orientation:'portrait',touch:true});
 assert.equal(tall,532);
 const compact=boardHeight({availableWidth:230,viewportHeight:640,top:300,below:330,orientation:'portrait',touch:true});
 assert.equal(compact,460);
 const standard=boardHeight({availableWidth:230,viewportHeight:640,top:300,below:330,orientation:'portrait',touch:true,standard:true});
 assert.equal(standard,377);
});

test('portrait touch layout reserves browser-toolbar clearance and both control rows',()=>{
 const normal=boardHeight({availableWidth:266,viewportHeight:740,top:80,below:170,touch:true});
 const fitted=boardHeight({availableWidth:266,viewportHeight:740,top:80,below:170,touch:true,fitControls:true});
 assert.equal(normal,532);
 assert.equal(fitted,394);
 assert.ok(fitted<normal,'compact phone must reserve the space for the controls');
 assert.equal(boardHeight({availableWidth:266,viewportHeight:520,top:100,below:250,touch:true,fitControls:true}),240);
});

test('landscape keeps board within available field width and visible space',()=>{
 const h=boardHeight({availableWidth:245,viewportHeight:390,top:57,below:500,orientation:'landscape',touch:true});
 assert.equal(h,333);
 assert.equal(boardHeight({availableWidth:145,viewportHeight:340,top:43,orientation:'landscape',touch:true}),290);
});

test('desktop board remains at most available horizontal size and capped height',()=>{
 assert.equal(boardHeight({availableWidth:450,viewportHeight:1200,top:200,below:100,touch:false}),900);
 assert.equal(boardHeight({availableWidth:300,viewportHeight:1100,top:130,below:120,touch:false}),600);
 assert.equal(boardHeight({availableWidth:450,viewportHeight:1200,top:200,below:100,touch:false,guide:true}),840);
});

test('layout styles keep board aspect ratio and prioritize player arena in portrait',async()=>{
 const styles=await fs.readFile(new URL('../../dist/games/spinrealm/board-focus.css',import.meta.url),'utf8');
 const index=await fs.readFile(new URL('../../dist/games/spinrealm/index.html',import.meta.url),'utf8');
 assert.match(styles,/aspect-ratio:1\/2/);
 assert.match(styles,/orientation:portrait/);
 assert.match(styles,/orientation:landscape/);
 assert.match(styles,/\.arena-card\{order:0;/);
 assert.match(index,/board-focus\.css/);
 assert.match(styles,/scroll-margin-bottom:calc\(100px \+ env\(safe-area-inset-bottom/);
 const app=await fs.readFile(new URL('../../dist/games/spinrealm/app.mjs',import.meta.url),'utf8');
 assert.match(app,/fitControls:touch&&narrow&&!landscape/);
});

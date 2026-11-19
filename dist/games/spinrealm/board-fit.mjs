// Geometry-only board sizing: the game field is always exactly 10 by 20 square cells.
// Portrait prioritizes a readable board and permits scrolling to touch controls;
// landscape fits the board in the height available beside its own HUD.
export const BOARD_COLUMNS=10;
export const BOARD_ROWS=20;
export function boardHeight({availableWidth,viewportHeight,top=0,below=0,orientation='portrait',touch=false,standard=false,guide=false}={}){
 const width=Number(availableWidth);
 const visible=Number(viewportHeight);
 if(!Number.isFinite(width)||width<=0||!Number.isFinite(visible)||visible<=0)return 200;
 const widthBound=Math.max(0,Math.floor(width*BOARD_ROWS/BOARD_COLUMNS));
 const landscape=orientation==='landscape';
 let height;
 if(landscape){
   // Compact on-screen controls are arranged alongside the board.
   const headroom=Math.max(0,visible-top);
   height=Math.min(widthBound,Math.max(160,headroom));
 }else if(touch){
   // Never shrink a phone board just to squeeze the entire page into one screen.
   // Controls and other panels naturally follow in document flow.
   height=Math.min(widthBound,Math.max(240,Math.floor(visible*0.76)));
 }else{
   height=Math.min(widthBound,Math.max(360,visible-top-below));
 }
 if(guide)height=Math.min(height,Math.max(180,Math.floor(visible*.70)));
 if(standard)height=Math.floor(height*.82);
 return Math.max(160,Math.min(900,Math.floor(height)));
}

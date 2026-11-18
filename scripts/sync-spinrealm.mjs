import { copyFileSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const source=process.argv[2];if(!source)throw new Error('Usage: node scripts/sync-spinrealm.mjs /absolute/spinrealm-arena');
if(!path.isAbsolute(source))throw new Error('The Spinrealm source checkout must be an absolute path.');
const staticFiles=['index.html','styles.css','arena-layout.css','app.mjs','engine.mjs','input.mjs','bot.mjs','combat.mjs','party.mjs','sound.mjs','icon.svg','appearance.mjs','appearance.css','i18n.mjs','config.mjs','catalog.mjs','member-client.mjs','member-ui.mjs','member.css','ranked-client.mjs','gamepad.mjs','local-stats.mjs','prediction.mjs'];
function collectFiles(directory,relative=''){
  return readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>{
    const name=path.join(relative,entry.name),file=path.join(directory,entry.name);
    if(entry.isDirectory())return collectFiles(file,name);
    if(entry.isFile())return [{name,file}];
    throw new Error(`Unsupported audio entry: ${name}`);
  });
}
// Verify the complete source set before replacing any platform asset. In
// particular, do not copy a new app while sound.mjs is still being prepared.
for(const name of staticFiles)if(!statSync(path.join(source,'dist',name)).isFile())throw new Error(`Missing source asset: ${name}`);
const audioRoot=path.join(source,'dist','audio');
if(!statSync(audioRoot).isDirectory())throw new Error('Missing source audio directory.');
const audioFiles=collectFiles(audioRoot);
if(!audioFiles.length)throw new Error('The source audio directory is empty.');
const sourceTests=readdirSync(path.join(source,'tests')).filter(name=>name.endsWith('.test.mjs')).sort();
if(!sourceTests.includes('party.test.mjs'))throw new Error('Missing party regression tests.');
const output=new URL('../dist/games/spinrealm/',import.meta.url);mkdirSync(output,{recursive:true});
for(const name of staticFiles)copyFileSync(path.join(source,'dist',name),new URL(name,output));
for(const {name,file} of audioFiles){
  const destination=new URL(`audio/${name.split(path.sep).join('/')}`,output);
  mkdirSync(new URL('./',destination),{recursive:true});copyFileSync(file,destination);
}
for(const directory of ['locales','vendor']){
  for(const {name,file} of collectFiles(path.join(source,'dist',directory))){
    const destination=new URL(`${directory}/${name.split(path.sep).join('/')}`,output);
    mkdirSync(new URL('./',destination),{recursive:true});copyFileSync(file,destination);
  }
}
let html=readFileSync(new URL('index.html',output),'utf8');
html=html.replace('<body>','<body data-srg-page="spinrealm">');
html=html.replace('</head>','  <link rel="manifest" href="/manifest.webmanifest">\n  <link rel="apple-touch-icon" href="/assets/icon-192.png">\n</head>');
html=html.replace('<script type="module" src="./app.mjs"></script>','<script type="module" src="./app.mjs"></script>\n<script type="module" src="./platform-bridge.mjs"></script>');
writeFileSync(new URL('index.html',output),html);
const tests=new URL('../tests/spinrealm/',import.meta.url);mkdirSync(tests,{recursive:true});
for(const name of sourceTests){const code=readFileSync(path.join(source,'tests',name),'utf8').replace(/(['"])\.\.\/dist\//g,'$1../../dist/games/spinrealm/');writeFileSync(new URL(name,tests),code);}
console.log(`Copied Spinrealm static assets, ${audioFiles.length} audio/support files and ${sourceTests.length} test files; source identity was preserved.`);

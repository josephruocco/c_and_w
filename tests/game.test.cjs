const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){}});return nodes.get(id)};
 node('game').getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
 const context=vm.createContext({document:{querySelector:s=>node(s.slice(1)),getElementById:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math});
 vm.runInContext(fs.readFileSync('game.js','utf8'),context);
 return code=>vm.runInContext(code,context);
}
test('run, jump, land, pause and restart',()=>{const run=game();run('start(); update(.016)');assert.equal(run('state'),'running');assert.ok(run('distance')>0);run('jump(); update(.1)');assert.ok(run('player.y')<430);run('for(let i=0;i<90;i++)update(.016)');assert.equal(run('player.y'),430);run('pause()');assert.equal(run('state'),'paused');run('pause()');assert.equal(run('state'),'running');run('start()');assert.equal(run('distance'),0)});
test('nearby hatch enters tunnel and route returns to park',()=>{const run=game();run('start(); hatches.push({x:player.x}); enter()');assert.equal(run('zone'),'tunnel');assert.ok(run('tunnelUntil')>0);run('tunnelTravel=2501; update(.016)');assert.equal(run('zone'),'park')});
test('collision requires declining; keyboard cannot dismiss the conversation',()=>{const run=game();run('start(); people.push({x:player.x}); update(0)');assert.equal(run('focus'),2);assert.equal(run('state'),'conversation');run("action('Space');action('KeyP');action('Escape')");assert.equal(run('state'),'conversation');run('decline()');assert.equal(run('state'),'running');run('update(0)');assert.equal(run('focus'),2);run('invincible=0;update(0);decline();invincible=0;update(0)');assert.equal(run('state'),'conversation');assert.equal(run('focus'),0);run('decline()');assert.equal(run('state'),'over')});
test('jump clears characters and three bagels restore focus',()=>{const run=game();run('start(); player.y=GROUND-100;people.push({x:player.x});update(0)');assert.equal(run('focus'),3);run('focus=2;pickups.push(...Array.from({length:3},()=>({x:player.x,y:player.y-30})));update(0)');assert.equal(run('bagels'),3);assert.equal(run('focus'),3)});

test('left reverses world travel and score still increases; right turns back',()=>{
 const run=game();run('start();update(.1)');const before=run('camera'),score=run('distance');
 run("keys.add('ArrowLeft');update(.1)");assert.ok(run('camera')<before);assert.ok(run('distance')>score);assert.equal(run('direction'),-1);
 run("keys.clear();keys.add('ArrowRight');update(.1)");assert.equal(run('direction'),1);assert.ok(run('camera')>0);
});
test('tunnel returns to park while running left',()=>{const run=game();run("start();hatches.push({x:player.x});enter();direction=-1;tunnelTravel=2499;update(.02)");assert.equal(run('zone'),'park')});
test('clouds are one-way platforms and allow jumping again',()=>{
 const run=game();run("start();clouds.length=0;clouds.push({x:200,y:330,w:170});player.y=320;player.vy=200;update(.05)");
 assert.equal(run('player.y'),330);assert.equal(run('player.grounded'),true);run('jump()');assert.ok(run('player.vy')<0);
 run('player.y=355;player.vy=-400;update(.05)');assert.ok(run('player.y')<355);assert.equal(run('player.grounded'),false);
});
test('holding jump can climb generated clouds into space in either direction',()=>{
 for(const dir of [1,-1]){
  const run=game();run(`start();direction=${dir};keys.add('Space');`);
  const highest=run("(()=>{let y=GROUND;for(let i=0;i<1500;i++){if(state==='conversation'){decline();keys.add('Space')}if(state==='over')break;update(1/60);y=Math.min(y,player.y)}return y})()");
  assert.ok(highest< -600,`direction ${dir}, highest ${highest}`);
 }
});
test('Pearly Gates immunity blocks encounters, expires, and cannot refill at same gate',()=>{
 const run=game();run("start();clouds.length=0;clouds.push({x:200,y:-800,w:270,refuge:true,id:'gate'});player.y=-810;player.vy=200;update(.05)");
 assert.equal(run('grace'),12);assert.equal(run('player.y'),-800);
 run("people.push({x:camera+player.x,y:-800,sky:true});update(0)");assert.equal(run('state'),'running');assert.equal(run('focus'),3);
 run('grace=.01;update(.02)');assert.equal(run('grace'),0);assert.equal(run('state'),'conversation');
});
test('space encounters require declining and falling returns to ground',()=>{
 const run=game();run('start();clouds.length=0;skyRoutes.clear();player.y=-800;people.push({x:player.x,y:-800,sky:true});update(0)');assert.equal(run('state'),'conversation');
 run('decline();people.length=0;clouds.length=0;player.y=420;player.vy=400;update(.05)');assert.equal(run('player.y'),430);assert.equal(run('viewY'),0);
});

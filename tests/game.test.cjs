const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const testMath=Object.create(Math);testMath.random=()=>.12345;
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){}});return nodes.get(id)};
 node('game').getBoundingClientRect=()=>({width:1200,height:540});
 node('game').getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
 const context=vm.createContext({document:{querySelector:s=>node(s.slice(1)),getElementById:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},removeEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math:testMath});
 vm.runInContext(fs.readFileSync('boss.js','utf8'),context);
 vm.runInContext(fs.readFileSync('game.js','utf8'),context);
 return code=>vm.runInContext(code,context);
}

test('run starts automatically, moves without input and steers both ways',()=>{
 const run=game();run('start()');const x=run('player.x');run('update(.1)');assert.ok(run('player.x')>x);assert.ok(run('player.y')<430);
 run("keys.add('ArrowLeft');update(.1)");assert.equal(run('direction'),-1);
 run('pause()');const y=run('player.y');run('update(.2)');assert.equal(run('player.y'),y);run('pause()');assert.equal(run('state'),'running');
});
test('cloud landing bounces automatically and restores the extra jump',()=>{
 const run=game();run('start();clouds.length=0;clouds.push({x:200,y:330,w:150});player.x=250;player.y=320;player.vy=200;player.airJump=false;update(.05)');
 assert.equal(run('player.y'),330);assert.equal(run('player.vy'),-720);assert.equal(run('player.airJump'),true);
 run('jump()');assert.equal(run('player.vy'),-640);assert.equal(run('player.airJump'),false);
 run('player.vy=50;jump()');assert.equal(run('player.vy'),50);
});
test('camera never descends and falling below the screen kills the run',()=>{
 const run=game();run('start();player.y=-500;update(0)');const view=run('viewY');
 run('player.y=-400;update(0)');assert.equal(run('viewY'),view);
 run('player.y=viewY+H-sceneOffset+71;update(0)');assert.equal(run('state'),'over');
});
test('endless clouds continue beyond the old ceiling and remain bounded',()=>{
 const run=game();run('start()');
 run('for(let i=0;i<200;i++){viewY=-i*200;populateSky()}');
 assert.ok(run('nextCloudY')< -39000);assert.ok(run('clouds.length')<20);
 assert.ok(run('clouds.every(c=>c.x>=0&&c.x+c.w<=W)'));
 const ys=JSON.parse(run('JSON.stringify(clouds.map(c=>c.y))'));
 for(let i=1;i<ys.length;i++)assert.ok(ys[i-1]-ys[i]>=85&&ys[i-1]-ys[i]<=110);
});
test('spaceship crosses the sky, kills on contact, and resets on restart',()=>{
 const run=game();run('start();ship.timer=0;updateShip(.1)');assert.equal(run('ship.active'),true);
 const x=run('ship.x');run('updateShip(.1)');assert.notEqual(run('ship.x'),x);
 run('ship.x=player.x;ship.y=player.y-30;updateShip(0)');assert.equal(run('state'),'over');
 run('start()');assert.equal(run('ship.active'),false);assert.equal(run('ship.timer'),4);
});
test('portrait and rotation preserve altitude and keep the runner inside the arena',()=>{
 const run=game();run('start();player.y=-500;update(0);canvas.getBoundingClientRect=()=>({width:390,height:844});resizeGame();draw()');
 assert.equal(run('W'),600);assert.equal(run('H'),1298);assert.ok(run('player.x')<600);assert.equal(run('player.y'),-500);
 run('canvas.getBoundingClientRect=()=>({width:1200,height:540});resizeGame();draw()');
 assert.equal(run('W'),1200);assert.equal(run('player.y'),-500);
});
test('opening bounce lands on the first cloud without input across seeds',()=>{
 for(const seed of [1,9,25,100,999]){
  const run=game();run(`Math.random=()=>${seed}/1000000;start();let bounced=false;for(let i=0;i<90;i++){const vy=player.vy;update(1/120);if(vy>0&&player.vy<0)bounced=true}`);
  assert.equal(run('bounced'),true);
 }
});

test('tilt calibrates, ignores jitter, steers and lets arrows override it',()=>{
 const run=game();run('start();tilt.enabled=true;readTilt({gamma:10,beta:30});readTilt({gamma:13,beta:30});update(0)');
 assert.equal(run('direction'),1);
 run('readTilt({gamma:0,beta:30});update(0)');assert.equal(run('direction'),-1);
 run("keys.add('ArrowRight');update(0)");assert.equal(run('direction'),1);
 run('keys.clear();readTilt({gamma:20,beta:30});update(0)');assert.equal(run('direction'),1);
 run('stopTilt();readTilt({gamma:-30,beta:30});update(0)');assert.equal(run('direction'),1);
});
test('tilt ignores invalid samples and recalibrates on rotation',()=>{
 const run=game();run('tilt.enabled=true;readTilt({gamma:null,beta:null})');assert.equal(run('tilt.neutral'),null);
 run('readTilt({gamma:5,beta:20});window.orientation=90;readTilt({gamma:5,beta:20})');assert.equal(run('tilt.lean'),0);
 run('readTilt({gamma:5,beta:35})');assert.ok(run('tilt.lean')>5);
});
test('tilt handles granted, denied and failed permission requests',async()=>{
 const run=game();run("window.DeviceOrientationEvent={requestPermission:async()=> 'denied'}");
 await run('toggleTilt()');assert.equal(run('tilt.enabled'),false);
 run("window.DeviceOrientationEvent.requestPermission=async()=>{throw Error('blocked')}");
 await run('toggleTilt()');assert.equal(run('tilt.enabled'),false);
 run("start();window.DeviceOrientationEvent.requestPermission=async()=> 'granted'");
 await run('toggleTilt()');assert.equal(run('tilt.enabled'),true);assert.equal(run('state'),'paused');
 await run('toggleTilt()');assert.equal(run('tilt.enabled'),false);
});
test('tilt supports phones without permission prompts and unsupported devices',async()=>{
 const run=game();await run('toggleTilt()');assert.equal(run('tilt.enabled'),false);
 run('window.DeviceOrientationEvent={}');await run('toggleTilt()');assert.equal(run('tilt.enabled'),true);
});

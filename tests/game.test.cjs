const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function game(){
 const testMath=Object.create(Math);testMath.random=()=>.12345;
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){}},setAttribute(){},addEventListener(){}});return nodes.get(id)};
 node('game').getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});
 const context=vm.createContext({document:{querySelector:s=>node(s.slice(1)),getElementById:node,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math:testMath});
 vm.runInContext(fs.readFileSync('boss.js','utf8'),context);
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
test('RV starts at 1000 meters, with a deliberate intro even from space',()=>{
 const run=game();run('start();distance=1000;player.y=-1000;update(.016)');assert.equal(run('state'),'bossIntro');assert.equal(run('player.y'),430);assert.equal(run('clouds.length'),0);
 run('startBoss()');assert.equal(run('focus'),3);assert.equal(run('boss.phase'),'warning');
 run('pause();update(.5)');assert.equal(run('boss.timer'),2.2);
});
test('RV collision hurts once per pass, never opens conversation, and loss can retry',()=>{
 const run=game();run("start();introduceBoss();startBoss();boss.phase='charge';boss.x=player.x;update(0)");assert.equal(run('focus'),2);assert.equal(run('state'),'running');run('update(0)');assert.equal(run('focus'),2);
 run('focus=1;boss.hit=false;update(0)');assert.equal(run('state'),'over');run("action('Space')");assert.equal(run('focus'),3);assert.equal(run('boss.dodges'),0);assert.equal(run('state'),'running');
});
test('five timed jumps beat RV charges without damage',()=>{
 const run=game();run('start();introduceBoss();startBoss()');
 run(`for(let i=0;i<6000&&state==='running';i++){
   const speed=700+boss.dodges*65;
   if(boss.phase==='charge'&&player.grounded&&Math.abs(boss.x-player.x)<speed*.29+110)jump();
   update(1/120);
 }`);
 assert.equal(run('state'),'won');assert.equal(run('focus'),3);assert.equal(run('boss.dodges'),5);
 run("action('Space')");assert.equal(run('boss.active'),false);assert.equal(run('distance'),0);
});
test('double jump flips once per landing and resets on cloud and boss ground',()=>{
 const run=game();run('start();jump();update(.1);jump()');assert.equal(run('player.vy'),-640);assert.equal(run('player.airJump'),false);assert.equal(run('player.flip'),.5);
 run('player.vy=50;jump()');assert.equal(run('player.vy'),50);
 run('clouds.length=0;clouds.push({x:camera+player.x-50,y:330,w:170});player.y=320;player.vy=200;update(.05)');assert.equal(run('player.airJump'),true);assert.equal(run('player.flip'),0);
 run('introduceBoss();startBoss();jump();update(.1);jump()');assert.equal(run('player.airJump'),false);run('player.y=429;player.vy=100;update(.02)');assert.equal(run('player.airJump'),true);
});
test('levels advance every 250m, reward focus once, and smoothly increase speed',()=>{
 const run=game();run('start()');assert.equal(run('runningSpeed()'),225);
 run('focus=1;distance=249;updateLevel()');assert.equal(run('level'),1);assert.equal(run('focus'),1);
 run('distance=250;updateLevel()');assert.equal(run('level'),2);assert.equal(run('focus'),2);run('updateLevel()');assert.equal(run('focus'),2);
 run('distance=500;updateLevel()');assert.equal(run('level'),3);assert.equal(run('focus'),3);
 run('distance=750;updateLevel()');assert.equal(run('level'),4);assert.equal(run('runningSpeed()'),303.75);
 run('distance=1000;update(.016)');assert.equal(run('state'),'bossIntro');assert.equal(run('runningSpeed()'),330);
 run('start()');assert.equal(run('level'),1);
});
test('moving clouds carry the runner, outreach characters, and bagels',()=>{
 const run=game();run(`start();clouds.length=0;people.length=0;pickups.length=0;
 const platform={x:200,y:330,baseX:200,baseY:330,w:170,amplitudeX:20,amplitudeY:12,frequency:1,phase:0};
 clouds.push(platform);player.platform=platform;player.grounded=true;player.y=330;
 people.push({platform,x:285,y:330});pickups.push({platform,x:285,y:275});tick=Math.PI/2;moveClouds();`);
 assert.equal(run('camera'),20);assert.equal(run('player.y'),342);assert.equal(run('people[0].x'),305);assert.equal(run('pickups[0].y'),287);
 run('player.y+=1;player.vy=20;landOnClouds(342)');assert.equal(run('player.grounded'),true);assert.equal(run('player.y'),342);
 run('jump()');assert.equal(run('player.platform'),null);
});
test('cloud patterns are repeatable within a seed, varied across seeds, and bounded',()=>{
 const run=game();const route=seed=>run(`cloudSeed=${seed};clouds.length=0;people.length=0;pickups.length=0;skyRoutes.clear();populateSky();JSON.stringify(clouds)`);
 assert.equal(route(9),route(9));assert.notEqual(route(9),route(10));
 for(let seed=0;seed<30;seed++){
  route(seed);
  assert.ok(run('clouds.some(c=>c.amplitudeX>0)'));assert.ok(run('clouds.some(c=>c.amplitudeY>0)'));
  assert.ok(run('clouds.every(c=>c.step!==0&&!c.refuge||(!c.amplitudeX&&!c.amplitudeY))'));
  assert.ok(run(`clouds.every(c=>{if(c.step===0)return true;const prev=clouds.find(p=>p.id===c.id.replace(/[^:]+$/,String(c.step-1)));return prev.baseY-c.baseY+prev.amplitudeY+c.amplitudeY<136})`));
 }
});

test('RV entry side is independent each pass and has no advance visual or sound cue',()=>{
 const run=game();
 run("start();introduceBoss();startBoss();let calls=0;const choices=[.1,.1,.9,.9,.1];Math.random=()=>choices[calls++];let sounds=0;tone=()=>sounds++;");
 const sides=run("JSON.stringify(Array.from({length:5},()=>{prepareCharge();boss.passes++;return boss.direction}))");
 assert.deepEqual(JSON.parse(sides),[-1,-1,1,1,-1]);assert.equal(run('sounds'),0);
 run("let labels=[];text=(label)=>labels.push(label);drawBossHud()");
 assert.equal(run("labels.some(label=>/INCOMING|ROOF|←|→/.test(label))"),false);
 assert.equal(run('boss.x'),1420);
});

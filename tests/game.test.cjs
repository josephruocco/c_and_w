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
test('nearby hatch enters tunnel and route returns to park',()=>{const run=game();run('start(); hatches.push({x:player.x}); enter()');assert.equal(run('zone'),'tunnel');assert.ok(run('tunnelUntil')>0);run('camera=tunnelUntil+1; update(.016)');assert.equal(run('zone'),'park')});
test('three conversations end run; immunity prevents duplicate hit',()=>{const run=game();run('start(); people.push({x:player.x}); update(0)');assert.equal(run('focus'),2);run('update(0)');assert.equal(run('focus'),2);run('invincible=0;update(0);invincible=0;update(0)');assert.equal(run('state'),'over');assert.equal(run('focus'),0)});
test('jump clears characters and three bagels restore focus',()=>{const run=game();run('start(); player.y=GROUND-100;people.push({x:player.x});update(0)');assert.equal(run('focus'),3);run('focus=2;pickups.push(...Array.from({length:3},()=>({x:player.x,y:player.y-30})));update(0)');assert.equal(run('bagels'),3);assert.equal(run('focus'),3)});

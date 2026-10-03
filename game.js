'use strict';
const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const GROUND=430;
let W=1200,H=540,portrait=false,sceneOffset=0;
function resizeGame(){
  const bounds=canvas.getBoundingClientRect();
  if(!bounds.width||!bounds.height)return;
  const oldW=W;
  portrait=bounds.height>bounds.width;
  W=portrait?600:1200;
  H=portrait?Math.round(W*bounds.height/bounds.width):540;
  sceneOffset=portrait?H-640:0;
  canvas.width=W;canvas.height=H;
  player.x=Math.max(30,Math.min(W-30,player.x*W/oldW));
  for(const c of clouds)c.x=Math.max(0,Math.min(W-c.w,(c.x+c.w/2)*W/oldW-c.w/2));
  nextCloudX=Math.max(105,Math.min(W-105,nextCloudX*W/oldW));
  for(const b of pickups)if(b.platform)b.x=b.platform.x+b.platform.w/2;
  ship.x*=W/oldW;

}
let state='ready', zone='park', distance=0, camera=0, focus=3, bagels=0, best=0, tick=0, invincible=0, tunnelUntil=0, last=0, spawnAt=550, hatchAt=1000, sound=false, audio;
try{best=Number(localStorage.getItem('cw-endless-best'))||0}catch{}
const keys=new Set(), people=[], pickups=[], hatches=[];
let direction=1, tunnelTravel=0, viewY=0, grace=0;
const clouds=[], skyRoutes=new Set(), usedRefuges=new Set();
const loadedBlocks=new Set();
let cloudSeed=1;
function cloudRandom(n){const v=Math.sin(n*127.1+cloudSeed*311.7)*43758.5453;return v-Math.floor(v)}
const LEVEL_LENGTH=250;
const LEVEL_NAMES=['WARM-UP','PICKING UP PACE','FULL STRIDE','FINAL STRETCH'];
let level=1;
function drawLevelProgress(){
  if(state!=='running')return;
  text('KEEP CLIMBING · DON’T FALL',W/2,portrait?H-128:510,portrait?16:12,'#fff1ce','center');
}
const player={x:230,y:GROUND,vy:0,grounded:true,airJump:true,flip:0,climbing:false};
const colors={ink:'#233d32',skin:'#d9a17c',orange:'#e56b3f'};
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function text(s,x,y,size,color,align='left'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(s,x,y)}
function tone(freq,duration=.09){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
let toastTimer;
function toast(s){$('toast').textContent=s;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2200)}
function hud(){$('distance').textContent=Math.floor(distance)+' m';$('best').textContent=Math.floor(best)+' m';$('focus').textContent=String(bagels);$('zone').textContent='ENDLESS SKY'}
let nextCloudY=335,nextCloudX=230,highestY=GROUND;
function start(){
  cloudSeed=Math.floor(Math.random()*1000000);state='running';zone='park';direction=1;
  camera=0;viewY=0;distance=0;bagels=0;tick=0;grace=0;invincible=0;highestY=GROUND;
  clouds.length=people.length=pickups.length=hatches.length=0;
  Object.assign(player,{x:W/2,y:GROUND,vy:-720,grounded:false,airJump:true,flip:0,platform:null,climbing:true});
  nextCloudY=335;nextCloudX=player.x+90;resetShip();populateSky();
  $('overlay').classList.add('hidden');$('conversation').classList.add('hidden');
  $('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');
  keys.clear();clearTimeout(toastTimer);$('toast').style.opacity=0;hud();
}
function overlay(tag,title,body,button){$('overlay-tag').textContent=tag;$('overlay-title').innerHTML=title;$('overlay-text').textContent=body;$('start').textContent=button;$('overlay-hint').textContent='PRESS SPACE';$('overlay').classList.remove('hidden')}
function pause(){if(state==='running'){state='paused';keys.clear();overlay('','PAUSED','','RESUME');$('pause').textContent='▶';$('pause').setAttribute('aria-label','Resume game')}else if(state==='paused'){state='running';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game')}}
function end(){state='over';best=Math.max(best,distance);try{localStorage.setItem('cw-endless-best',String(Math.floor(best)))}catch{}hud();overlay('','RUN OVER',`${Math.floor(distance)} m · ${bagels} bagels`,'TRY AGAIN');tone(150,.25)}
function decline(){if(state!=='conversation')return;$('conversation').classList.add('hidden');keys.clear();if(focus<=0){end();return}invincible=2.2;state='running';tone(360)}
function jump(){
  if(state!=='running')return;
  if(player.grounded){
    player.grounded=false;player.platform=null;player.vy=-720;tone(480);
  }else if(player.airJump){
    player.airJump=false;player.vy=-640;player.flip=.5;tone(760,.14);toast('DO A BARREL ROLL!');
  }
}
function runner(x,y){const phase=Math.sin(tick*14),leg=!player.grounded?8:phase*10;rect(x-10,y-60,21,6,colors.orange);rect(x-7,y-54,17,16,colors.skin);rect(x+7,y-50,6,5,colors.skin);rect(x-9,y-39,21,24,colors.orange);rect(x-7,y-15,19,8,'#274a43');rect(x-8-leg/2,y-8,7,10,'#274a43');rect(x+5+leg/2,y-8,7,10,'#274a43');rect(x-11-leg/2,y+1,12,5,'#f6ecd1');rect(x+5+leg/2,y+1,13,5,'#f6ecd1');rect(x-16,y-35+phase*3,7,19,colors.skin);rect(x+13,y-32-phase*3,7,16,colors.skin);rect(x-7,y-57,15,4,'#684632');rect(x+4,y-48,3,3,colors.ink)}
function person(x,y,phase=0){const step=Math.sin(tick*5+phase)*4;rect(x-12,y-67,25,15,'#293331');rect(x-19,y-54,38,5,'#293331');rect(x-9,y-49,19,18,'#c89777');rect(x-10,y-37,20,11,'#4e4033');rect(x-14,y-26,29,34,'#293331');rect(x-2,y-26,6,14,'#eeebdc');rect(x-20,y-25,7,25,'#293331');rect(x+15,y-25,7,25,'#293331');rect(x-13,y+8,10,12+step,'#293331');rect(x+5,y+8,10,12-step,'#293331');rect(x-17,y+18+step,14,5,'#222e29');rect(x+5,y+18-step,14,5,'#222e29')}
function tree(x,y,s){rect(x-7*s,y-95*s,14*s,100*s,'#69785b');rect(x-37*s,y-125*s,73*s,43*s,'#648664');rect(x-52*s,y-110*s,100*s,34*s,'#648664');rect(x-27*s,y-143*s,53*s,31*s,'#78956c');rect(x-46*s,y-102*s,58*s,15*s,'#73936a')}
function background(){if(zone==='park'){rect(0,0,W,H,'#dbe6d7');rect(0,0,W,180,'#dce9de');rect(963,40,47,47,'#f5efbf');for(let i=-1;i<11;i++){const x=i*155-(camera*.12%155);rect(x,144,89,135,'#b7c9b7');rect(x+10,130,69,14,'#b7c9b7');for(let j=0;j<4;j++)for(let k=0;k<3;k++)rect(x+13+j*18,160+k*30,7,12,'#ced9c8')}rect(0,267,W,116,'#a7bc88');for(let i=-1;i<10;i++)tree(i*190-(camera*.32%190),350,1.4+(i%2)*.2);rect(0,347,W,55,'#90a66c');for(let i=-1;i<14;i++){const x=i*105-(camera*.6%105);rect(x,358,4,41,'#687b5a');rect(x,368,105,3,'#687b5a');rect(x,387,105,3,'#687b5a')}for(let i=-1;i<4;i++){const x=i*530-(camera*.6%530);rect(x,339,65,8,'#a37b52');rect(x,351,65,7,'#a37b52');rect(x+5,358,5,30,'#526447');rect(x+55,358,5,30,'#526447')}rect(0,401,W,17,'#c7c29a');rect(0,418,W,64,'#d5c9a8');rect(0,482,W,H,'#849368');for(let i=0;i<40;i++)rect((i*77-camera*.9%77),446+(i%3)*11,14,2,'#bdaf8c');rect(0,479,W,4,'#a5a279');const signX=1040-camera*.6%1700;rect(signX,307,5,96,'#526447');rect(signX-52,298,112,42,'#36573e');text('PROSPECT',signX+4,315,10,'#ece8cf','center');text('PARK →',signX+4,330,10,'#ece8cf','center')}
else{rect(0,0,W,H,'#263831');for(let r=0;r<9;r++)for(let i=-1;i<14;i++){const x=i*100+(r%2)*50-(camera*.5%100);rect(x,55+r*43,96,39,r%2?'#39473a':'#404d3d')}rect(0,0,W,53,'#1c2b27');rect(0,82,W,10,'#7c785a');for(let i=-1;i<5;i++){const x=i*340-camera*.5%340;rect(x,0,13,418,'#22332b');ctx.fillStyle='#eac47312';ctx.beginPath();ctx.moveTo(x+80,113);ctx.lineTo(x-35,418);ctx.lineTo(x+195,418);ctx.closePath();ctx.fill();rect(x+73,54,4,47,'#1c2b27');rect(x+59,99,34,8,'#a28e60');rect(x+65,107,22,9,'#f2ce81')}rect(0,418,W,63,'#8e8970');rect(0,481,W,H,'#34473b');for(let i=0;i<20;i++)rect(i*85-(camera%85),442+(i%3)*14,28,3,'#777963');text('EXIT →',730-camera*.4%1400,210,16,'#9c9b76')}}
function spaceBackdrop(){
  const high=viewY< -600;
  rect(0,0,W,H,high?'#101a38':viewY< -200?'#607aa5':'#dce9de');
  if(high){
    for(let i=0;i<95;i++){
      const x=((i*193-camera*.1)%W+W)%W;
      const y=((i*97-viewY*.15)%H+H)%H;
      rect(x,y,i%7===0?3:2,i%7===0?3:2,i%3?'#d6e5f4':'#e7cf8c');
    }
    ctx.fillStyle='#557da5';ctx.beginPath();ctx.arc(970,370,105,0,Math.PI*2);ctx.fill();
    rect(915,303,50,22,'#81a490');rect(945,325,60,20,'#81a490');rect(965,345,22,40,'#81a490');
    text('BROOKLYN ↓',970,500,12,'#b1c6d9','center');
  }
}
function drawCloud(c){
  const x=c.x-camera,y=c.y;
  const base=c.refuge?'#f0d888':'#d2e4ef';
  rect(x,y,c.w,13,base);rect(x+12,y-13,c.w-24,13,'#f7f4e2');
  rect(x+30,y-23,35,12,'#f7f4e2');rect(x+c.w-70,y-20,42,12,'#f7f4e2');
  rect(x+10,y+13,c.w-20,7,viewY< -600?'#7287b0':'#b1cad9');
  if(c.step===0){text('CLIMB ↑ · DOUBLE JUMP',x+c.w/2,y-40,12,'#294936','center')}
  if(c.refuge){
    const gx=x+c.w/2;
    rect(gx-48,y-95,8,72,'#f9df8a');rect(gx+40,y-95,8,72,'#f9df8a');
    rect(gx-48,y-100,96,7,'#f9df8a');
    for(let i=0;i<7;i++)rect(gx-36+i*12,y-88,3,66,'#e1c879');
    rect(gx-4,y-134,8,27,'#fff5c8');rect(gx-13,y-126,26,6,'#fff5c8');
    text('PEARLY GATES',gx,y-153,13,'#fff3bf','center');
    text(usedRefuges.has(c.id)?'REST STOP':'12 SECONDS OF IMMUNITY',gx,y+39,10,'#fff3bf','center');
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);spaceBackdrop();ctx.save();ctx.translate(0,sceneOffset-viewY);
  if(viewY> -540)background();
  if(zone!=='tunnel')for(const c of clouds)if(c.x+c.w>camera&&c.x<camera+W&&c.y-viewY+sceneOffset> -180&&c.y-viewY<H-sceneOffset+40)drawCloud(c);
  for(const h of hatches){let x=h.x-camera;rect(x-40,417,80,14,'#304b3a');rect(x-34,421,68,8,'#182d25');for(let i=0;i<5;i++)rect(x-27+i*13,418,4,12,'#6d8161');rect(x-24,364,48,30,'#f0e9cf');text('↓',x,385,24,colors.ink,'center');text(zone==='park'?'DETOUR':'EXIT',x,354,10,zone==='park'?colors.ink:'#efe8c8','center')}
for(const b of pickups){let x=b.x-camera,y=b.y+Math.sin(tick*4+b.x)*4;ctx.strokeStyle='#8e5c2f';ctx.lineWidth=9;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e7b56a';ctx.lineWidth=6;ctx.stroke();rect(x-7,y-7,2,2,'#f3dfaa');rect(x+4,y+4,2,2,'#f3dfaa')}
for(const p of people){
  const x=p.x-camera,y=p.y??GROUND;
  if(x< -100||x>W+100||y-viewY< -100||y-viewY>H-sceneOffset+100)continue;
  person(x,y-23,p.x);
  if(y< -600){
    ctx.strokeStyle='#c2ebef';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-69,29,0,Math.PI*2);ctx.stroke();
    rect(x-29,y-47,9,31,'#a6beca');
  }
  if(Math.abs(x-player.x)<280&&Math.abs(y-player.y)<150){rect(x-72,y-120,144,27,'#f4efdb');rect(x-8,y-93,8,7,'#f4efdb');text('Are you Jewish?',x,y-102,12,colors.ink,'center')}
}

drawShip();
if(invincible<=0||Math.floor(tick*13)%2===0){ctx.save();ctx.translate(player.x,player.y-30);ctx.scale(direction,1);if(player.flip>0){const c=Math.cos((1-player.flip/.5)*Math.PI*2);ctx.scale(1,Math.sign(c||1)*Math.max(.12,Math.abs(c)))}runner(0,30);ctx.restore();}
if(grace>0){ctx.strokeStyle='#ffe39a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(player.x,player.y-79,19,6,0,0,Math.PI*2);ctx.stroke()}
ctx.restore();
drawLevelProgress();
if(state==='running'){
  text(`BAGELS ${bagels}`,24,90,12,viewY< -200||zone==='tunnel'?'#ede7ce':colors.ink);
  text(player.airJump?'FLIP READY':'FLIP USED',24,108,10,viewY< -200||zone==='tunnel'?'#ede7ce':colors.ink);
  if(grace>0)text(`IMMUNITY ${Math.ceil(grace)}s`,W/2,92,16,'#fff0ad','center');
}
}
function populateSky(){
  // Each landing is within a normal bounce's height and steering reach.
  while(nextCloudY>viewY-sceneOffset-350){
    const n=Math.round(-nextCloudY),w=150;
    nextCloudX=Math.max(w/2+30,Math.min(W-w/2-30,nextCloudX+(nextCloudY===335?0:(cloudRandom(n)-.5)*150)));
    const c={x:nextCloudX-w/2,y:nextCloudY,w,step:1};
    clouds.push(c);
    if(cloudRandom(n+8)>.6)pickups.push({x:nextCloudX,y:nextCloudY-45,platform:c});
    nextCloudY-=85+cloudRandom(n+3)*25;
  }
  const bottom=viewY+H-sceneOffset+120;
  for(let i=clouds.length-1;i>=0;i--)if(clouds[i].y>bottom)clouds.splice(i,1);
  for(let i=pickups.length-1;i>=0;i--)if(pickups[i].y>bottom)pickups.splice(i,1);
}
function landOnClouds(previousY){
  if(player.vy<0)return;
  const landed=clouds.filter(c=>player.x>=c.x-8&&player.x<=c.x+c.w+8&&previousY<=c.y&&player.y>=c.y).sort((a,b)=>a.y-b.y)[0];
  if(landed){
    player.y=landed.y;player.vy=-720;player.grounded=false;player.airJump=true;player.flip=0;
    tone(420+Math.min(distance,500),.06);
  }
}
function update(dt){
  if(state!=='running')return;
  tick+=dt;player.flip=Math.max(0,player.flip-dt);
  if(keys.has('ArrowLeft')||keys.has('KeyA'))direction=-1;
  if(keys.has('ArrowRight')||keys.has('KeyD'))direction=1;
  player.x+=direction*180*dt;
  if(player.x<25){player.x=25;direction=1}
  if(player.x>W-25){player.x=W-25;direction=-1}
  const previousY=player.y;
  player.vy+=1900*dt;player.y+=player.vy*dt;
  landOnClouds(previousY);
  highestY=Math.min(highestY,player.y);
  distance=Math.max(distance,(GROUND-highestY)/10);
  // The camera only rises: falling below the screen ends the run.
  viewY=Math.min(viewY,player.y-250);
  populateSky();updateShip(dt);
  if(state!=='running')return;
  if(player.y-viewY+sceneOffset>H+70){end();return}
  for(let i=pickups.length-1;i>=0;i--){
    const b=pickups[i];
    if(Math.abs(b.x-player.x)<31&&Math.abs(b.y-(player.y-30))<43){pickups.splice(i,1);bagels++;tone(700)}
  }
  hud();
}
function frame(now){const dt=Math.min((now-last)/1000,.035);last=now;if(state==='running')update(dt);draw();requestAnimationFrame(frame)}
function action(code){
  if(code==='ArrowLeft'||code==='KeyA')direction=-1;
  if(code==='ArrowRight'||code==='KeyD')direction=1;
  if(code==='KeyP'||code==='Escape'){pause();return}
  if(code==='Space'||code==='ArrowUp'||code==='KeyW'){
    if(state==='ready'||state==='over')start();else if(state==='paused')pause();else jump();
  }
}
window.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat)action(e.code);keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(state==='running')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pause()});$('decline').onclick=decline;$('start').onclick=()=>{if(state==='paused')pause();else start()};$('pause').onclick=pause;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');tone(540)};
for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);action(button.dataset.key)});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key))}
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'||state!=='running')return;
  e.preventDefault();jump();
});
window.addEventListener('resize',resizeGame);
resizeGame();
populateSky();hud();requestAnimationFrame(frame);

// Typing a guestbook message should not leave a run moving in the background.
document.addEventListener('focusin',e=>{if(e.target.closest?.('#gb-form')){keys.clear();if(state==='running')pause()}});

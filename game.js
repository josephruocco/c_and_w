'use strict';
const canvas=document.querySelector('#game'), ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const W=1200,H=540,GROUND=430;
let state='ready', zone='park', distance=0, camera=0, focus=3, bagels=0, best=0, tick=0, invincible=0, tunnelUntil=0, last=0, spawnAt=550, hatchAt=1000, sound=false, audio;
try{best=Number(localStorage.getItem('cw-best'))||0}catch{}
const keys=new Set(), people=[], pickups=[], hatches=[];
let direction=1, tunnelTravel=0, viewY=0, grace=0;
const clouds=[], skyRoutes=new Set(), usedRefuges=new Set();
const loadedBlocks=new Set();
const player={x:230,y:GROUND,vy:0,grounded:true,airJump:true,flip:0};
const colors={ink:'#233d32',skin:'#d9a17c',orange:'#e56b3f'};
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function text(s,x,y,size,color,align='left'){ctx.fillStyle=color;ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillText(s,x,y)}
function tone(freq,duration=.09){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='square';o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}catch{}}
let toastTimer;
function toast(s){$('toast').textContent=s;$('toast').style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.opacity=0,2200)}
function hud(){$('distance').textContent=String(Math.floor(distance)).padStart(4,'0')+' m';$('best').textContent=String(Math.floor(best)).padStart(4,'0')+' m';$('focus').textContent='● '.repeat(focus)+'○ '.repeat(3-focus);$('zone').textContent=boss.active?'FINAL BOSS':zone==='tunnel'?'UNDERGROUND':grace>0?'PEARLY GATES':player.y< -600?'OUTER SPACE':player.y<200?'CLOUD ROUTE':'PROSPECT PARK'}
function start(){boss.active=false;boss.phase='warning';$('practice').classList.add('hidden');state='running';zone='park';direction=1;tunnelTravel=0;viewY=0;grace=0;clouds.length=0;skyRoutes.clear();usedRefuges.clear();loadedBlocks.clear();distance=0;camera=0;focus=3;bagels=0;tick=0;invincible=0;tunnelUntil=0;spawnAt=550;hatchAt=1000;people.length=pickups.length=hatches.length=0;player.x=230;player.y=GROUND;player.vy=0;player.grounded=true;player.airJump=true;player.flip=0;populateSky();$('overlay').classList.add('hidden');$('conversation').classList.add('hidden');$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');keys.clear();clearTimeout(toastTimer);$('toast').style.opacity=0;hud();tone(360)}
function overlay(tag,title,body,button){$('overlay-tag').textContent=tag;$('overlay-title').innerHTML=title;$('overlay-text').textContent=body;$('start').textContent=button;$('overlay-hint').textContent='PRESS SPACE';$('overlay').classList.remove('hidden')}
function pause(){if(state==='running'){state='paused';keys.clear();overlay('','PAUSED','','RESUME');$('pause').textContent='▶';$('pause').setAttribute('aria-label','Resume game')}else if(state==='paused'){state='running';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game')}}
function end(){state='over';best=Math.max(best,distance);try{localStorage.setItem('cw-best',String(Math.floor(best)))}catch{}hud();overlay('','RUN OVER',`${Math.floor(distance)} m · ${bagels} bagels`,'TRY AGAIN');tone(150,.25)}
function decline(){if(state!=='conversation')return;$('conversation').classList.add('hidden');keys.clear();if(focus<=0){end();return}invincible=2.2;state='running';tone(360)}
function jump(){
  if(state!=='running')return;
  if(player.grounded){
    player.grounded=false;player.vy=-720;tone(480);
  }else if(player.airJump){
    player.airJump=false;player.vy=-640;player.flip=.5;tone(760,.14);toast('DO A BARREL ROLL!');
  }
}
function enter(){if(state!=='running'||boss.active)return;const h=hatches.find(h=>Math.abs(h.x-camera-player.x)<68);if(!h||player.y<GROUND-10)return;zone=zone==='park'?'tunnel':'park';clouds.length=0;skyRoutes.clear();viewY=0;people.length=0;pickups.length=0;hatches.length=0;loadedBlocks.clear();tunnelTravel=0;spawnAt=camera+500;hatchAt=camera+1000;tunnelUntil=zone==='tunnel'?camera+2500:0;invincible=1.2;toast(zone==='tunnel'?'UNDERGROUND':'PROSPECT PARK');tone(210,.2);hud()}
function runner(x,y){const phase=Math.sin(tick*14),leg=!player.grounded?8:phase*10;rect(x-10,y-60,21,6,colors.orange);rect(x-7,y-54,17,16,colors.skin);rect(x+7,y-50,6,5,colors.skin);rect(x-9,y-39,21,24,colors.orange);rect(x-7,y-15,19,8,'#274a43');rect(x-8-leg/2,y-8,7,10,'#274a43');rect(x+5+leg/2,y-8,7,10,'#274a43');rect(x-11-leg/2,y+1,12,5,'#f6ecd1');rect(x+5+leg/2,y+1,13,5,'#f6ecd1');rect(x-16,y-35+phase*3,7,19,colors.skin);rect(x+13,y-32-phase*3,7,16,colors.skin);rect(x-7,y-57,15,4,'#684632');rect(x+4,y-48,3,3,colors.ink)}
function person(x,y,phase=0){const step=Math.sin(tick*5+phase)*4;rect(x-12,y-67,25,15,'#293331');rect(x-19,y-54,38,5,'#293331');rect(x-9,y-49,19,18,'#c89777');rect(x-10,y-37,20,11,'#4e4033');rect(x-14,y-26,29,34,'#293331');rect(x-2,y-26,6,14,'#eeebdc');rect(x-20,y-25,7,25,'#293331');rect(x+15,y-25,7,25,'#293331');rect(x-13,y+8,10,12+step,'#293331');rect(x+5,y+8,10,12-step,'#293331');rect(x-17,y+18+step,14,5,'#222e29');rect(x+5,y+18-step,14,5,'#222e29')}
function tree(x,y,s){rect(x-7*s,y-95*s,14*s,100*s,'#69785b');rect(x-37*s,y-125*s,73*s,43*s,'#648664');rect(x-52*s,y-110*s,100*s,34*s,'#648664');rect(x-27*s,y-143*s,53*s,31*s,'#78956c');rect(x-46*s,y-102*s,58*s,15*s,'#73936a')}
function background(){if(zone==='park'){rect(0,0,W,H,'#dbe6d7');rect(0,0,W,180,'#dce9de');rect(963,40,47,47,'#f5efbf');for(let i=-1;i<11;i++){const x=i*155-(camera*.12%155);rect(x,144,89,135,'#b7c9b7');rect(x+10,130,69,14,'#b7c9b7');for(let j=0;j<4;j++)for(let k=0;k<3;k++)rect(x+13+j*18,160+k*30,7,12,'#ced9c8')}rect(0,267,W,116,'#a7bc88');for(let i=-1;i<10;i++)tree(i*190-(camera*.32%190),350,1.4+(i%2)*.2);rect(0,347,W,55,'#90a66c');for(let i=-1;i<14;i++){const x=i*105-(camera*.6%105);rect(x,358,4,41,'#687b5a');rect(x,368,105,3,'#687b5a');rect(x,387,105,3,'#687b5a')}for(let i=-1;i<4;i++){const x=i*530-(camera*.6%530);rect(x,339,65,8,'#a37b52');rect(x,351,65,7,'#a37b52');rect(x+5,358,5,30,'#526447');rect(x+55,358,5,30,'#526447')}rect(0,401,W,17,'#c7c29a');rect(0,418,W,64,'#d5c9a8');rect(0,482,W,58,'#849368');for(let i=0;i<40;i++)rect((i*77-camera*.9%77),446+(i%3)*11,14,2,'#bdaf8c');rect(0,479,W,4,'#a5a279');const signX=1040-camera*.6%1700;rect(signX,307,5,96,'#526447');rect(signX-52,298,112,42,'#36573e');text('PROSPECT',signX+4,315,10,'#ece8cf','center');text('PARK →',signX+4,330,10,'#ece8cf','center')}
else{rect(0,0,W,H,'#263831');for(let r=0;r<9;r++)for(let i=-1;i<14;i++){const x=i*100+(r%2)*50-(camera*.5%100);rect(x,55+r*43,96,39,r%2?'#39473a':'#404d3d')}rect(0,0,W,53,'#1c2b27');rect(0,82,W,10,'#7c785a');for(let i=-1;i<5;i++){const x=i*340-camera*.5%340;rect(x,0,13,418,'#22332b');ctx.fillStyle='#eac47312';ctx.beginPath();ctx.moveTo(x+80,113);ctx.lineTo(x-35,418);ctx.lineTo(x+195,418);ctx.closePath();ctx.fill();rect(x+73,54,4,47,'#1c2b27');rect(x+59,99,34,8,'#a28e60');rect(x+65,107,22,9,'#f2ce81')}rect(0,418,W,63,'#8e8970');rect(0,481,W,59,'#34473b');for(let i=0;i<20;i++)rect(i*85-(camera%85),442+(i%3)*14,28,3,'#777963');text('EXIT →',730-camera*.4%1400,210,16,'#9c9b76')}}
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
  if(c.step===0){text('HOLD JUMP ↑',x+c.w/2,y-40,12,'#294936','center')}
  if(c.refuge){
    const gx=x+c.w/2;
    rect(gx-48,y-95,8,72,'#f9df8a');rect(gx+40,y-95,8,72,'#f9df8a');
    rect(gx-48,y-100,96,7,'#f9df8a');
    for(let i=0;i<7;i++)rect(gx-36+i*12,y-88,3,66,'#e1c879');
    rect(gx-4,y-134,8,27,'#fff5c8');rect(gx-13,y-126,26,6,'#fff5c8');
    text('PEARLY GATES',gx,y-153,13,'#fff3bf','center');
    text(usedRefuges.has(c.id)?'REST STOP':'12 SECONDS OF PEACE',gx,y+39,10,'#fff3bf','center');
  }
}
function draw(){
  ctx.clearRect(0,0,W,H);spaceBackdrop();ctx.save();ctx.translate(0,-viewY);
  if(viewY> -540)background();
  if(zone!=='tunnel')for(const c of clouds)if(c.x+c.w>camera&&c.x<camera+W&&c.y-viewY> -180&&c.y-viewY<H+40)drawCloud(c);
  for(const h of hatches){let x=h.x-camera;rect(x-40,417,80,14,'#304b3a');rect(x-34,421,68,8,'#182d25');for(let i=0;i<5;i++)rect(x-27+i*13,418,4,12,'#6d8161');rect(x-24,364,48,30,'#f0e9cf');text('↓',x,385,24,colors.ink,'center');text(zone==='park'?'DETOUR':'EXIT',x,354,10,zone==='park'?colors.ink:'#efe8c8','center')}
for(const b of pickups){let x=b.x-camera,y=b.y+Math.sin(tick*4+b.x)*4;ctx.strokeStyle='#8e5c2f';ctx.lineWidth=9;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e7b56a';ctx.lineWidth=6;ctx.stroke();rect(x-7,y-7,2,2,'#f3dfaa');rect(x+4,y+4,2,2,'#f3dfaa')}
for(const p of people){
  const x=p.x-camera,y=p.y??GROUND;
  if(x< -100||x>W+100||y-viewY< -100||y-viewY>H+100)continue;
  person(x,y-23,p.x);
  if(y< -600){
    ctx.strokeStyle='#c2ebef';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y-69,29,0,Math.PI*2);ctx.stroke();
    rect(x-29,y-47,9,31,'#a6beca');
  }
  if(Math.abs(x-player.x)<280&&Math.abs(y-player.y)<150){rect(x-72,y-120,144,27,'#f4efdb');rect(x-8,y-93,8,7,'#f4efdb');text('Are you Jewish?',x,y-102,12,colors.ink,'center')}
}
if(state==='ready'){person(880,GROUND-23);rect(808,GROUND-120,144,27,'#f4efdb');text('Are you Jewish?',880,GROUND-102,12,colors.ink,'center')}
drawBoss();
if(invincible<=0||Math.floor(tick*13)%2===0){ctx.save();ctx.translate(player.x,player.y-30);ctx.scale(direction,1);if(player.flip>0){const c=Math.cos((1-player.flip/.5)*Math.PI*2);ctx.scale(1,Math.sign(c||1)*Math.max(.12,Math.abs(c)))}runner(0,30);ctx.restore();}
if(grace>0){ctx.strokeStyle='#ffe39a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(player.x,player.y-79,19,6,0,0,Math.PI*2);ctx.stroke()}
ctx.restore();
drawBossHud();
if(state==='running'){
  text(`BAGELS ${bagels}`,24,90,12,viewY< -200||zone==='tunnel'?'#ede7ce':colors.ink);
  text(player.airJump?'FLIP READY':'FLIP USED',24,108,10,viewY< -200||zone==='tunnel'?'#ede7ce':colors.ink);
  if(grace>0)text(`IMMUNITY ${Math.ceil(grace)}s`,W/2,92,16,'#fff0ad','center');
}
}
function populateSky(){
  if(zone==='tunnel')return;
  const center=Math.floor((camera+player.x)/5200);
  for(let route=center-1;route<=center+1;route++){
    if(skyRoutes.has(route))continue;
    skyRoutes.add(route);
    for(const side of [-1,1])for(let step=0;step<17;step++){
      const refuge=step===14;
      const x=route*5200+230+side*(220+step*140)-(side<0?170:0);
      const y=335-step*90,id=`${route}:${side}:${step}`;
      clouds.push({x,y,w:refuge?270:170,refuge,id,step});
      if([10,13,16].includes(step))people.push({x:x+85,y,sky:true});
      if(step%3===1)pickups.push({x:x+85,y:y-55});
    }
  }
  for(const route of skyRoutes)if(Math.abs(route-center)>2)skyRoutes.delete(route);
  for(let i=clouds.length-1;i>=0;i--)if(Math.abs(clouds[i].x-camera-player.x)>15000)clouds.splice(i,1);
}
function landOnClouds(previousY){
  const worldX=camera+player.x;
  player.grounded=false;
  if(player.vy>=0&&zone!=='tunnel'){
    const landed=clouds.filter(c=>worldX>=c.x-8&&worldX<=c.x+c.w+8&&previousY<=c.y+.01&&player.y>=c.y).sort((a,b)=>a.y-b.y)[0];
    if(landed){
      player.y=landed.y;player.vy=0;player.grounded=true;player.airJump=true;player.flip=0;
      if(landed.refuge&&!usedRefuges.has(landed.id)){
        usedRefuges.add(landed.id);grace=12;toast('PEARLY GATES · 12 seconds of immunity');tone(850,.2);
      }
    }
  }
  if(player.y>=GROUND){player.y=GROUND;player.vy=0;player.grounded=true;player.airJump=true;player.flip=0}
}
function populateGround(){
  const center=Math.floor((camera+player.x)/900);
  for(let block=center-2;block<=center+2;block++){
    if(loadedBlocks.has(block))continue;
    loadedBlocks.add(block);
    const x=block*900+760;
    people.push({x});pickups.push({x:x-160,y:GROUND-95},{x:x+120,y:GROUND-130});
    if(block%2===0)hatches.push({x:block*900+1150});
  }
  for(const block of loadedBlocks)if(Math.abs(block-center)>5)loadedBlocks.delete(block);
  for(const list of [people,pickups,hatches])for(let i=list.length-1;i>=0;i--)if(!list[i].sky&&Math.abs(list[i].x-camera-player.x)>5000)list.splice(i,1);
}
function update(dt){
  if(state!=='running')return;
  if(boss.active){updateBoss(dt);return}
  if(distance>=BOSS_DISTANCE){introduceBoss();return}
  tick+=dt;
  player.flip=Math.max(0,player.flip-dt);
  if(keys.has('ArrowLeft')||keys.has('KeyA'))direction=-1;
  if(keys.has('ArrowRight')||keys.has('KeyD'))direction=1;
  const speed=225+Math.min(distance*.035,90);
  camera+=direction*speed*dt;
  distance+=speed*dt/10;
  invincible=Math.max(0,invincible-dt);
  grace=Math.max(0,grace-dt);
  populateGround();populateSky();
  if(player.grounded&&(keys.has('Space')||keys.has('ArrowUp')||keys.has('KeyW')))jump();
  const previousY=player.y;
  player.vy+=1900*dt;player.y+=player.vy*dt;
  landOnClouds(previousY);
  viewY=zone==='tunnel'?0:Math.min(0,player.y-250);
  if(zone==='tunnel'){
    tunnelTravel+=speed*dt;
    if(tunnelTravel>2500){zone='park';people.length=pickups.length=hatches.length=0;loadedBlocks.clear();skyRoutes.clear();clouds.length=0;toast('PROSPECT PARK')}
  }
for(let i=people.length-1;i>=0;i--){const p=people[i];const x=p.x-camera;if(Math.abs(x-player.x)<30&&player.y>(p.y??GROUND)-68&&player.y<(p.y??GROUND)+35&&invincible<=0&&grace<=0){focus--;state='conversation';keys.clear();clearTimeout(toastTimer);$('toast').style.opacity=0;$('conversation').classList.remove('hidden');tone(190,.15);hud();return}if(Math.abs(x-player.x)>(p.sky?15000:5000))people.splice(i,1)}
for(let i=pickups.length-1;i>=0;i--){const b=pickups[i],x=b.x-camera;if(Math.abs(x-player.x)<31&&Math.abs(b.y-(player.y-30))<43){pickups.splice(i,1);bagels++;tone(700);if(bagels%3===0){focus=Math.min(3,focus+1);toast('+1 FOCUS')}}else if(Math.abs(x-player.x)>5000)pickups.splice(i,1)}
if(keys.has('ArrowDown')||keys.has('KeyS')){enter();keys.delete('ArrowDown');keys.delete('KeyS')}hud()}
function frame(now){const dt=Math.min((now-last)/1000,.035);last=now;if(state==='running')update(dt);draw();requestAnimationFrame(frame)}
function action(code){if(state==='running'){if(code==='ArrowLeft'||code==='KeyA')direction=-1;if(code==='ArrowRight'||code==='KeyD')direction=1}if(code==='KeyP'||code==='Escape'){pause();return}if(code==='Space'||code==='ArrowUp'||code==='KeyW'){if(state==='bossIntro'||(state==='over'&&boss.active))startBoss();else if(state==='ready'||state==='over'||state==='won')start();else if(state==='paused')pause();else jump()}}
window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat)action(e.code);keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(state==='running')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pause()});$('decline').onclick=decline;$('practice').onclick=()=>{start();introduceBoss()};$('start').onclick=()=>{if(state==='paused')pause();else if(state==='bossIntro'||(state==='over'&&boss.active))startBoss();else start()};$('pause').onclick=pause;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');tone(540)};
for(const button of document.querySelectorAll('[data-key]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);action(button.dataset.key)});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key))}
populateSky();hud();requestAnimationFrame(frame);

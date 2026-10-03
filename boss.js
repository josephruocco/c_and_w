'use strict';

const ship={active:false,x:0,y:0,direction:1,timer:4};
function resetShip(){Object.assign(ship,{active:false,x:0,y:0,direction:1,timer:4})}
function updateShip(dt){
  if(!ship.active){
    ship.timer-=dt;
    if(ship.timer<=0){
      ship.active=true;ship.direction=Math.random()<.5?1:-1;
      ship.x=ship.direction===1?-140:W+140;ship.y=player.y-65;
      toast('MOSHIAH SPACESHIP · EVADE!');tone(190,.18);
    }
    return;
  }
  ship.x+=ship.direction*(210+Math.min(distance*.2,100))*dt;
  if(Math.abs(player.x-ship.x)<75&&Math.abs(player.y-30-ship.y)<35){
    end();overlay('','CAUGHT IN SPACE',`${Math.floor(distance)} m climbed · ${bagels} bagels`,'TRY AGAIN');return;
  }
  if(ship.x< -160||ship.x>W+160){ship.active=false;ship.timer=3+Math.random()*2}
}
function drawShip(){
  if(!ship.active)return;
  const x=ship.x,y=ship.y;
  rect(x-38,y-38,76,24,'#88c7d7');rect(x-25,y-48,50,10,'#c5eff0');
  rect(x-62,y-14,124,25,'#e8dcaf');rect(x-78,y-5,156,12,'#8d9e99');
  rect(x-50,y+11,100,7,'#bd713a');
  for(let i=0;i<5;i++)rect(x-48+i*24,y+4,8,5,i%2?'#f0aa57':'#e9edb7');
  text('MOSHIAH',x,y-17,12,'#233d32','center');
  rect(x-ship.direction*85,y,12+Math.sin(tick*25)*5,7,'#f4b75d');
}

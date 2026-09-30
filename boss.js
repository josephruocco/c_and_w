'use strict';

// The finale uses a fixed arena so a charge can come from either side.
const BOSS_DISTANCE = 1000;
const BOSS_DODGES = 5;
const boss = { active: false, phase: 'warning', timer: 0, dodges: 0, passes: 0, x: 0, direction: -1, hit: false };

function introduceBoss() {
  boss.active = true;
  state = 'bossIntro';
  zone = 'park';
  viewY = 0;
  player.x = W / 2;
  player.y = GROUND;
  player.vy = 0;
  player.grounded = true;
  player.airJump = true;
  player.flip = 0;
  people.length = pickups.length = hatches.length = clouds.length = 0;
  keys.clear();
  clearTimeout(toastTimer);
  $('toast').style.opacity = 0;
  $('practice').classList.add('hidden');
  overlay('', 'MOSHIAH RV', 'FINAL BOSS · Dodge five charges. Arrows move. Space jumps.', 'FACE THE RV');
  hud();
}

function startBoss() {
  Object.assign(boss, { active: true, dodges: 0, passes: 0 });
  focus = 3;
  grace = 0;
  invincible = 0;
  player.x = W / 2;
  player.y = GROUND;
  player.vy = 0;
  player.grounded = true;
  player.airJump = true;
  player.flip = 0;
  state = 'running';
  keys.clear();
  $('overlay').classList.add('hidden');
  $('pause').textContent = 'Ⅱ';
  $('pause').setAttribute('aria-label', 'Pause game');
  prepareCharge();
  hud();
}

function prepareCharge() {
  boss.phase = 'warning';
  boss.timer = boss.passes === 0 ? 2.2 : 1.35;
  boss.direction = boss.passes % 2 === 0 ? -1 : 1;
  boss.x = boss.direction < 0 ? W + 220 : -220;
  boss.hit = false;
  tone(120, .18);
}

function winBoss() {
  boss.phase = 'defeated';
  state = 'won';
  keys.clear();
  best = Math.max(best, distance);
  try { localStorage.setItem('cw-best', String(Math.floor(best))); } catch {}
  overlay('', 'RUN COMPLETE', 'All five RV charges dodged. Nice running.', 'RUN AGAIN');
  tone(880, .4);
  hud();
}

function updateBoss(dt) {
  tick += dt;
  player.flip = Math.max(0, player.flip - dt);
  invincible = Math.max(0, invincible - dt);
  const move = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
  if (move) direction = move;
  player.x = Math.max(60, Math.min(W - 60, player.x + move * 320 * dt));
  if (player.grounded && (keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW'))) jump();
  player.vy += 1900 * dt;
  player.y += player.vy * dt;
  if (player.y >= GROUND) { player.y = GROUND; player.vy = 0; player.grounded = true; player.airJump = true; player.flip = 0; }
  if (boss.phase === 'warning') {
    boss.timer -= dt;
    if (boss.timer <= 0) boss.phase = 'charge';
  } else if (boss.phase === 'charge') {
    boss.x += boss.direction * (700 + boss.dodges * 65) * dt;
    // The RV is 200 pixels wide and 80 high; jump above its roof.
    if (!boss.hit && Math.abs(player.x - boss.x) < 110 && player.y > GROUND - 84) {
      boss.hit = true;
      focus--;
      invincible = 1;
      tone(100, .25);
      toast('TOO CLOSE · -1 FOCUS');
      if (focus <= 0) {
        end();
        overlay('', 'THE RV CAUGHT UP', 'Time your jump with the charge. Try the boss again.', 'RETRY BOSS');
        return;
      }
    }
    if ((boss.direction < 0 && boss.x < -220) || (boss.direction > 0 && boss.x > W + 220)) {
      if (!boss.hit) boss.dodges++;
      boss.passes++;
      if (boss.dodges >= BOSS_DODGES) { winBoss(); return; }
      prepareCharge();
    }
  }
  hud();
}

function drawBoss() {
  if (!boss.active) return;
  // Road markings distinguish the boss arena from the park footpath.
  rect(0, GROUND + 7, W, 51, '#727873');
  for (let x = 0; x < W; x += 130) rect(x, GROUND + 31, 65, 5, '#eee2aa');
  if (boss.phase === 'charge') {
    const x = boss.x, y = GROUND;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-boss.direction, 1);
    rect(-98, -76, 156, 62, '#fff1c7');
    rect(-88, -86, 120, 10, '#d5c69c');
    rect(58, -64, 38, 50, '#eee3b9');
    rect(63, -59, 26, 23, '#6b9da7');
    rect(-84, -68, 32, 17, '#6b9da7');
    rect(-45, -68, 32, 17, '#6b9da7');
    rect(-98, -30, 193, 12, '#bd713a');
    rect(-97, -18, 197, 7, '#334943');
    rect(91, -35, 7, 10, '#ffe986');
    for (const wheel of [-58, 60]) {
      ctx.fillStyle = '#202b2c'; ctx.beginPath(); ctx.arc(wheel, -9, 14, 0, Math.PI * 2); ctx.fill();
      rect(wheel - 5, -14, 10, 10, '#b5bdaf');
    }
    ctx.restore();
    // Keep lettering legible when the vehicle turns around.
    text('MOSHIAH RV', x - boss.direction * 15, y - 35, 17, '#543c27', 'center');
  }
}

function drawBossHud() {
  if (!boss.active || state === 'bossIntro') return;
  rect(365, 90, 470, 54, '#203c30');
  text(`MOSHIAH RV · ${boss.dodges}/${BOSS_DODGES} DODGED`, W / 2, 112, 16, '#fff1c7', 'center');
  for (let i = 0; i < BOSS_DODGES; i++) rect(388 + i * 88, 125, 72, 8, i < boss.dodges ? '#dfc96e' : '#506450');
  if (boss.phase === 'warning' && state === 'running') {
    const fromRight = boss.direction < 0;
    const x = fromRight ? W - 155 : 155;
    rect(x - 130, 225, 260, 58, '#fff1c7');
    text(fromRight ? 'RV INCOMING ←' : '→ RV INCOMING', x, 248, 19, '#773f28', 'center');
    text('JUMP OVER THE ROOF', x, 270, 12, '#773f28', 'center');
  }
}

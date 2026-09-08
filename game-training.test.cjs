const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./game-arena-core.js');
const T = require('./game-training.js');

function finishDelay(session) {
  T.tick(session, .5);
  T.tick(session, .5);
}

function skipTo(session, step) {
  while (session.step < step) {
    let target = session.state.enemies.find(enemy => !enemy.dead);
    if (session.step === 0) {
      session.state.x = session.marker.x; session.state.y = session.marker.y;
      T.observe(session, [{ type: 'impact', targetId: target.id, ammo: 'standard' }]);
    } else if (session.step === 1) {
      session.state.x = session.marker.x; session.state.y = session.marker.y; session.state.dash = null;
      T.observe(session, [{ type: 'ability', kind: 'dash' }]);
    } else if (session.step === 2) {
      session.state.specialAmmo.autocannon = 5;
      T.observe(session, [{ type: 'collect', kind: 'autocannon' }, { type: 'trainingInput', code: 'KeyQ' }, { type: 'weaponSwitch', slot: 2, kind: 'autocannon' }]);
      target = session.state.enemies.find(enemy => !enemy.dead);
      session.state.specialAmmo.autocannon--;
      T.observe(session, [{ type: 'impact', targetId: target.id, ammo: 'autocannon' }]);
    } else {
      target.phase = 'stagger'; target.stagger = 1;
      T.observe(session, [{ type: 'warning', kind: 'charger', sourceId: target.id }, { type: 'impact', targetId: target.id, damage: 20, ammo: 'standard' }]);
    }
    T.tick(session, .01);
    finishDelay(session);
  }
  return session;
}

test('create exposes a deterministic isolated first lesson without normal wave activity', () => {
  const a = T.create(C, { machine: 'xm2' });
  const b = T.create(C, { machine: 'xm2' });
  assert.deepEqual([a.step, a.title, a.objective, a.speaker, a.done], [0, b.title, b.objective, b.speaker, false]);
  assert.equal(a.state.machine, 'xm2');
  assert.ok(a.marker && Number.isFinite(a.marker.x) && Number.isFinite(a.marker.y));
  const wave = a.state.wave;
  for (let i = 0; i < 120; i++) {
    C.step(a.state, .05, { firing: false });
    T.observe(a, a.state.events);
    T.tick(a, .05);
  }
  assert.equal(a.state.wave, wave);
  assert.equal(a.state.enemies.filter(enemy => !enemy.dead).length, 1);
});

test('every lesson uses the centred 1600 arena and keeps markers and targets inside it', () => {
  const session=T.create(C);
  for(let step=0;step<5;step++){if(step)skipTo(session,step);const s=session.state;assert.deepEqual(s.worldBounds,{left:0,right:1600,top:0,bottom:1600});assert.deepEqual(s.bounds,{left:60,right:1540,top:60,bottom:1540});if(step===0)assert.deepEqual([s.x,s.y],[800,800]);if(session.marker)assert.ok(session.marker.x-session.marker.r>=s.bounds.left&&session.marker.x+session.marker.r<=s.bounds.right&&session.marker.y-session.marker.r>=s.bounds.top&&session.marker.y+session.marker.r<=s.bounds.bottom);for(const enemy of s.enemies)assert.ok(enemy.x-enemy.r>=s.worldBounds.left&&enemy.x+enemy.r<=s.worldBounds.right&&enemy.y-enemy.r>=s.worldBounds.top&&enemy.y+enemy.r<=s.worldBounds.bottom);}
});

test('the first lesson requires real movement into the marker and a main-cannon impact', () => {
  const session = T.create(C, { machine: 'm1a4' });
  const target = session.state.enemies[0];
  for (let i = 0; i < 100 && !/完成/.test(session.message); i++) {
    C.step(session.state, .05, { moveX: 1, aimX: target.x, aimY: target.y, firing: true });
    T.observe(session, session.state.events);
    T.tick(session, .05);
  }
  assert.match(session.message, /完成/);
  finishDelay(session);
  assert.equal(session.step, 1);
  assert.notEqual(session.state, null);
});

test('the dash lesson accepts only a real dash event followed by a legal landing beyond cover', () => {
  for(const machine of ['m1a4','m4a3','xm2']){const session = skipTo(T.create(C,{machine}), 1);
    const cover = session.state.obstacles.find(obstacle => obstacle.kind === 'cover');
    session.state.x = session.marker.x;T.tick(session, 2);assert.equal(session.step, 1);
    session.state.x = cover.x - cover.w / 2 - 60;session.state.y = cover.y;session.state.events = [];
    assert.equal(C.useAbility(session.state, 'dash', { moveX: 1 }), true,`${machine} has no legal dash`);T.observe(session, session.state.events);
    for (let i = 0; i < 20 && session.state.dash; i++){C.step(session.state, .05, { firing: false });T.observe(session,session.state.events);T.tick(session,.05);}
    T.tick(session, .05);assert.ok(Math.hypot(session.state.x-session.marker.x,session.state.y-session.marker.y)<=session.marker.r,`${machine} missed the marker`);assert.match(session.message, /完成/);
  }
});

test('the weapon lesson requires pickup, a real Q input, switch, ammo use, and impact', () => {
  const session = skipTo(T.create(C), 2);
  assert.equal(session.state.enemies.length, 0);
  const box = session.state.crates.find(crate => crate.kind === 'autocannon');
  session.state.x = box.x;
  session.state.y = box.y;
  C.step(session.state, .05, { firing: false });
  T.observe(session, session.state.events);
  session.state.events = [];
  C.step(session.state, .05, { firing: false, weaponSlot: 2 });
  T.observe(session, session.state.events);
  T.observe(session, [{ type: 'impact', targetId: 999, ammo: 'autocannon' }]);
  T.tick(session, 1.1);
  assert.equal(session.step, 2, 'Digit2-style switching must not stand in for Q practice');
  T.observe(session, { type: 'trainingInput', code: 'KeyQ' });
  T.observe(session, [{ type: 'weaponSwitch', slot: 2, kind: 'autocannon' }]);
  const target = session.state.enemies.find(enemy => !enemy.dead);
  assert.equal(target.type,'normal');
  const before = session.state.specialAmmo.autocannon;
  session.state.specialAmmo.autocannon--;
  T.observe(session, [{ type: 'impact', targetId: target.id, ammo: 'autocannon' }]);
  T.tick(session, .05);
  assert.ok(session.state.specialAmmo.autocannon < before);
  assert.match(session.message, /完成/);
});

test('the weapon lesson can be read for five seconds before Q without spawning or resetting a target', () => {
  const session=skipTo(T.create(C),2),state=session.state;
  for(let i=0;i<100;i++){C.step(session.state,.05,{firing:true});T.observe(session,session.state.events);T.tick(session,.05);}
  assert.equal(session.state,state);assert.equal(session.step,2);assert.equal(session.state.enemies.length,0);assert.match(session.message,/按 Q/);
  T.observe(session,{type:'trainingInput',code:'KeyQ'});session.state.events=[];C.step(session.state,.05,{firing:false,weaponSlot:2});T.observe(session,session.state.events);T.tick(session,.05);
  assert.equal(session.state.enemies.filter(enemy=>!enemy.dead).length,1);assert.match(session.message,/瞄準/);
});

test('the counter lesson requires a warned charger miss and damage during stagger', () => {
  const session = skipTo(T.create(C), 3);
  assert.doesNotMatch(session.objective, /stagger/);
  const charger = session.state.enemies.find(enemy => enemy.type === 'charger');
  T.observe(session, [{ type: 'warning', kind: 'charger', sourceId: charger.id }]);
  charger.phase = 'stagger';
  charger.stagger = 1;
  T.observe(session, [{ type: 'impact', targetId: charger.id, damage: 20, ammo: 'standard' }]);
  T.tick(session, .05);
  assert.match(session.message, /完成/);

  const retry = skipTo(T.create(C), 3);
  const failedState = retry.state;
  const failed = retry.state.enemies.find(enemy => enemy.type === 'charger');
  T.observe(retry, [{ type: 'warning', kind: 'charger', sourceId: failed.id }, { type: 'hurt', source: { sourceId: failed.id } }]);
  T.tick(retry, .05);
  assert.equal(retry.step, 3);
  assert.notEqual(retry.state, failedState);
  assert.match(retry.message, /重新/);
});

test('a required target dying too early rebuilds that lesson instead of deadlocking', () => {
  for(const step of [2,3,4]){const session=skipTo(T.create(C),step),before=session.state;
    if(step===2){session.state.specialAmmo.autocannon=5;T.observe(session,[{type:'collect',kind:'autocannon'},{type:'trainingInput',code:'KeyQ'},{type:'weaponSwitch',slot:2,kind:'autocannon'}]);const target=session.state.enemies.find(enemy=>!enemy.dead);session.state.aimX=target.x;session.state.aimY=target.y;for(let i=0;i<100&&session.state===before;i++){C.step(session.state,.05,{aimX:target.x,aimY:target.y,firing:true});T.observe(session,session.state.events);T.tick(session,.05);}}
    else if(step===3){const target=session.state.enemies.find(enemy=>enemy.type==='charger');target.stagger=999;for(let i=0;i<200&&session.state===before;i++){C.step(session.state,.05,{aimX:target.x,aimY:target.y,firing:true});T.observe(session,session.state.events);T.tick(session,.05);}}
    else{for(const target of [...session.state.enemies])for(let i=0;i<30&&session.state===before&&!target.dead;i++){C.step(session.state,.05,{aimX:target.x,aimY:target.y,firing:true});T.observe(session,session.state.events);T.tick(session,.05);}}
    assert.notEqual(session.state,before,`step ${step} kept a state with no required target`);assert.equal(session.step,step);assert.match(session.message,/已重新/);
  }
});

test('the support lesson requires prior blocking, clearing all six flock members, and successful support', () => {
  const session = skipTo(T.create(C), 4);
  const flock = session.state.enemies.filter(enemy => enemy.type === 'swarm');
  assert.equal(flock.length, 6);
  C.step(session.state, .05, { firing: false });
  T.observe(session, session.state.events);
  const charges = session.state.charges;
  session.state.events = [];
  assert.equal(C.useTactic(session.state), false);
  T.observe(session, session.state.events);
  assert.equal(session.state.charges, charges);
  for (const enemy of flock) C.damageEnemy(session.state, enemy, enemy.hp);
  C.step(session.state, .05, { firing: false });
  T.observe(session, session.state.events);
  const clearedState=session.state;T.tick(session,.05);
  assert.equal(session.state,clearedState);assert.match(session.message,/鏈路恢復.*Space/);
  C.step(session.state,.05,{firing:false});T.observe(session,session.state.events);
  session.state.events = [];
  assert.equal(C.useTactic(session.state), true);
  T.observe(session, session.state.events);
  T.tick(session, .05);
  assert.equal(session.state.charges, charges - 1);
  assert.match(session.message, /完成/);
  finishDelay(session);
  assert.equal(session.done, true);
});

test('skip ends the whole training as skipped and dispose drops an active isolated state', () => {
  const session = T.create(C);
  assert.equal(T.skip(session), null);
  assert.equal(session.step, 0);
  assert.equal(session.done, true);
  assert.equal(session.skipped, true);
  assert.equal(session.state, null);
  const active = T.create(C);
  assert.equal(T.dispose(active), null);
  assert.equal(active.state, null);
});

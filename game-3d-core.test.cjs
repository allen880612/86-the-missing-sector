const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('./game-3d-core.js');

function playing(seed = 7) {
  const state = Core.create({ seed });
  Core.start(state);
  stepFor(state, 1.25);
  assert.equal(state.phase, 'playing');
  return state;
}

function stepFor(state, seconds, input = {}) {
  for (let left = seconds; left > 1e-8; left -= 0.05) {
    Core.step(state, input, Math.min(0.05, left));
  }
}

function relay(id, x, z, hp = 100) {
  return { id, kind: 'relay', x, z, angle: 0, aimAngle: 0, moving: false,
    speed: 0, jumpHeight: 0, recoil: 0, hp, maxHp: hp, phase: 'idle', radius: 1.1 };
}

test('exports the renderer-facing state contract and start is reusable', () => {
  const state = Core.create({ seed: 31 });
  assert.deepEqual(Object.keys(state).sort(), [
    'effects', 'enemies', 'events', 'objective', 'obstacles', 'phase',
    'player', 'projectiles', 'stats', 'time'
  ]);
  assert.equal(state.phase, 'ready');
  assert.deepEqual(
    ['id', 'kind', 'x', 'z', 'angle', 'aimAngle', 'moving', 'speed', 'jumpHeight',
      'recoil', 'hp', 'maxHp', 'phase', 'jumpCd', 'skillCd', 'supportCd']
      .filter((key) => !(key in state.player)),
    []
  );
  assert.deepEqual(state.events, []);
  Core.start(state);
  assert.equal(state.phase, 'launching');
});

test('high walls stop bullets and timed leaps', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [{ id: 'high', x: 3, z: 0, w: 1, d: 7, h: 3.2,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [relay('target', 9, 0)];
  const hp = state.enemies[0].hp;
  Core.step(state, { moveX: 1, moveZ: 0, aimX: 9, aimZ: 0, jump: true }, 0.05);
  stepFor(state, 1.6, { moveX: 1, moveZ: 0, aimX: 9, aimZ: 0 });
  assert.ok(state.player.x < 1.7, `high wall let leap reach x=${state.player.x}`);
  assert.equal(state.enemies[0].hp, hp, 'shots may not cross a high wall');
});

test('low walls stop bullets but a leap clears them', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [{ id: 'low', x: 3, z: 0, w: 1, d: 7, h: 2.6,
    type: 'low', hp: 999, maxHp: 999 }];
  state.enemies = [relay('target', 9, 0)];
  const hp = state.enemies[0].hp;
  Core.step(state, { moveX: 1, moveZ: 0, aimX: 9, aimZ: 0, jump: true }, 0.05);
  let peak = state.player.jumpHeight;
  for (let i = 0; i < 19; i++) {
    Core.step(state, { moveX: 1, moveZ: 0, aimX: 9, aimZ: 0 }, 0.05);
    peak = Math.max(peak, state.player.jumpHeight);
  }
  assert.ok(peak >= 3.1, `leap peak ${peak} did not clear the visible wall`);
  assert.ok(state.player.x > 5, `leap did not clear low wall: x=${state.player.x}`);
  assert.equal(state.enemies[0].hp, hp, 'ordinary shells may not cross a low wall');
});

test('default low walls visibly cover both cannon muzzles', () => {
  const state = Core.create({ seed: 3 });
  const lows = state.obstacles.filter((wall) => wall.type === 'low');
  assert.ok(lows.length > 0);
  assert.ok(lows.every((wall) => wall.h > 2.45), lows.map((wall) => wall.h).join(','));
});

test('descending over a wide low wall returns to the last safe ground position', () => {
  const state = playing();
  state.player.x = -2; state.player.z = 0;
  state.obstacles = [{ id: 'wide-low', x: 5, z: 0, w: 10, d: 6, h: 2.6,
    type: 'low', hp: 999, maxHp: 999 }];
  state.enemies = [];
  Core.step(state, { moveX: 1, aimX: 12, aimZ: 0, jump: true }, 0.05);
  stepFor(state, 1, { moveX: 1, aimX: 12, aimZ: 0 });
  const inside = state.player.x > -0.85 && state.player.x < 10.85 &&
    state.player.z > -3.85 && state.player.z < 3.85;
  assert.equal(inside, false, `player landed inside low wall at x=${state.player.x}`);
  assert.equal(state.player.jumpHeight, 0);
});

test('diagonal leap into a high wall interrupts instead of sliding through it', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [{ id: 'high', x: 3, z: -1, w: 1, d: 6, h: 3.8,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [];
  Core.step(state, { moveX: 1, moveZ: -0.4, aimX: 10, aimZ: -4, jump: true }, 0.05);
  stepFor(state, 0.35, { moveX: 1, moveZ: -0.4, aimX: 10, aimZ: -4 });
  assert.equal(state.player.jumpHeight, 0);
  assert.notEqual(state.player.phase, 'leap');
  assert.ok(state.player.x < 1.7);
});

test('walking cannot cross a heavy body and a leap cannot cross it either', () => {
  function approach(jump) {
    const state = playing();
    state.player.x = 0; state.player.z = 0; state.obstacles = [];
    state.enemies = [{ ...relay('heavy', 4, 0, 500), kind: 'heavy', radius: 1.8,
      speed: 0, attackCd: 99 }];
    Core.step(state, { moveX: 1, aimX: 0, aimZ: -10, jump }, 0.05);
    stepFor(state, 1, { moveX: 1, aimX: 0, aimZ: -10 });
    return state;
  }
  const walking = approach(false);
  assert.ok(walking.player.x <= 1.36, `walk crossed heavy to x=${walking.player.x}`);
  const leaping = approach(true);
  assert.ok(leaping.player.x <= 1.36, `leap crossed heavy to x=${leaping.player.x}`);
  assert.equal(leaping.player.jumpHeight, 0);
});

test('a high leap can cross a small enemy body', () => {
  const walking = playing();
  walking.player.x = 0; walking.player.z = 0; walking.obstacles = [];
  walking.enemies = [{ ...relay('scout', 4, 0, 500), kind: 'scout', radius: 0.75,
    speed: 0 }];
  stepFor(walking, 1, { moveX: 1, aimX: 0, aimZ: -10 });
  assert.ok(walking.player.x <= 2.41, `walk crossed scout to x=${walking.player.x}`);

  const state = playing();
  state.player.x = 0; state.player.z = 0; state.obstacles = [];
  state.enemies = [{ ...relay('scout', 4, 0, 500), kind: 'scout', radius: 0.75,
    speed: 0 }];
  Core.step(state, { moveX: 1, aimX: 0, aimZ: -10, jump: true }, 0.05);
  stepFor(state, 0.9, { moveX: 1, aimX: 0, aimZ: -10 });
  assert.ok(state.player.x > 6, `leap failed to cross scout: x=${state.player.x}`);
});

test('ordinary movement slides along walls without entering or sticking', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [{ id: 'wall', x: 2, z: 0, w: 1, d: 8, h: 3,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [];
  for (let i = 0; i < 20; i++) {
    Core.step(state, { moveX: 1, moveZ: -1, aimX: 5, aimZ: -5 }, 0.05);
    const inside = state.player.x > 0.65 && state.player.x < 3.35 &&
      state.player.z > -4.85 && state.player.z < 4.85;
    assert.equal(inside, false, `player entered wall at ${state.player.x},${state.player.z}`);
  }
  assert.ok(state.player.z < -2, `player failed to slide along wall: z=${state.player.z}`);
  stepFor(state, 0.5, { moveX: -1, moveZ: 0, aimX: -5, aimZ: 0 });
  assert.ok(state.player.x < -1, 'player remained stuck after steering away');
});

test('scout observation makes heavy warning follow, then lock the last position', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 8;
  state.obstacles = [];
  state.enemies = [
    { ...relay('scout', 0, 0, 45), kind: 'scout', speed: 3.5 },
    { ...relay('heavy', 0, -13, 240), kind: 'heavy', radius: 1.8 }
  ];
  let trackingEffect;
  for (let i = 0; i < 80 && !trackingEffect; i++) {
    Core.step(state, { aimX: 0, aimZ: -13 }, 0.05);
    trackingEffect = state.effects.find((fx) => fx.type === 'heavy-warning' && fx.tracking);
  }
  assert.ok(trackingEffect, 'heavy never exposed its tracking warning');
  state.player.x = 2;
  let lockedEffect;
  for (let i = 0; i < 80 && !lockedEffect; i++) {
    Core.step(state, { aimX: 0, aimZ: -13 }, 0.05);
    lockedEffect = state.effects.find((fx) => fx.type === 'heavy-warning' && fx.locked);
  }
  assert.ok(lockedEffect, 'heavy warning never became a locked telegraph');
  const lockedX = lockedEffect.x;
  state.player.x = 7;
  let fired;
  for (let i = 0; i < 80 && !fired; i++) {
    Core.step(state, { aimX: 0, aimZ: -13 }, 0.05);
    fired = state.events.find((event) => event.type === 'heavyFire');
  }
  assert.ok(fired, 'heavy never fired after its warning');
  assert.equal(fired.targetX, lockedX, 'locked shot continued following the player');
  assert.equal(typeof lockedEffect.toX, 'number');
  assert.equal(typeof lockedEffect.toZ, 'number');
});

test('hunter locks a visible lunge, can miss, then exposes a punishment window', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [];
  state.enemies = [{ ...relay('hunter', 0, -7, 80), kind: 'hunter', speed: 7.5 }];
  let warning;
  for (let i = 0; i < 60 && !warning; i++) {
    Core.step(state, { aimX: 0, aimZ: -7 }, 0.05);
    warning = state.effects.find((fx) => fx.type === 'hunter-warning');
  }
  assert.ok(warning, 'hunter lunge had no warning');
  assert.equal(typeof warning.toX, 'number');
  const startZ = state.enemies[0].z;
  stepFor(state, 0.65, { aimX: 0, aimZ: -7 });
  assert.equal(state.enemies[0].phase, 'dash');
  assert.ok(state.enemies[0].z > startZ && state.enemies[0].z < -0.5,
    `hunter did not visibly traverse its lunge: z=${state.enemies[0].z}`);
  state.player.x = 7;
  stepFor(state, 0.5, { moveX: 1, aimX: 0, aimZ: -7 });
  assert.equal(state.enemies[0].phase, 'exposed');
  assert.equal(state.player.hp, state.player.maxHp, 'escaped lunge still dealt damage');
});

test('hunter dash stops at a high wall and cannot hit through it', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [];
  state.enemies = [{ ...relay('hunter', 0, -7, 80), kind: 'hunter', speed: 7.5 }];
  stepFor(state, 0.35, { aimX: 0, aimZ: -7 });
  assert.equal(state.enemies[0].phase, 'windup');
  state.obstacles = [{ id: 'block', x: 0, z: -3, w: 6, d: 1, h: 3,
    type: 'high', hp: 999, maxHp: 999 }];
  stepFor(state, 0.9, { aimX: 0, aimZ: -7 });
  assert.ok(state.enemies[0].z < -4.3, `hunter crossed wall to z=${state.enemies[0].z}`);
  assert.equal(state.player.hp, state.player.maxHp);
  assert.equal(state.enemies[0].phase, 'exposed');
});

test('player shells originate at the forward muzzle and cannot skip a wall beside the hull', () => {
  const clear = playing();
  clear.player.x = 0; clear.player.z = 0; clear.obstacles = [];
  clear.enemies = [relay('target', 9, 0)];
  Core.step(clear, { aimX: 9, aimZ: 0 }, 0.05);
  const fire = clear.events.find((event) => event.type === 'mainFire');
  assert.ok(fire.x > 3.59 && fire.x < 3.63, `event origin ${fire.x} did not match the muzzle`);
  assert.equal(clear.projectiles[0].height, 1.72);
  assert.ok(clear.projectiles[0].x > fire.x, 'projectile did not advance from its muzzle origin');
  assert.ok(Math.abs(clear.player.aimAngle + Math.PI / 2) < 0.01);

  const blocked = playing();
  blocked.player.x = 0; blocked.player.z = 0;
  blocked.obstacles = [{ id: 'muzzle-wall', x: 1.5, z: 0, w: 0.5, d: 5, h: 3,
    type: 'high', hp: 999, maxHp: 999 }];
  blocked.enemies = [relay('target', 9, 0)];
  Core.step(blocked, { aimX: 9, aimZ: 0 }, 0.05);
  assert.equal(blocked.projectiles.length, 0);
  assert.ok(blocked.events.some((event) => event.type === 'wallHit'));
});

test('heavy beam ends at the first wall instead of drawing through blocked cover', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 6;
  state.obstacles = [{ id: 'beam-wall', x: 0, z: -2, w: 7, d: 1, h: 3,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [{ ...relay('heavy', 0, -10, 240), kind: 'heavy', speed: 0,
    radius: 1.8, phase: 'locking', phaseTime: 0.01, targetX: 0, targetZ: 6 }];
  Core.step(state, {}, 0.05);
  const shot = state.effects.find((fx) => fx.type === 'heavy-shot');
  assert.ok(shot);
  assert.equal(shot.height, 2.45);
  assert.ok(shot.z > -4.1 && shot.z < -3.8, `heavy origin ${shot.z} missed its muzzle`);
  assert.ok(shot.toZ < -1.4, `beam crossed wall to z=${shot.toZ}`);
  assert.ok(shot.toZ > -2.7, `beam stopped before wall at z=${shot.toZ}`);
});

test('heavy acquires nearby targets itself and moves to clear a blocked firing line', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 6;
  state.obstacles = [{ id: 'screen', x: 0, z: -2, w: 7, d: 1, h: 3,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [{ ...relay('heavy', 0, -10, 240), kind: 'heavy', speed: 1.8, radius: 1.8 }];
  stepFor(state, 0.5, { aimX: 0, aimZ: -10 });
  assert.notEqual(state.enemies[0].x, 0, 'blocked heavy remained stationary');
  state.obstacles = [];
  let warning;
  for (let i = 0; i < 30 && !warning; i++) {
    Core.step(state, { aimX: 0, aimZ: -10 }, 0.05);
    warning = state.effects.find((fx) => fx.type === 'heavy-warning');
  }
  assert.ok(warning, 'heavy failed to acquire a nearby target without a scout');
});

test('heavy armour rewards firing during its warned-shot recovery window', () => {
  function damageIn(phase) {
    const state = playing();
    state.player.x = 0; state.player.z = 0; state.obstacles = [];
    state.enemies = [{ ...relay('heavy', 8, 0, 100), kind: 'heavy', radius: 1.8,
      phase, phaseTime: 10, attackCd: 99 }];
    stepFor(state, 0.25, { aimX: 8, aimZ: 0 });
    return 100 - state.enemies[0].hp;
  }
  assert.equal(damageIn('idle'), 2.75);
  assert.equal(damageIn('recover'), 11);
});

test('supplies are collected by proximity and are ignored by automatic fire', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0; state.player.hp = 60;
  state.obstacles = [];
  state.enemies = [{ ...relay('supply', 4, 0, 35), kind: 'supply' }];
  stepFor(state, 0.7, { aimX: 4, aimZ: 0 });
  assert.equal(state.enemies[0].hp, 35, 'automatic cannon targeted a supply');
  state.player.x = 3.2;
  Core.step(state, {}, 0.05);
  assert.equal(state.enemies.some((enemy) => enemy.id === 'supply'), false);
  assert.equal(state.player.hp, 78);
  assert.equal(state.stats.supplies, 1);
});

test('blade and support have visible phases, damage nearby enemies, and start cooldowns', () => {
  const state = playing();
  state.obstacles = [];
  state.player.x = 0; state.player.z = 0;
  state.enemies = [relay('near', 0, -2.5, 100), relay('support-target', 8, 0, 100)];
  Core.step(state, { aimX: 0, aimZ: -10, skill: true }, 0.05);
  assert.ok(state.enemies[0].hp < 100);
  assert.ok(state.player.skillCd > 0);
  assert.ok(state.effects.some((fx) => fx.type === 'blade'));
  Core.step(state, { aimX: 8, aimZ: 0, support: true }, 0.05);
  assert.ok(state.player.supportCd > 0);
  assert.ok(state.effects.some((fx) => fx.type === 'support-warning'));
  stepFor(state, 0.9, { aimX: 8, aimZ: 0 });
  assert.ok(state.enemies[1].hp < 100, 'support impact caused no area damage');
  assert.ok(state.events.some((event) => event.type === 'supportImpact') ||
    state.effects.some((fx) => fx.type === 'support-impact'));
});

test('high walls block blade damage but do not block area support', () => {
  const state = playing();
  state.player.x = 0; state.player.z = 0;
  state.obstacles = [{ id: 'blade-wall', x: 0, z: -1.25, w: 4, d: 0.5, h: 3.8,
    type: 'high', hp: 999, maxHp: 999 }];
  state.enemies = [relay('behind-wall', 0, -2.7, 100)];
  Core.step(state, { aimX: 0, aimZ: -10, skill: true }, 0.05);
  assert.equal(state.enemies[0].hp, 100, 'blade reached through a high wall');

  state.player.skillCd = 0;
  state.obstacles = [];
  Core.step(state, { aimX: 0, aimZ: -10, skill: true }, 0.05);
  assert.ok(state.enemies[0].hp < 100, 'unobstructed blade caused no damage');

  state.enemies[0].hp = 100;
  state.obstacles = [{ id: 'support-wall', x: 0, z: -1.25, w: 4, d: 0.5, h: 3.8,
    type: 'high', hp: 999, maxHp: 999 }];
  Core.step(state, { aimX: 0, aimZ: -2.7, support: true }, 0.05);
  stepFor(state, 0.9, { aimX: 0, aimZ: -2.7 });
  assert.ok(state.enemies[0].hp < 100, 'area support was incorrectly stopped by the wall');
});

test('expired projectiles and effects are removed and events reset every step', () => {
  const state = playing();
  state.enemies = [];
  state.projectiles = [{ id: 'spent', x: 0, z: 0, dx: 1, dz: 0,
    enemy: false, damage: 1, radius: 0.1, speed: 1, life: 0.01 }];
  state.effects = [{ id: 'fading', type: 'spark', x: 0, z: 0,
    radius: 1, life: 0.01, maxLife: 0.01 }];
  state.events = [{ type: 'stale', x: 0, z: 0 }];
  Core.step(state, {}, 0.05);
  assert.equal(state.projectiles.some((shot) => shot.id === 'spent'), false);
  assert.equal(state.effects.some((fx) => fx.id === 'fading'), false);
  assert.equal(state.events.some((event) => event.type === 'stale'), false);
});

test('lethal damage enters settling before the fixed defeat result', () => {
  const state = playing();
  state.obstacles = [];
  state.enemies = [];
  state.player.hp = 5;
  state.projectiles = [{ id: 'fatal', x: state.player.x, z: state.player.z,
    dx: 0, dz: 0, enemy: true, damage: 10, radius: 0.3, speed: 0, life: 1 }];
  Core.step(state, {}, 0.05);
  assert.equal(state.player.hp, 0);
  assert.equal(state.phase, 'settling');
  stepFor(state, 0.4);
  assert.equal(state.phase, 'settling');
  stepFor(state, 0.9);
  assert.equal(state.phase, 'lost');
  assert.equal(state.stats.result, 'lost');
});

test('clearing mandatory targets activates extraction and arrival settles to victory', () => {
  const state = playing();
  for (let wave = 0; wave < 3; wave++) {
    state.enemies.forEach((enemy) => { enemy.hp = 0; });
    Core.step(state, {}, 0.05);
  }
  assert.equal(state.stats.spawned, state.stats.spawnLimit);
  assert.equal(state.objective.extraction.active, true);
  state.player.x = state.objective.extraction.x;
  state.player.z = state.objective.extraction.z;
  Core.step(state, {}, 0.05);
  assert.equal(state.phase, 'settling');
  stepFor(state, 1.3);
  assert.equal(state.phase, 'won');
  assert.equal(state.stats.result, 'won');
});

test('reinforcements are finite and retry restores a deterministic fresh sortie', () => {
  const state = playing(91);
  state.player.hp = 9999; state.player.maxHp = 9999;
  for (let i = 0; i < 2400 && state.phase === 'playing'; i++) Core.step(state, {}, 0.1);
  assert.ok(state.stats.spawned <= state.stats.spawnLimit,
    `${state.stats.spawned} exceeded finite limit ${state.stats.spawnLimit}`);
  assert.ok(state.enemies.length <= state.stats.spawnLimit);
  state.phase = 'lost'; state.player.hp = 0; state.stats.result = 'lost';
  Core.start(state);
  assert.equal(state.phase, 'launching');
  assert.equal(state.player.hp, state.player.maxHp);
  assert.equal(state.stats.spawned, Core.create({ seed: 91 }).stats.spawned);
  assert.equal(state.enemies.length, Core.create({ seed: 91 }).enemies.length);
});

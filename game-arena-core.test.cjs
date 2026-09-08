const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./game-arena-core.js');

const state = (random = () => 0.5, options = {}) =>
  C.setup(C.create(random), { machine: 'm1a4', ...options });

function quiet(s) {
  s.spawn = 999;
  s.boss = 999;
  s.pickupTimer = 999;
  return s;
}

test('setup creates the arena state at the world centre', () => {
  const s = state();
  assert.equal(s.mode, 'endless');
  assert.equal(s.arena, true);
  assert.deepEqual([s.x, s.y], [500, 500]);
  assert.deepEqual(s.bounds, { left: 90, right: 910, top: 120, bottom: 900 });
  assert.equal(s.shield, 25);
  assert.deepEqual(s.obstacles.map(o => [o.x, o.y, o.w, o.h, o.dead]), [
    [290, 330, 110, 90, false], [710, 360, 130, 70, false],
    [320, 700, 140, 70, false], [700, 700, 100, 100, false]
  ]);
  for (const key of ['walk','scroll','brace','momentum','blade','overdrive','combo']) assert.equal(s[key], 0);
});

test('armor absorbs nonlethal damage before hp and reports the absorbed amount', () => {
  const s = quiet(state());
  assert.equal(C.hurt(s, 15, false, { kind: 'contact' }), 0);
  assert.deepEqual([s.shield, s.hp], [10, s.maxHp]);
  assert.deepEqual(s.events.at(-2), { type: 'shieldAbsorb', x: 500, y: 500, amount: 15, before: 25, after: 10 });
  assert.equal(s.events.at(-1).absorbed, 15);
  s.invulnerable = 0;
  assert.equal(C.hurt(s, 20, false, { kind: 'contact' }), 10);
  assert.deepEqual([s.shield, s.hp], [0, s.maxHp - 10]);
});

test('every arena supply kind has a real effect and EMP interrupts nearby windups', () => {
  const cases = [
    ['repair', s => { s.hp = 40; }, s => assert.equal(s.hp, 70)],
    ['shield', s => { s.shield = 0; }, s => assert.equal(s.shield, 35)],
    ['charge', s => { s.charges = 1; }, s => assert.equal(s.charges, 2)],
    ['recruit', s => { s.count = 3; }, s => assert.equal(s.count, 4)],
    ['weapon', s => {}, s => assert.equal(s.level, 1)],
    ['ap', s => {}, s => assert.equal(s.ammo, 'ap')],
    ['he', s => {}, s => assert.equal(s.ammo, 'he')],
    ['overdrive', s => {}, s => assert.equal(s.overdrive, 7)]
  ];
  for (const [kind, arrange, verify] of cases) {
    const s = quiet(state()); arrange(s);
    assert.equal(C.collect(s, { id: 1, kind, x: 500, y: 500, used: false }), true, kind);
    verify(s);
    const event = s.events.find(e => e.type === 'collect');
    for (const key of ['hp', 'shield', 'charges', 'count', 'level', 'overdrive', 'ammo']) assert.ok(key in event.before && key in event.after);
  }

  const emp = quiet(state());
  const charger = C.spawnEnemy(emp, 'charger', 600, 500); charger.phase = 'windup'; charger.windup = .8;
  C.addHazard(emp, 'beam', charger, 'charge', { x: 500, y: 500, width: 40 }, .8, 0);
  assert.equal(C.collect(emp, { id: 2, kind: 'emp', x: 500, y: 500, used: false }), true);
  assert.equal(charger.phase, 'stagger');
  assert.ok(charger.stagger >= 1);
  assert.ok(!emp.hazards.some(h => h.source === charger.id && !h.fired));
  assert.ok(emp.events.some(e => e.type === 'emp' && e.hits.some(hit => hit.id === charger.id)));
});

test('first supply pair is shield and weapon, later pairs split survival and offense', () => {
  const s = state(() => .5); s.spawn = s.boss = 999;
  assert.equal(s.pickupTimer, 8);
  for (let i = 0; i < 160; i++) C.step(s, .05, { firing: false });
  assert.deepEqual(s.crates.map(box => box.kind), ['shield', 'weapon']);
  for (const box of s.crates) box.used = true;
  C.step(s, .05, { firing: false });
  for (let i = 0; i < 400; i++) C.step(s, .05, { firing: false });
  const survival = new Set(['repair', 'shield', 'recruit']);
  const offense = new Set(['weapon', 'charge', 'ap', 'he', 'overdrive', 'emp']);
  assert.equal(s.crates.length, 2);
  assert.ok(survival.has(s.crates[0].kind));
  assert.ok(offense.has(s.crates[1].kind));
});

test('each wingman independently fires at its nearest target from its own formation slot', () => {
  const s = quiet(state()); s.count = 4;
  const targets = [[620, 542], [380, 542], [500, 680]].map(([x, y]) => { const e = C.spawnEnemy(s, 'normal', x, y); e.speed = 0; return e; });
  C.step(s, .05, { aimX: 500, aimY: 200, firing: false });
  const shots = s.bullets.filter(b => b.ammo === 'wing');
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map(b => [Math.round(b.px), Math.round(b.py)]), [[538, 542], [462, 542], [500, 584]]);
  assert.ok(shots[0].vx > 0 && Math.abs(shots[0].vy) < 1);
  assert.ok(shots[1].vx < 0 && Math.abs(shots[1].vy) < 1);
  assert.ok(shots[2].vy > 0 && Math.abs(shots[2].vx) < 1);
  assert.equal(new Set(shots.map(b => b.targetId)).size, targets.length);
});

test('a wingman acquires a nearby boss when it is the nearest enemy', () => {
  const s = quiet(state()); s.count = 2;
  const boss = C.spawnSpecial(s, 'dinosauria', 740, 542); boss.speed = 0;
  C.step(s, .05, { aimX: 500, aimY: 200, firing: false });
  const shots = s.bullets.filter(b => b.ammo === 'wing');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].targetId, boss.id);
  assert.ok(shots[0].vx > 0);
});

test('player and enemies cannot cross obstacles or each other at high speed', () => {
  const s = quiet(state());
  s.x = 190; s.y = 330;
  C.step(s, .5, { moveX: 1, moveY: 0, aimX: 900, aimY: 330, firing: false });
  assert.ok(s.x <= 213.001, `player stopped at ${s.x}`);

  const enemy = C.spawnEnemy(s, 'normal', 200, 330);
  enemy.speed = 1600;
  C.step(s, .05, { moveX: 0, moveY: 0, aimX: 900, aimY: 330, firing: false });
  assert.ok(enemy.x <= 217.001, `enemy stopped at ${enemy.x}`);

  const blocker = C.spawnEnemy(s, 'normal', 150, 500);
  const mover = C.spawnEnemy(s, 'normal', 100, 500);
  blocker.speed = 0; mover.speed = 1000;
  C.step(s, .05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.ok(Math.hypot(mover.x - blocker.x, mover.y - blocker.y) >= mover.r + blocker.r - .01);
});

test('an enemy routes around an obstacle instead of remaining pressed against it', () => {
  const s = quiet(state());
  s.count = 1;
  s.x = 500; s.y = 330;
  const e = C.spawnEnemy(s, 'normal', 170, 330);
  let maxDetour = 0;
  for (let i = 0; i < 120; i++) {
    C.step(s, .05, { moveX: 0, moveY: 0, aimX: 900, aimY: 330, firing: false });
    maxDetour = Math.max(maxDetour, Math.abs(e.y - 330));
  }
  assert.ok(e.x > 355, `enemy routed to x=${e.x}, y=${e.y}`);
  assert.ok(maxDetour > 45, 'route should pass above or below the rectangle');
});

test('the first living obstacle blocks shells and beams while mortar crosses it', () => {
  const shell = quiet(state());
  shell.count = 1; shell.x = 500; shell.y = 360;
  const target = C.spawnEnemy(shell, 'normal', 850, 360); target.speed = 0;
  C.step(shell, .05, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: true });
  for (let i = 0; i < 12; i++) C.step(shell, .05, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: false });
  assert.equal(target.hp, target.max);
  assert.ok(shell.obstacles[1].hp < shell.obstacles[1].max);
  assert.ok(shell.obstacles[1].hp > 170, 'ordinary fire should not erase terrain in a few shots');

  const beam = quiet(state()); beam.x = 850; beam.y = 360;
  const source = { id: 88, type: 'boss', model: 'morpho', x: 500, y: 360 };
  C.addHazard(beam, 'beam', source, 'rail', { x: 900, y: 360, width: 40 }, 0, 21);
  C.step(beam, .01, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: false });
  assert.equal(beam.hp, beam.maxHp);
  assert.ok(beam.events.some(e => e.type === 'cannon' && e.toX < 850 && e.blockedBy));

  const mortar = quiet(state()); mortar.x = 850; mortar.y = 360; mortar.shield = 0;
  C.addHazard(mortar, 'circle', source, 'mortar', { x: 850, y: 360, r: 40 }, 0, 17);
  C.step(mortar, .01, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: false });
  assert.equal(mortar.hp, mortar.maxHp - 17);
});

test('heavy beam destroys cover on this attack but remains blocked until the next beam', () => {
  const s = quiet(state()); s.x = 850; s.y = 360; s.shield = 0;
  const cover = s.obstacles[1]; cover.hp = 1;
  const source = { id: 89, type: 'boss', model: 'morpho', x: 500, y: 360 };
  C.addHazard(s, 'beam', source, 'rail', { x: 900, y: 360, width: 54, heavy: true }, 0, 30);
  C.step(s, .01, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: false });
  assert.equal(cover.dead, true);
  assert.equal(s.hp, s.maxHp);
  s.invulnerable = 0;
  C.addHazard(s, 'beam', source, 'rail', { x: 900, y: 360, width: 54, heavy: true }, 0, 30);
  C.step(s, .01, { moveX: 0, moveY: 0, aimX: 900, aimY: 360, firing: false });
  assert.equal(s.hp, s.maxHp - 30);

  const durable = quiet(state()); durable.x = 850; durable.y = 360;
  C.addHazard(durable, 'beam', source, 'rail', { x: 900, y: 360, width: 54, heavy: true }, 0, 30);
  C.step(durable, .01, { firing: false });
  assert.equal(durable.obstacles[1].hp, 100);
});

test('fire defaults on, burst accelerates it, and dash respects collision', () => {
  const automatic = quiet(state()); automatic.count = 1;
  C.step(automatic, .01, { aimX: 900, aimY: 500 });
  assert.equal(automatic.bullets.length, 1);

  const burst = quiet(state()); burst.count = 1;
  assert.equal(C.useAbility(burst, 'burst', { aimX: 900, aimY: 500 }), true);
  C.step(burst, .01, { aimX: 900, aimY: 500 });
  assert.ok(burst.shot < C.machines.m1a4.interval / 1.69);
  assert.equal(C.useAbility(burst, 'burst', {}), false);

  const combined = quiet(state()); combined.count = 1; combined.overdrive = 7;
  C.useAbility(combined, 'burst', {});
  C.step(combined, .01, { aimX: 900, aimY: 500 });
  assert.equal(combined.shot, C.machines.m1a4.interval / 1.7);

  const dash = quiet(state()); dash.x = 190; dash.y = 330;
  assert.equal(C.useAbility(dash, 'dash', { moveX: 1, moveY: 0 }), true);
  for (let i = 0; i < 5; i++) C.step(dash, .05, { firing: false });
  assert.ok(dash.x <= 213.001);
  assert.equal(dash.invulnerable, 0);
  assert.equal(C.useAbility(dash, 'dash', { moveX: 1, moveY: 0 }), false);
});

test('support lands after delay and decoy expiry shocks enemies without hurting the player', () => {
  const support = quiet(state(() => .5, { tactic: 'support' }));
  support.count = 1;
  const normal = C.spawnEnemy(support, 'normal', 550, 500); normal.hp = normal.max = 500; normal.speed = 0;
  const boss = C.spawnSpecial(support, 'dinosauria', 700, 500); boss.hp = boss.max = 1000; boss.speed = 0;
  C.useTactic(support, { x: 550, y: 500 });
  assert.equal(normal.hp, 500);
  for (let i = 0; i < 12; i++) C.step(support, .05, { firing: false });
  assert.equal(normal.hp, 500);
  C.step(support, .05, { firing: false });
  assert.equal(normal.hp, 200);
  assert.equal(boss.hp, 620);
  assert.equal(support.hp, support.maxHp);

  const decoy = quiet(state(() => .5, { tactic: 'decoy' }));
  decoy.count = 1;
  const victim = C.spawnEnemy(decoy, 'normal', 550, 500); victim.hp = victim.max = 200; victim.speed = 0;
  C.useTactic(decoy, { x: 550, y: 500 });
  for (let i = 0; i < 120; i++) C.step(decoy, .05, { firing: false });
  assert.equal(victim.hp, 110);
  assert.equal(victim.stagger, 1);
  assert.equal(decoy.hp, decoy.maxHp);
});

test('supplies collect immediately and independently even when full', () => {
  const s = quiet(state()); s.charges = 2;
  s.crates.push(
    { id: 101, group: 7, kind: 'repair', x: 500, y: 500, used: false, readable: true, life: 18 },
    { id: 102, group: 7, kind: 'charge', x: 630, y: 500, used: false, readable: true, life: 18 }
  );
  C.step(s, .01, { firing: false });
  assert.equal(s.hp, s.maxHp);
  assert.deepEqual(s.crates.map(b => b.id), [102]);
  assert.equal(s.stats.items, 1);
  const first = s.events.find(e => e.type === 'collect');
  assert.deepEqual(first.before, first.after);
  s.x = 630;
  C.step(s, .01, { firing: false });
  assert.equal(s.crates.length, 0);
  assert.equal(s.charges, 2);
  assert.equal(s.stats.items, 2);
});

test('full weapon pickup clears the item without a fake upgrade event', () => {
  const s = quiet(state()); s.level = 8;
  const item = {kind:'weapon',x:500,y:500,used:false};
  assert.equal(C.collect(s, item), true);
  assert.equal(item.used, true);
  assert.equal(s.level, 8);
  assert.equal(s.overdrive, 0);
  assert.ok(!s.events.some(e => e.type === 'upgrade'));
});

test('dash travels over time along its initial direction and cannot add walking speed', () => {
  const s = quiet(state()); s.obstacles = []; s.count = 1;
  C.useAbility(s, 'dash', { moveX: 1 });
  assert.equal(s.x, 500);
  assert.equal(s.dash.duration, .22);
  C.step(s, .05, { moveX: -1, firing: false });
  assert.ok(s.x > 500 && s.x < 600);
  const middle = s.x;
  for (let i = 0; i < 3; i++) C.step(s, .05, { moveX: -1, firing: false });
  C.step(s, .02, { moveX: -1, firing: false });
  assert.ok(s.x > middle);
  assert.ok(Math.abs(s.x - 600) < 1e-6);
  assert.equal(s.y, 500);
  assert.equal(s.dash, null);
  assert.equal(C.useAbility(s, 'dash', {}), false);
});

test('animated dash stops at cover and enemy collision boundaries', () => {
  for (const obstacle of ['cover', 'enemy']) {
    const s = quiet(state()); s.count = 1; s.obstacles = [];
    let limit;
    if (obstacle === 'cover') { s.obstacles.push({id:'wall',x:600,y:500,w:40,h:100,hp:100,dead:false}); limit = 558; }
    else { const e = C.spawnEnemy(s, 'normal', 580, 500); e.speed = 0; limit = e.x - e.r - s.r; }
    C.useAbility(s, 'dash', { moveX: 1 });
    for (let i = 0; i < 5; i++) C.step(s, .05, { firing: false });
    assert.ok(s.x <= limit + .01, obstacle);
    assert.ok(s.x > 500, obstacle);
    assert.equal(s.dash, null);
  }
});

test('later supply deliveries spawn every twenty seconds in walkable space', () => {
  const s = state(() => .25); s.spawn = s.boss = 999;
  s.supplyGroup = 1; s.pickupTimer = 20;
  for (let i = 0; i < 399; i++) C.step(s, .05, { firing: false });
  assert.equal(s.crates.length, 0);
  C.step(s, .05, { firing: false });
  assert.equal(s.crates.length, 2);
  assert.equal(s.crates[0].group, s.crates[1].group);
  assert.notEqual(s.crates[0].kind, s.crates[1].kind);
  assert.equal(Math.hypot(s.crates[0].x - s.crates[1].x, s.crates[0].y - s.crates[1].y), 130);
  assert.ok(s.crates.every(box => box.life === 18 && box.hold === undefined));
});

test('Morpho exposed state multiplies incoming damage and elite dimensions are distinct', () => {
  const s = quiet(state());
  const boss = C.spawnSpecial(s, 'morpho', 500, 200);
  boss.exposed = 2;
  assert.equal(C.damageEnemy(s, boss, 10), 16);
  assert.ok(boss.r >= 100 && boss.r <= 110);
  const charger = C.spawnEnemy(s, 'charger', 100, 100);
  const artillery = C.spawnEnemy(s, 'artillery', 900, 900);
  assert.deepEqual([charger.r, charger.max, artillery.r, artillery.max], [32, 140, 36, 180]);
});

test('both bosses become exposed only after their final scheduled attack lands', () => {
  for (const [model, wait] of [['dinosauria', 1.3], ['morpho', 2.15]]) {
    const s = quiet(state()); s.count = 1; s.x = 500; s.y = 850;
    const boss = C.spawnSpecial(s, model, 500, 150);
    boss.intro = 0; boss.cooldown = 0; boss.speed = 0;
    C.step(s, .05, { firing: false });
    assert.equal(boss.exposed, 0, `${model} cannot be exposed during its warning`);
    for (let elapsed = .05; elapsed < wait; elapsed += .05) C.step(s, .05, { firing: false });
    assert.ok(boss.exposed > 1.9, `${model} opens a two-second counterattack window`);
  }
});

test('transient arrays remain bounded under a crowded stress state', () => {
  const s = quiet(state()); s.count = 1;
  for (let i = 0; i < 180; i++) {
    s.bullets.push({ x: 500, y: 500, px: 500, py: 500, vx: 0, vy: 0, r: 1, damage: 0, enemy: true, life: 5 });
    s.hazards.push({ geometry: 'circle', x: 100, y: 100, r: 1, delay: 5, maxDelay: 5, fired: false, life: .3, damage: 0 });
  }
  C.step(s, .01, { firing: false });
  assert.ok(s.bullets.length <= 120);
  assert.ok(s.hazards.length <= 160);
});

test('automatic spawns cover all four sides and move toward the player', () => {
  const s = quiet(state());
  const enemies = Array.from({ length: 4 }, () => C.spawnEnemy(s, 'normal'));
  assert.deepEqual(enemies.map(e => e.side), ['top', 'right', 'bottom', 'left']);
  for (const e of enemies) {
    const before = Math.hypot(e.x - s.x, e.y - s.y);
    C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 500, aimY: 0, firing: false });
    assert.ok(Math.hypot(e.x - s.x, e.y - s.y) < before, `${e.side} enemy should close distance`);
  }
});

test('repeated edge spawns do not birth enemies on top of each other', () => {
  const s = quiet(state(() => .5));
  const enemies = Array.from({ length: 12 }, () => C.spawnEnemy(s, 'normal'));
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    assert.ok(Math.hypot(enemies[i].x - enemies[j].x, enemies[i].y - enemies[j].y) >= enemies[i].r + enemies[j].r);
  }
});

test('bosses and elites naturally spawn legally and move inward from every side', () => {
  for (const type of ['dinosauria', 'morpho', 'charger', 'artillery']) {
    for (let side = 0; side < 4; side++) {
      const s = quiet(state(() => .5)); s.count = 1; s.spawnSide = side;
      const e = type === 'dinosauria' || type === 'morpho'
        ? C.spawnSpecial(s, type)
        : C.spawnEnemy(s, type === 'artillery' ? 'artillery' : type);
      assert.ok(e, `${type} side ${side} should spawn`);
      assert.ok(e.x - e.r >= 0 && e.x + e.r <= 1000 && e.y - e.r >= 0 && e.y + e.r <= 1000,
        `${type} side ${side} spawned outside at ${e.x},${e.y}, r=${e.r}`);
      const before = Math.hypot(e.x - s.x, e.y - s.y);
      C.step(s, .05, { firing: false });
      assert.ok(Math.hypot(e.x - s.x, e.y - s.y) < before, `${type} side ${side} should enter the arena`);
      assert.ok(e.walk > 0 && e.moving, `${type} side ${side} should animate be moving`);
    }
  }
});

test('legal explicit spawns stay in place and a fully blocked boss spawn retries safely', () => {
  const explicit = quiet(state());
  const e = C.spawnEnemy(explicit, 'normal', 180, 420);
  assert.deepEqual([e.x, e.y], [180, 420]);

  const blocked = quiet(state());
  blocked.obstacles = [{ id: 'all', x: 500, y: 500, w: 1000, h: 1000, hp: 1, max: 1, dead: false }];
  assert.equal(C.spawnSpecial(blocked, 'dinosauria'), null);
  blocked.boss = 0;
  assert.doesNotThrow(() => C.step(blocked, .05, { firing: false }));
  assert.equal(blocked.boss, 1);
  assert.equal(blocked.enemies.length, 0);
});

test('walk and moving reflect actual displacement when player or enemy is blocked', () => {
  const player = quiet(state()); player.x = 213; player.y = 330;
  C.step(player, .05, { moveX: 1, moveY: 0, aimX: 900, aimY: 330, firing: false });
  assert.deepEqual([player.x, player.y, player.walk, player.scroll, player.moving], [213, 330, 0, 0, false]);

  const s = quiet(state()); s.x = 500; s.y = 500;
  const blocker = C.spawnEnemy(s, 'normal', 250, 500); blocker.speed = 0;
  const mover = C.spawnEnemy(s, 'normal', 214, 500); mover.speed = 100;
  C.step(s, .05, { firing: false });
  assert.deepEqual([mover.x, mover.y, mover.walk, mover.moving], [214, 500, 0, false]);
});

test('diagonal movement is no faster than straight movement', () => {
  const straight = quiet(state());
  const diagonal = quiet(state());
  C.step(straight, 0.05, { moveX: 1, moveY: 0, aimX: 900, aimY: 500, firing: false });
  C.step(diagonal, 0.05, { moveX: 1, moveY: 1, aimX: 900, aimY: 900, firing: false });
  assert.ok(Math.abs(Math.hypot(straight.x - 500, straight.y - 500) - Math.hypot(diagonal.x - 500, diagonal.y - 500)) < 1e-9);
});

test('manual fire can hit in all four directions', () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const s = quiet(state());
    const enemy = C.spawnEnemy(s, 'normal', 500 + dx * 100, 500 + dy * 100);
    enemy.hp = enemy.max = 10;
    C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 500 + dx * 300, aimY: 500 + dy * 300, firing: true });
    for (let i = 0; i < 10 && !enemy.dead; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 500 + dx * 300, aimY: 500 + dy * 300, firing: false });
    assert.equal(enemy.dead, true, `shot should hit direction ${dx},${dy}`);
    assert.ok(s.events.some(e => e.type === 'impact' || e.type === 'kill'));
  }
});

test('aiming behind the player only hits the enemy behind', () => {
  const s = quiet(state());
  s.count = 1;
  const behind = C.spawnEnemy(s, 'normal', 390, 500);
  const ahead = C.spawnEnemy(s, 'normal', 610, 500);
  behind.speed = ahead.speed = 0;
  C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 0, aimY: 500, firing: true });
  for (let i = 0; i < 10; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 0, aimY: 500, firing: false });
  assert.ok(behind.hp < behind.max);
  assert.equal(ahead.hp, ahead.max);
});

test('circle and beam hazards use their visible geometry and warnings do no damage', () => {
  const circle = quiet(state());
  circle.shield = 0;
  circle.hazards.push({ geometry: 'circle', x: 500, y: 500, r: 50, delay: 0.1, maxDelay: 0.1, fired: false, life: 0.3, damage: 17, source: 1, kind: 'mortar' });
  C.step(circle, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(circle.hp, circle.maxHp);
  C.step(circle, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(circle.hp, circle.maxHp - 17);

  const beamOutside = quiet(state());
  beamOutside.shield = 0;
  beamOutside.y = 560;
  beamOutside.hazards.push({ geometry: 'beam', fromX: 200, fromY: 500, toX: 800, toY: 500, width: 40, delay: 0, maxDelay: 0.1, fired: false, life: 0.2, damage: 21, source: 2, kind: 'rail' });
  C.step(beamOutside, 0.01, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(beamOutside.hp, beamOutside.maxHp);

  const beamInside = quiet(state());
  beamInside.shield = 0;
  beamInside.hazards.push({ geometry: 'beam', fromX: 200, fromY: 500, toX: 800, toY: 500, width: 40, delay: 0, maxDelay: 0.1, fired: false, life: 0.2, damage: 21, source: 2, kind: 'rail' });
  C.step(beamInside, 0.01, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(beamInside.hp, beamInside.maxHp - 21);
});

test('physical supplies collect only inside pickup range', () => {
  const s = quiet(state());
  s.hp = 40;
  s.crates.push({ id: 1, kind: 'repair', x: 590, y: 500, used: false });
  C.step(s, 0.01, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(s.hp, 40);
  s.x = 550;
  C.step(s, 0.01, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(s.hp, 70);
  assert.ok(s.events.some(e => e.type === 'collect'));
});

test('charger locks a dash, hurts on contact, then survives in stagger', () => {
  const s = quiet(state());
  s.count = 1;
  const charger = C.spawnEnemy(s, 'charger', 350, 550);
  for (let i = 0; i < 36; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.ok(s.hp < s.maxHp);
  assert.equal(charger.dead, false);
  assert.equal(charger.phase, 'stagger');
});

test('decoy tactic preserves the enemy and redirects the next charger lock', () => {
  const s = quiet(state(() => 0.5, { tactic: 'decoy' }));
  const charger = C.spawnEnemy(s, 'charger', 350, 550);
  charger.cooldown = 0;
  C.useTactic(s, { x: 500, y: 700 });
  C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(charger.dead, false);
  assert.equal(charger.phase, 'windup');
  assert.deepEqual([charger.lockedX, charger.lockedY], [500, 700]);
  assert.ok(s.events.some(e => e.type === 'warning' && e.kind === 'charger'));
});

test('AP loads slower and penetrates two aligned targets', () => {
  const s = quiet(state(() => 0.5, { ammo: 'ap' }));
  s.count = 1;
  const first = C.spawnEnemy(s, 'normal', 575, 500);
  const second = C.spawnEnemy(s, 'normal', 635, 500);
  first.speed = second.speed = 0;
  C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: true });
  assert.equal(s.shot, C.machines.m1a4.interval * 1.25);
  for (let i = 0; i < 8; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.ok(first.hp < first.max);
  assert.ok(second.hp < second.max);
});

test('HE blast damages a nearby target once without double hitting the direct target', () => {
  const s = quiet(state(() => 0.5, { ammo: 'he' }));
  s.count = 1;
  const direct = C.spawnEnemy(s, 'normal', 575, 500);
  const nearby = C.spawnEnemy(s, 'normal', 625, 520);
  direct.speed = nearby.speed = 0;
  direct.hp = direct.max = nearby.hp = nearby.max = 100;
  C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: true });
  for (let i = 0; i < 5; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.equal(direct.hp, 100 - C.machines.m1a4.damage * 0.85);
  assert.ok(nearby.hp < nearby.max);
});

test('dead enemies and expired supplies are reclaimed while living enemies are capped', () => {
  const s = quiet(state());
  const dead = C.spawnEnemy(s, 'normal', 400, 400);
  C.damageEnemy(s, dead, dead.hp);
  s.crates.push({ id: 99, kind: 'repair', x: 900, y: 900, used: false, life: 0.01 });
  C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.ok(!s.enemies.includes(dead));
  assert.ok(!s.crates.some(box => box.id === 99));
  for (let i = 0; i < 80; i++) C.spawnEnemy(s, 'normal');
  assert.ok(s.enemies.filter(e => !e.dead).length <= 70);
});

test('destroying artillery cancels its warning but preserves fired hazards', () => {
  const s = quiet(state());
  const gun = C.spawnEnemy(s, 'artillery', 300, 300);
  C.addHazard(s, 'circle', gun, 'mortar', { x: 500, y: 500, r: 80 }, 1, 20);
  const fired = { ...s.hazards[0], fired: true };
  s.hazards.push(fired);
  C.damageEnemy(s, gun, gun.hp);
  assert.deepEqual(s.hazards, [fired]);
  assert.equal(fired.model, 'artillery');
});

test('boss death continues endless play and player death yields a retryable result', () => {
  const s = quiet(state());
  const boss = C.spawnSpecial(s, 'dinosauria', 500, 250);
  C.damageEnemy(s, boss, boss.hp);
  assert.equal(s.over, false);
  assert.equal(s.bossKills, 1);
  assert.ok(s.events.some(e => e.type === 'bossDown'));

  s.invulnerable = 0;
  C.hurt(s, s.hp, true, { kind: 'rail', model: 'morpho', sourceId: 99 });
  const result = C.result(s);
  assert.equal(result.won, false);
  assert.equal(result.mode, 'endless');
  assert.equal(result.bossKills, 1);
  assert.equal(result.lastDamage.kind, 'rail');

  const retry = state(() => 0.25, { machine: s.machine });
  assert.equal(retry.over, false);
  assert.equal(retry.hp, retry.maxHp);
  assert.deepEqual([retry.x, retry.y], [500, 500]);
});

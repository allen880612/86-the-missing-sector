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
  assert.deepEqual([s.tactic, s.charges, s.tacticRecharge, s.boss], ['support', 2, 18, 32]);
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
    ['shield', s => { s.shield = 0; }, s => assert.equal(s.shield, 18)],
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
  for (let i = 0; i < 500; i++) C.step(s, .05, { firing: false });
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

test('fire defaults on and M4A3 overclock accelerates it without stacking overdrive', () => {
  const automatic = quiet(state()); automatic.count = 1;
  C.step(automatic, .01, { aimX: 900, aimY: 500 });
  assert.equal(automatic.bullets.length, 1);

  const burst = quiet(state(()=>.5,{machine:'m4a3'})); burst.count = 1;
  assert.equal(C.useAbility(burst, 'burst', { aimX: 900, aimY: 500 }), true);
  C.step(burst, .01, { aimX: 900, aimY: 500 });
  assert.ok(burst.shot < C.machines.m4a3.interval / 1.69);
  assert.equal(C.useAbility(burst, 'burst', {}), false);

  const combined = quiet(state(()=>.5,{machine:'m4a3'})); combined.count = 1; combined.overdrive = 7;
  C.useAbility(combined, 'burst', {});
  C.step(combined, .01, { aimX: 900, aimY: 500 });
  assert.equal(combined.shot, C.machines.m4a3.interval / 1.7);

});

test('left ability differs by machine and close-range skills create a counter window', () => {
  const counter=quiet(state(()=>.5,{machine:'m1a4'}));counter.count=1;counter.shield=0;
  const near=C.spawnEnemy(counter,'normal',620,500),far=C.spawnEnemy(counter,'normal',760,500);near.hp=near.max=300;far.hp=far.max=300;near.speed=far.speed=0;
  counter.bullets.push({x:610,y:500,px:610,py:500,vx:-220,vy:0,r:4,damage:6,enemy:true,life:1});
  assert.equal(C.useBurst(counter),true);assert.deepEqual([near.hp,far.hp,counter.burstCooldown,counter.burstTime],[140,300,8,.25]);
  assert.equal(counter.bullets.some(b=>b.enemy),false);assert.ok(counter.invulnerable>=.35);
  let event=counter.events.find(e=>e.type==='ability'&&e.kind==='burst');assert.deepEqual([event.skill,event.radius,event.hits.length],['counter',170,1]);
  C.step(counter,.01,{aimX:900,aimY:500,firing:true});assert.equal(counter.shot,C.machines.m1a4.interval);

  const blade=quiet(state(()=>.5,{machine:'xm2'}));blade.count=1;
  const charger=C.spawnEnemy(blade,'charger',650,500);charger.hp=charger.max=500;charger.phase='windup';charger.windup=.8;
  C.addHazard(blade,'beam',charger,'charge',{x:500,y:500,width:80},.8,0);
  assert.equal(C.useBurst(blade),true);assert.equal(charger.hp,260);assert.equal(charger.phase,'stagger');assert.equal(charger.windup,0);
  assert.equal(blade.hazards.some(h=>!h.fired&&h.source===charger.id),false);event=blade.events.find(e=>e.type==='ability');assert.deepEqual([event.skill,event.radius],["blade",220]);

  const overclock=quiet(state(()=>.5,{machine:'m4a3'}));assert.equal(C.useBurst(overclock),true);event=overclock.events.find(e=>e.type==='ability');
  assert.deepEqual([event.skill,event.radius,overclock.burstTime,overclock.burstCooldown],['overclock',0,3,9]);
});

test('support lands after delay without hurting the player', () => {
  const support = quiet(state(() => .5, { tactic: 'support' }));
  support.count = 1;
  const normal = C.spawnEnemy(support, 'normal', 550, 500); normal.hp = normal.max = 500; normal.speed = 0;
  const boss = C.spawnSpecial(support, 'dinosauria', 700, 500); boss.hp = boss.max = 1000; boss.speed = 0;
  C.useTactic(support, { x: 550, y: 500 });
  assert.equal(normal.hp, 500);
  for (let i = 0; i < 12; i++) C.step(support, .05, { firing: false });
  assert.equal(normal.hp, 500);
  C.step(support, .05, { firing: false });
  assert.equal(normal.hp, 50);
  assert.equal(boss.hp, 700);
  assert.equal(support.hp, support.maxHp);
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

test('weapon pickup continues progression beyond the former level-eight cap', () => {
  const s = quiet(state()); s.level = 8;
  const item = {kind:'weapon',x:500,y:500,used:false};
  assert.equal(C.collect(s, item), true);
  assert.equal(item.used, true);
  assert.equal(s.level, 9);
  assert.equal(s.overdrive, 0);
  assert.ok(s.events.some(e => e.type === 'upgrade' && e.level === 9));
});

test('dash crosses blockers over time and lands at each machine distance', () => {
  for (const [machine, distance] of [['m1a4', 180], ['xm2', 220], ['m4a3', 150]]) {
    const s = quiet(state(() => .5, { machine })); s.obstacles = []; s.count = 1;
    const blocker = C.spawnEnemy(s, 'normal', 590, 500); blocker.speed = 0;
    assert.equal(C.useAbility(s, 'dash', { moveX: 1 }), true);
    assert.deepEqual([s.x, s.dash.duration, s.dash.toX], [500, .36, 500 + distance]);
    C.step(s, .05, { moveX: -1, firing: false });
    assert.ok(s.x > 500 && s.x < 500 + distance);
    if(machine==='m1a4'){const shield=s.shield;assert.equal(C.hurt(s,20,false,{kind:'contact'}),0);assert.equal(s.shield,shield);C.hurt(s,20,false,{kind:'mortar'});assert.ok(s.shield<shield);}
    while (s.dash) C.step(s, .05, { moveX: -1, firing: false });
    assert.ok(Math.abs(s.x - (500 + distance)) < 1e-6, machine);
    assert.ok(s.events.some(e => e.type === 'dashLand'));
    assert.ok(blocker.x < s.x, 'dash path may cross an enemy');
  }
});

test('dash rejects when no landing exists and chooses a legal landing near cover', () => {
  const blocked = quiet(state()); blocked.count = 1; blocked.obstacles = [{id:'sealed',x:700,y:500,w:240,h:400,hp:100,dead:false}];
  assert.equal(C.useAbility(blocked, 'dash', { moveX: 1 }), false);
  assert.equal(blocked.dashCooldown, 0);

  const detour = quiet(state()); detour.count = 1; detour.obstacles = [{id:'tip',x:680,y:500,w:40,h:40,hp:100,dead:false}];
  assert.equal(C.useAbility(detour, 'dash', { moveX: 1 }), true);
  assert.ok(detour.dash.toY !== 500 || detour.dash.toX !== 680);
  while(detour.dash) C.step(detour, .05, { firing: false });
  assert.ok(detour.x+detour.r<=660||detour.x-detour.r>=700||detour.y+detour.r<=480||detour.y-detour.r>=520);
});

test('later supply deliveries spawn every twenty-five seconds in walkable space', () => {
  const s = state(() => .25); s.spawn = s.boss = 999;
  s.supplyGroup = 1; s.pickupTimer = 25;
  for (let i = 0; i < 499; i++) C.step(s, .05, { firing: false });
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

test('legacy decoy normalizes to support and support charges reliably recharge', () => {
  const s = quiet(state(() => 0.5, { tactic: 'decoy' }));
  assert.equal(s.tactic, 'support');
  s.charges = 0; s.tacticRecharge = .05;
  C.step(s, .05, { firing: false });
  assert.equal(s.charges, 1);
  assert.equal(s.tacticRecharge, 18);
  assert.ok(s.events.some(e => e.type === 'tacticRecharge' && e.charges === 1));
});

test('support clears a 280-radius surround and staggers a surviving boss', () => {
  const s=quiet(state());s.count=1;s.invulnerable=999;
  for(const [type,x,y] of [['normal',560,500],['shield',420,500],['charger',500,620]]){const e=C.spawnEnemy(s,type,x,y);e.speed=0;}
  const boss=C.spawnSpecial(s,'dinosauria',500,250);boss.hp=boss.max=1000;boss.speed=0;
  C.useTactic(s,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});
  assert.equal(s.enemies.filter(e=>e.type!=='boss').length,0);
  assert.equal(boss.hp,700);assert.equal(boss.stagger,1.5);
  const impact=s.events.find(e=>e.type==='mortarImpact'&&e.kind==='support');assert.equal(impact.r,280);assert.equal(impact.hits.length,4);
});

test('support interrupts a surviving boss windup but preserves already fired attacks', () => {
  const s=quiet(state());s.count=1;s.invulnerable=999;
  const boss=C.spawnSpecial(s,'morpho',500,250);boss.hp=boss.max=1200;boss.speed=0;
  C.addHazard(s,'beam',boss,'rail',{x:500,y:900,width:58},1.5,44);
  C.addHazard(s,'circle',boss,'mortar',{x:550,y:500,r:82},1.8,28);
  const fired={...s.hazards[1],fired:true,life:2};s.hazards.push(fired);
  C.useTactic(s,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});
  assert.equal(boss.hp,900);
  assert.equal(s.hazards.some(h=>!h.fired&&h.source===boss.id),false);
  assert.ok(s.hazards.includes(fired));
  assert.equal(s.stats.interrupts,1,'one interrupted enemy counts once, not once per warning');
  const hit=s.events.find(e=>e.type==='mortarImpact'&&e.kind==='support').hits.find(hit=>hit.id===boss.id);
  assert.equal(hit.interrupted,true);
});

test('support cancels an active charger dash and its pending charge lane', () => {
  const s=quiet(state());s.count=1;s.invulnerable=999;
  const charger=C.spawnEnemy(s,'charger',500,620);charger.hp=charger.max=600;charger.speed=0;
  charger.phase='dash';charger.lockedX=500;charger.lockedY=300;
  C.addHazard(s,'beam',charger,'charge',{x:500,y:300,width:100},.9,0);
  C.useTactic(s,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});
  assert.equal(charger.phase,'stagger');
  assert.equal(charger.windup,0);
  assert.equal(charger.lockedX,null);assert.equal(charger.lockedY,null);
  assert.equal(s.hazards.some(h=>!h.fired&&h.source===charger.id),false);
  assert.equal(s.stats.interrupts,1);
});

test('specialists replace one normal spawn every seven seconds in a readable order', () => {
  const s=quiet(state(()=>.5));s.spawn=0;s.time=15.96;s.nextSpecial=16;
  const expected=['scout','artillery','shield','jammer','mine','swarm','charger'];
  for(const type of expected){s.spawn=0;s.time=s.nextSpecial-.04;C.step(s,.05,{firing:false});assert.ok(s.enemies.some(e=>e.type===type),type);}
  assert.equal(s.specialIndex,7);
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

test('drops use twenty normal kills with sparse armor while elites and bosses pay better', () => {
  const s = quiet(state()); s.count = 1; s.hp = 20; s.shield = 80;
  for (let i = 0; i < 19; i++) { const e=C.spawnEnemy(s,'normal',120,180); C.damageEnemy(s,e,e.hp); }
  assert.equal(s.crates.length, 0);
  let e=C.spawnEnemy(s,'normal',700,180); C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length, 1); assert.equal(s.crates[0].kind, 'repair');
  s.crates=[];s.hp=s.maxHp;s.shield=0;
  e=C.spawnEnemy(s,'charger',200,200);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.at(-1).kind,'weapon');
  e=C.spawnEnemy(s,'artillery',800,200);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length,1,'second elite inside eight seconds is throttled');
  s.time=8;e=C.spawnEnemy(s,'scout',500,150);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length,2);assert.equal(s.crates.at(-1).kind,'charge');
  const boss=C.spawnSpecial(s,'dinosauria',500,250);C.damageEnemy(s,boss,boss.hp);
  assert.equal(s.crates.length,3,'boss always drops');assert.equal(s.crates.at(-1).kind,'weapon');

  const cycle=quiet(state());cycle.count=1;cycle.hp=cycle.maxHp;cycle.shield=0;
  for(let i=0;i<120;i++){const normal=C.spawnEnemy(cycle,'normal',120,180);C.damageEnemy(cycle,normal,normal.hp);}
  assert.equal(cycle.crates.length,6);assert.equal(cycle.crates.filter(box=>box.kind==='shield').length,1);
});

test('scout links an artillery second impact and its death cancels only that pending shot', () => {
  const s=quiet(state());s.count=1;
  const gun=C.spawnEnemy(s,'artillery',200,200),scout=C.spawnEnemy(s,'scout',280,200);gun.speed=scout.speed=0;gun.cooldown=0;
  C.step(s,.05,{firing:false});
  const linked=s.hazards.find(h=>h.linkedTo===scout.id&&!h.fired);
  assert.ok(linked);assert.equal(linked.source,gun.id);
  C.damageEnemy(s,scout,scout.hp);
  assert.ok(!s.hazards.includes(linked));
  assert.ok(s.hazards.some(h=>h.source===gun.id&&!h.fired));
});

test('Lowe beam is cover-blocked and enters a cooling window', () => {
  const s=quiet(state());s.count=1;s.x=850;s.y=360;
  const lowe=C.spawnEnemy(s,'shield',500,360);lowe.speed=0;lowe.cooldown=0;
  C.step(s,.05,{firing:false});
  const beam=s.hazards.find(h=>h.source===lowe.id&&h.geometry==='beam');
  assert.ok(beam&&beam.blockedBy==='cover-2');
  lowe.cooldown=0;C.step(s,.05,{firing:false});
  assert.ok(lowe.cooling>0);
});

test('jammers locally reduce wing range and killing them immediately restores it', () => {
  const s=quiet(state());s.count=2;s.obstacles=[];
  const target=C.spawnEnemy(s,'normal',740,542),jammer=C.spawnEnemy(s,'jammer',560,760);target.speed=jammer.speed=0;
  C.step(s,.05,{firing:false});assert.equal(s.bullets.filter(b=>b.ammo==='wing').length,0);assert.ok(s.jammed);assert.ok(s.wingRange<280);
  C.damageEnemy(s,jammer,jammer.hp);s.wingShot=0;C.step(s,.05,{firing:false});
  assert.ok(s.bullets.some(b=>b.ammo==='wing'&&b.targetId===target.id));assert.equal(s.jammed,false);
});

test('mine warns before detonation and a player kill chains damage once', () => {
  const s=quiet(state());s.count=1;s.shield=0;
  const mine=C.spawnEnemy(s,'mine',575,500);mine.speed=0;
  C.step(s,.05,{firing:false});assert.equal(mine.phase,'windup');assert.ok(s.events.some(e=>e.type==='warning'&&e.kind==='mine'));
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});assert.ok(mine.dead);assert.ok(s.hp<s.maxHp);
  const chain=quiet(state());chain.count=1;chain.x=800;chain.y=800;const first=C.spawnEnemy(chain,'mine',400,500),second=C.spawnEnemy(chain,'mine',450,500),victim=C.spawnEnemy(chain,'shield',515,500);first.speed=second.speed=victim.speed=0;
  C.damageEnemy(chain,first,first.hp);assert.ok(second.dead);assert.ok(victim.hp<victim.max);assert.ok(chain.events.some(e=>e.type==='mineChain'));
});

test('a wingman sacrifices itself only for lethal post-shield damage and respects cooldown', () => {
  const s=quiet(state());s.count=3;s.shield=10;s.hp=50;
  assert.equal(C.hurt(s,70,false,{kind:'rail',sourceId:9}),0);assert.deepEqual([s.count,s.hp,s.shield,s.wingSaveCooldown],[2,50,0,6]);
  assert.ok(s.events.some(e=>e.type==='wingSacrifice'&&e.absorbed===60));
  s.invulnerable=s.heavyInvulnerable=0;C.hurt(s,70,false,{kind:'rail'});assert.equal(s.hp,0);
  const armored=quiet(state());armored.count=2;armored.shield=100;C.hurt(armored,50,false,{kind:'rail'});assert.equal(armored.count,2);
  const solo=quiet(state());solo.count=1;solo.shield=0;C.hurt(solo,solo.hp,false,{kind:'rail'});assert.equal(solo.hp,0);
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

test('boss selection accepts Phoenix and the endless rotation includes all three models', () => {
  const s=quiet(state(()=>.5,{bossModel:'phoenix'}));s.count=1;s.boss=0;
  C.step(s,.05,{firing:false});
  let boss=s.enemies.find(e=>e.type==='boss');
  assert.equal(boss.model,'phoenix');assert.deepEqual([boss.max,boss.r,boss.speed],[1600,48,140]);
  C.damageEnemy(s,boss,boss.hp);s.boss=0;C.step(s,.05,{firing:false});
  boss=s.enemies.find(e=>e.type==='boss'&&!e.dead);assert.equal(boss.model,'morpho');
  C.damageEnemy(s,boss,boss.hp);s.boss=0;C.step(s,.05,{firing:false});
  boss=s.enemies.find(e=>e.type==='boss'&&!e.dead);assert.equal(boss.model,'dinosauria');
});

test('Phoenix warns, dashes continuously, then exposes itself after a miss or collision', () => {
  const s=quiet(state(()=>.5,{bossModel:'phoenix'}));s.count=1;s.x=800;s.y=500;s.obstacles=[];
  const boss=C.spawnSpecial(s,'phoenix',300,500);boss.intro=0;boss.cooldown=0;
  C.step(s,.05,{firing:false});
  assert.equal(boss.phase,'windup');assert.ok(s.events.some(e=>e.type==='phoenixCue'&&e.delay===.9));assert.equal(s.stats.bossShots,1);
  for(let i=0;i<18;i++)C.step(s,.05,{firing:false});
  assert.equal(boss.phase,'dash');const start=boss.x;
  C.step(s,.05,{firing:false});assert.ok(boss.x>start&&boss.x<boss.lockedX,'dash advances without teleporting');
  for(let i=0;i<30&&boss.phase==='dash';i++)C.step(s,.05,{firing:false});
  assert.equal(boss.phase,'recover');assert.ok(boss.exposed>1.9);assert.ok(s.events.some(e=>e.type==='phoenixRecover'));
  boss.revealed=0;C.damageEnemy(s,boss,10);assert.ok(boss.revealed>=1.5);

  const interrupted=quiet(state());interrupted.count=1;interrupted.obstacles=[];
  const target=C.spawnSpecial(interrupted,'phoenix',500,300);target.hp=target.max=900;target.phase='windup';target.windup=.8;target.lockedX=500;target.lockedY=720;
  C.addHazard(interrupted,'beam',target,'charge',{x:500,y:720,width:128},.8,0);C.useTactic(interrupted,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(interrupted,.05,{firing:false});
  assert.equal(target.phase,'recover');assert.equal(target.stagger,1.5);assert.equal(target.exposed,2);assert.equal(target.revealed,1.5);
});

test('Stier locks one angle, fires a three-ray fan, and support interrupts its windup', () => {
  const s=quiet(state());s.count=1;s.x=700;s.y=500;s.obstacles=[];
  const stier=C.spawnEnemy(s,'stier',400,500);stier.cooldown=0;stier.speed=0;
  C.step(s,.05,{firing:false});assert.equal(stier.phase,'windup');assert.equal(stier.windup,.95);
  const warning=s.hazards.filter(h=>h.source===stier.id&&h.geometry==='beam');assert.equal(warning.length,3);assert.ok(warning.every(h=>!h.fired));
  const playerHp=s.hp;for(let i=0;i<18;i++)C.step(s,.05,{firing:false});assert.equal(s.hp,playerHp);assert.ok(warning.every(h=>!h.fired));
  C.step(s,.05,{firing:false});assert.ok(warning.every(h=>h.fired));
  assert.equal(stier.phase,'cooling');assert.ok(stier.exposed>2.3);
  const hp=stier.hp;assert.equal(C.damageEnemy(s,stier,10),16);assert.equal(stier.hp,hp-16);

  const interrupted=quiet(state());interrupted.count=1;interrupted.obstacles=[];
  const target=C.spawnEnemy(interrupted,'stier',500,650);target.hp=target.max=800;target.phase='windup';target.windup=.7;
  C.addHazard(interrupted,'beam',target,'rail',{x:500,y:300,width:22},.7,22);
  C.useTactic(interrupted,{x:500,y:500});for(let i=0;i<13;i++)C.step(interrupted,.05,{firing:false});
  assert.equal(target.phase,'cooling');assert.equal(target.windup,0);assert.ok(target.exposed>2.3);
  assert.equal(interrupted.hazards.some(h=>!h.fired&&h.source===target.id),false);
});

test('Gunner replaces normal spawns after twelve seconds and fires dodgeable enemy bullets', () => {
  const spawned=quiet(state(()=>0));spawned.time=12;spawned.spawn=0;
  C.step(spawned,.05,{firing:false});assert.ok(spawned.enemies.some(e=>e.type==='gunner'));
  const s=quiet(state());s.count=1;s.x=500;s.y=500;s.shield=0;s.obstacles=[];
  const gunner=C.spawnEnemy(s,'gunner',700,500);gunner.speed=0;gunner.cooldown=0;
  C.step(s,.05,{firing:false});assert.equal(gunner.phase,'windup');assert.equal(s.hp,s.maxHp);
  for(let i=0;i<10;i++)C.step(s,.05,{firing:false});
  const shots=s.bullets.filter(b=>b.enemy&&b.model==='gunner');assert.equal(shots.length,2);assert.ok(shots.every(b=>Math.abs(Math.hypot(b.vx,b.vy)-220)<1e-9));
  for(let i=0;i<20&&s.hp===s.maxHp;i++)C.step(s,.05,{firing:false});
  assert.ok(s.hp<s.maxHp);assert.ok(s.events.some(e=>e.type==='enemyImpact'));
  s.crates=[];const before=s.normalKills;C.damageEnemy(s,gunner,gunner.hp);
  assert.equal(s.normalKills,before+1);assert.equal(s.crates.length,0);assert.ok(!s.events.some(e=>e.type==='eliteDown'&&e.sourceId===gunner.id));

  const covered=quiet(state());covered.count=1;covered.x=850;covered.y=360;covered.shield=0;
  const behind=C.spawnEnemy(covered,'gunner',500,360);behind.speed=0;behind.phase='windup';behind.windup=.05;behind.lockedAngle=0;
  for(let i=0;i<20;i++)C.step(covered,.05,{firing:false});
  assert.equal(covered.hp,covered.maxHp);assert.ok(covered.obstacles[1].hp<covered.obstacles[1].max);
});

test('waves advance every forty-five seconds and every four waves raises the persistent threat stage', () => {
  const s=quiet(state());
  for(const [time,wave,stage,cap] of [[179.95,5,2,2],[359.95,9,3,3],[719.95,17,5,3]]){
    s.time=time;C.step(s,.05,{firing:false});assert.deepEqual([s.wave,s.threatStage,s.bossCap],[wave,stage,cap]);
    assert.ok(s.events.some(e=>e.type==='waveStart'&&e.wave===wave));
  }
  s.bossCap=3;
  assert.ok(C.spawnSpecial(s,'dinosauria',150,150));assert.ok(C.spawnSpecial(s,'phoenix',850,150));assert.ok(C.spawnSpecial(s,'morpho',850,850));
  assert.equal(C.spawnSpecial(s,'phoenix',150,850),null);
  assert.equal(s.enemies.filter(e=>e.type==='boss'&&!e.dead).length,3);
});

test('bosses enter phase two below half health and gain a real extra attack', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];
  const boss=C.spawnSpecial(s,'dinosauria',500,150);boss.intro=0;boss.cooldown=0;boss.hp=boss.max*.5;
  C.step(s,.05,{firing:false});
  assert.equal(boss.bossStage,2);assert.ok(s.events.some(e=>e.type==='bossPhase'&&e.sourceId===boss.id&&e.phase===2));
  assert.ok(s.hazards.filter(h=>h.source===boss.id).length>4,'phase two adds an attack to the base mortar and fan');
  for(let elapsed=.05;elapsed<1.65;elapsed+=.05)C.step(s,.05,{firing:false});assert.equal(boss.exposed,0);
  C.step(s,.05,{firing:false});assert.ok(boss.exposed>1.9,'phase two exposes only after its added final attack');
});

test('heavy attackers use the intended stage-one pressure values and boss health scales by stage', () => {
  const dino=quiet(state());dino.count=1;dino.obstacles=[];const boss=C.spawnSpecial(dino,'dinosauria',500,150);boss.intro=0;boss.cooldown=0;
  C.step(dino,.05,{firing:false});assert.deepEqual(dino.hazards.filter(h=>h.source===boss.id).map(h=>h.damage).sort((a,b)=>a-b),[40,48,48,48]);
  const morpho=quiet(state());morpho.count=1;morpho.obstacles=[];const rail=C.spawnSpecial(morpho,'morpho',500,150);rail.intro=0;rail.cooldown=0;
  C.step(morpho,.05,{firing:false});assert.equal(morpho.hazards.find(h=>h.source===rail.id&&h.geometry==='beam').damage,60);
  const late=quiet(state());late.time=360;late.wave=9;late.threatStage=3;late.bossCap=3;const scaled=C.spawnSpecial(late,'phoenix');assert.equal(scaled.max,1600*1.36);
  const stier=C.spawnEnemy(late,'stier',200,500);stier.cooldown=0;stier.speed=0;C.step(late,.05,{firing:false});
  assert.ok(late.hazards.filter(h=>h.source===stier.id).some(h=>Math.abs(h.damage-32*stier.damageScale)<1e-9));
});

test('weapon levels grow forever and milestones add a bounded secondary shell', () => {
  const s=quiet(state());s.count=1;s.level=11;
  C.collect(s,{kind:'weapon',x:500,y:500,used:false});assert.equal(s.level,12);
  assert.ok(s.events.some(e=>e.type==='weaponMilestone'&&e.level===12&&e.tier===1));
  C.step(s,.01,{aimX:900,aimY:500,firing:true});assert.equal(s.bullets.filter(b=>!b.enemy).length,2);
  const early=s.bullets[0].damage;s.bullets=[];s.shot=0;s.level=28;
  C.step(s,.01,{aimX:900,aimY:500,firing:true});assert.equal(s.bullets.length,2);assert.ok(s.bullets[0].damage>early);assert.ok(s.bullets[1].damage<s.bullets[0].damage);
  s.level=100;C.collect(s,{kind:'weapon',x:500,y:500,used:false});assert.equal(s.level,101);
});

test('wingmen keep health, can be damaged, and recover from warned local hijacking', () => {
  const s=quiet(state());s.count=3;s.obstacles=[];C.formation(s);
  assert.deepEqual(s.wings.map(w=>w.hp),[36,36]);const slot=C.formation(s)[1];
  s.bullets.push({x:slot.x,y:slot.y-30,px:slot.x,py:slot.y-30,vx:0,vy:600,r:4,damage:9,enemy:true,life:1,model:'gunner',sourceId:77});
  C.step(s,.05,{firing:false});assert.equal(s.wings[0].hp,27);assert.ok(s.events.some(e=>e.type==='wingHit'&&e.wingId===s.wings[0].id));
  const jammer=C.spawnEnemy(s,'jammer',slot.x,slot.y);jammer.speed=0;s.wingShot=999;
  for(let i=0;i<41;i++)C.step(s,.05,{firing:false});
  assert.ok(s.events.some(e=>e.type==='wingHijacked')||s.wings[0].hijacked>0);assert.ok(s.wings[0].hijacked>0);
  C.damageEnemy(s,jammer,jammer.hp);C.step(s,.05,{firing:false});assert.equal(s.wings[0].hijacked,0);assert.ok(s.events.some(e=>e.type==='wingRecovered'));
});

test('late Stier gains a warned second fan and Phoenix dashes through lesser enemies', () => {
  const fan=quiet(state());fan.count=1;fan.obstacles=[];fan.time=180;fan.wave=5;fan.threatStage=2;
  const stier=C.spawnEnemy(fan,'stier',400,500);stier.speed=0;stier.cooldown=0;
  C.step(fan,.05,{firing:false});assert.equal(stier.eliteStage,2);assert.equal(fan.hazards.filter(h=>h.source===stier.id).length,6);
  assert.ok(fan.events.some(e=>e.type==='warning'&&e.kind==='stierFollow'&&e.delay===1.3));

  const charge=quiet(state());charge.count=1;charge.x=900;charge.y=500;charge.obstacles=[];
  const phoenix=C.spawnSpecial(charge,'phoenix',300,500),blocker=C.spawnEnemy(charge,'normal',400,500);blocker.speed=0;
  phoenix.phase='dash';phoenix.lockedX=700;phoenix.lockedY=500;phoenix.dashLeft=400;
  for(let i=0;i<4;i++)C.step(charge,.05,{firing:false});assert.ok(phoenix.x>blocker.x&&phoenix.phase==='dash');
});

test('full recruit pickups repair persistent wings and defeat cannot recreate them', () => {
  const s=quiet(state());s.count=4;C.formation(s);s.wings.forEach(w=>w.hp=10);
  C.collect(s,{kind:'recruit',x:500,y:500,used:false});assert.deepEqual(s.wings.map(w=>w.hp),[28,28,28]);assert.equal(s.count,4);
  C.hurt(s,s.hp,true,{kind:'rail'});assert.equal(s.count,0);assert.equal(C.formation(s).length,1);assert.equal(s.count,0);assert.equal(s.wings.length,0);
});

test('ordinary enemies leave capacity for specialists and up to three bosses within the total cap', () => {
  const s=quiet(state(()=>.5));s.bossCap=3;
  for(let i=0;i<60;i++)C.spawnEnemy(s,'normal');assert.equal(s.enemies.filter(e=>['normal','gunner'].includes(e.type)).length,32);
  assert.ok(C.spawnEnemy(s,'stier'));assert.ok(C.spawnSpecial(s,'dinosauria'));assert.ok(C.spawnSpecial(s,'phoenix'));assert.ok(C.spawnSpecial(s,'morpho'));
  assert.ok(s.enemies.length<=70);assert.equal(s.enemies.filter(e=>e.type==='boss').length,3);
});

test('stage one permanently reserves three slots for later concurrent bosses', () => {
  const s=quiet(state());s.obstacles=[];s.enemies=Array.from({length:67},(_,i)=>({id:i+1,type:'stier',x:500,y:500,hp:1,r:1,dead:false}));s.nextId=68;
  assert.equal(C.spawnEnemy(s,'stier'),null);s.bossCap=1;assert.ok(C.spawnSpecial(s,'dinosauria'));
  s.bossCap=3;assert.ok(C.spawnSpecial(s,'phoenix'));assert.ok(C.spawnSpecial(s,'morpho'));
  assert.equal(s.enemies.length,70);assert.equal(s.enemies.filter(e=>e.type==='boss').length,3);
});

test('hostile hazards damage each wing once using their visible geometry', () => {
  const s=quiet(state());s.count=2;s.obstacles=[];s.aimX=500;s.aimY=200;s.angle=-Math.PI/2;
  const slot=C.formation(s)[1],source={id:81,type:'boss',model:'morpho',x:slot.x,y:300};
  C.addHazard(s,'beam',source,'rail',{x:slot.x,y:800,width:10},0,20);
  C.step(s,.01,{aimX:500,aimY:200,firing:false});assert.equal(s.wings[0].hp,16);assert.deepEqual(s.hazards[0].hitWingIds,[s.wings[0].id]);
  C.step(s,.01,{aimX:500,aimY:200,firing:false});assert.equal(s.wings[0].hp,16);
});

test('enemy bullets hit the main machine before a wing farther along the same path', () => {
  const s=quiet(state());s.count=4;s.obstacles=[];s.shield=0;s.aimX=500;s.aimY=200;s.angle=-Math.PI/2;C.formation(s);
  const rear=s.wings[2];s.bullets.push({x:500,y:400,px:500,py:400,vx:0,vy:6000,r:4,damage:6,enemy:true,life:1,model:'gunner',sourceId:9});
  C.step(s,.05,{aimX:500,aimY:200,firing:false});assert.equal(s.hp,s.maxHp-6);assert.equal(rear.hp,36);
});

test('small-arms hit protection does not erase a following boss heavy strike', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];s.shield=0;
  s.bullets.push({x:500,y:470,px:500,py:470,vx:0,vy:600,r:4,damage:6,enemy:true,life:1,model:'gunner',sourceId:7});
  C.addHazard(s,'beam',{id:8,type:'boss',model:'morpho',x:500,y:200},'rail',{x:500,y:800,width:20},.1,60);
  C.step(s,.05,{firing:false});assert.equal(s.hp,94);assert.equal(s.invulnerabilitySource,'chip');
  C.step(s,.05,{firing:false});assert.equal(s.hp,34);assert.equal(s.invulnerabilitySource,'heavy');assert.ok(s.invulnerable>=.75);
  assert.equal(C.hurt(s,6,false,{kind:'bullet'}),0,'heavy protection blocks a follow-up chip');
});

test('fixed-seed standing fire reaches the boss but cannot sustain itself on armor drops', () => {
  let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),s=state(random);let bossSeen=false,shieldItems=0,maxOrdinary=0;
  while(s.time<180&&!s.over){const near=s.enemies.filter(e=>!e.dead).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];if(s.burstCooldown<=0)C.useBurst(s);if(s.charges&&s.tacticCooldown<=0&&s.enemies.filter(e=>!e.dead&&Math.hypot(e.x-s.x,e.y-s.y)<280).length>=5)C.useTactic(s,{x:s.x,y:s.y});C.step(s,.05,{moveX:0,moveY:0,aimX:near?.x??900,aimY:near?.y??500,firing:true});bossSeen||=s.enemies.some(e=>e.type==='boss');shieldItems+=s.events.filter(e=>e.type==='collect'&&e.kind==='shield').length;maxOrdinary=Math.max(maxOrdinary,s.enemies.filter(e=>['normal','gunner'].includes(e.type)).length);}
  assert.equal(bossSeen,true);assert.equal(s.over,true);assert.ok(s.time>=32&&s.time<90);assert.equal(shieldItems,0);assert.ok(maxOrdinary<=32);
});

test('dash reserves the takeoff point from movement and spawns for safe fallback', () => {
  const s=quiet(state());s.obstacles=[];s.count=1;s.x=300;s.y=500;
  const enemy=C.spawnEnemy(s,'normal',230,500);enemy.speed=500;
  assert.ok(C.useAbility(s,'dash',{moveX:1,moveY:0}));
  const spawned=C.spawnEnemy(s,'normal',300,500);
  assert.ok(!spawned||Math.hypot(spawned.x-300,spawned.y-500)>=spawned.r+s.r);
  C.step(s,.05,{firing:false});
  assert.ok(Math.hypot(enemy.x-300,enemy.y-500)>=enemy.r+s.r-1e-6);
});

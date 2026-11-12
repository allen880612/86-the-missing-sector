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
  assert.deepEqual([s.tactic, s.charges, s.tacticRecharge, s.boss], ['support', 2, 30, 32]);
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
    ['repair', s => { s.hp = 40; }, s => assert.equal(s.hp, 52)],
    ['shield', s => { s.shield = 0; }, s => assert.equal(s.shield, 10)],
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

test('first supply pairs introduce both limited weapons, then split survival and utility', () => {
  const s = state(() => .5); s.spawn = s.boss = 999;
  assert.equal(s.pickupTimer, 8);
  for (let i = 0; i < 160; i++) C.step(s, .05, { firing: false });
  assert.deepEqual(s.crates.map(box => box.kind), ['shield', 'autocannon']);
  for (const box of s.crates) box.used = true;
  C.step(s, .05, { firing: false });
  for (let i = 0; i < 500; i++) C.step(s, .05, { firing: false });
  const survival = new Set(['repair', 'shield', 'recruit']);
  const offense = new Set(['heavyCannon', 'charge', 'ap', 'he', 'overdrive', 'emp', 'recruit']);
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
  assert.equal(boss.hp, 880);
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

test('later supply deliveries spawn every eighteen seconds in walkable space', () => {
  const s = state(() => .25); s.spawn = s.boss = 999;
  s.supplyGroup = 1; s.pickupTimer = 18;
  for (let i = 0; i < 359; i++) C.step(s, .05, { firing: false });
  assert.equal(s.crates.length, 0);
  C.step(s, .05, { firing: false });
  assert.equal(s.crates.length, 2);
  assert.equal(s.crates[0].group, s.crates[1].group);
  assert.notEqual(s.crates[0].kind, s.crates[1].kind);
  assert.equal(Math.hypot(s.crates[0].x - s.crates[1].x, s.crates[0].y - s.crates[1].y), 130);
  assert.ok(s.crates.every(box => box.life === 18 && box.hold === undefined));
});

test('the first minute delivers three small alternating survival supplies', () => {
  const s=state(()=>.25);s.spawn=s.boss=999;const survival=[];
  for(let i=0;i<1200;i++){C.step(s,.05,{firing:false});for(const event of s.events)if(event.type==='supplyChoice')survival.push(event.crates[0].kind);}
  assert.deepEqual(survival,['shield','repair','shield']);
  assert.equal(survival.reduce((sum,kind)=>sum+(kind==='shield'?10:12),0),32);
});

test('Morpho exposed state multiplies incoming damage and elite dimensions are distinct', () => {
  const s = quiet(state());
  const boss = C.spawnSpecial(s, 'morpho', 500, 200);
  boss.exposed = 2;
  assert.equal(C.damageEnemy(s, boss, 10), 16);
  assert.ok(boss.r >= 100 && boss.r <= 110);
  const charger = C.spawnEnemy(s, 'charger', 100, 100);
  const artillery = C.spawnEnemy(s, 'artillery', 900, 900);
  assert.deepEqual([charger.r, charger.max, artillery.r, artillery.max], [32, 360, 36, 420]);
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
  assert.equal(s.hp, 52);
  assert.ok(s.events.some(e => e.type === 'collect'));
});

test('drops relocate from world edges and cover interiors to reachable ground', () => {
  const s=quiet(state());s.count=1;const reachable=box=>box.x>=s.bounds.left&&box.x<=s.bounds.right&&box.y>=s.bounds.top&&box.y<=s.bounds.bottom&&s.obstacles.every(o=>{const nx=Math.max(o.x-o.w/2,Math.min(o.x+o.w/2,box.x)),ny=Math.max(o.y-o.h/2,Math.min(o.y+o.h/2,box.y));return Math.hypot(box.x-nx,box.y-ny)>=s.r;});
  for(const [x,y] of [[0,0],[290,330]]){s.normalKills=11;const enemy=C.spawnEnemy(s,'normal',150,150);enemy.x=x;enemy.y=y;C.damageEnemy(s,enemy,enemy.hp);assert.ok(reachable(s.crates.at(-1)),`drop at ${x},${y} must move to reachable ground`);}
  const timed=state(()=>.25);timed.spawn=timed.boss=999;for(let i=0;i<1200;i++)C.step(timed,.05,{firing:false});assert.ok(timed.crates.every(reachable));
});

test('charger locks a dash, hurts on contact, then survives in stagger', () => {
  const s = quiet(state());
  s.count = 1;
  const charger = C.spawnEnemy(s, 'charger', 350, 550);
  for (let i = 0; i < 36; i++) C.step(s, 0.05, { moveX: 0, moveY: 0, aimX: 900, aimY: 500, firing: false });
  assert.ok(s.hp < s.maxHp || s.shield < 25);
  assert.equal(charger.dead, false);
  assert.equal(charger.phase, 'stagger');
});

test('legacy decoy normalizes to support and support charges reliably recharge', () => {
  const s = quiet(state(() => 0.5, { tactic: 'decoy' }));
  assert.equal(s.tactic, 'support');
  s.charges = 0; s.tacticRecharge = .05;
  C.step(s, .05, { firing: false });
  assert.equal(s.charges, 1);
  assert.equal(s.tacticRecharge, 30);
  assert.ok(s.events.some(e => e.type === 'tacticRecharge' && e.charges === 1 && e.cooldown===30));
});

test('support clears ordinary units, briefly interrupts elites, and cannot be spammed', () => {
  const s=quiet(state());s.count=1;s.invulnerable=999;
  for(const [type,x,y] of [['normal',560,500],['shield',420,500],['charger',500,620]]){const e=C.spawnEnemy(s,type,x,y);e.speed=0;}
  const boss=C.spawnSpecial(s,'dinosauria',500,250);boss.hp=boss.max=1000;boss.speed=0;
  C.useTactic(s,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});
  assert.equal(s.enemies.some(e=>e.type==='normal'),false);assert.ok(s.enemies.find(e=>e.type==='shield').stagger<=.8&&s.enemies.find(e=>e.type==='shield').stagger>.7);
  assert.equal(boss.hp,880);assert.equal(boss.stagger,0);assert.equal(C.useTactic(s,{x:500,y:500}),false);
  const impact=s.events.find(e=>e.type==='mortarImpact'&&e.kind==='support');assert.equal(impact.r,280);assert.equal(impact.hits.length,4);
  for(let i=0;i<108;i++)C.step(s,.05,{firing:false});assert.equal(C.useTactic(s,{x:500,y:500}),true);
});

test('support cannot interrupt an armored boss windup but exposed armor takes high damage without extending its window', () => {
  const s=quiet(state());s.count=1;s.invulnerable=999;
  const boss=C.spawnSpecial(s,'morpho',500,250);boss.hp=boss.max=1200;boss.speed=0;
  C.addHazard(s,'beam',boss,'rail',{x:500,y:900,width:58},1.5,44);
  C.addHazard(s,'circle',boss,'mortar',{x:550,y:500,r:82},1.8,28);
  const fired={...s.hazards[1],fired:true,life:2};s.hazards.push(fired);
  C.useTactic(s,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(s,.05,{firing:false});
  assert.equal(boss.hp,1080);
  assert.equal(s.hazards.some(h=>!h.fired&&h.source===boss.id),true);
  assert.ok(s.hazards.includes(fired));
  assert.equal(s.stats.interrupts,0);
  const hit=s.events.find(e=>e.type==='mortarImpact'&&e.kind==='support').hits.find(hit=>hit.id===boss.id);
  assert.equal(hit.interrupted,false);

  const exposed=quiet(state());exposed.count=1;const target=C.spawnSpecial(exposed,'morpho',500,250);target.hp=target.max=1200;target.speed=0;target.exposed=1.2;C.addHazard(exposed,'beam',target,'rail',{x:500,y:900,width:58},1.5,44);C.useTactic(exposed,{x:500,y:500});for(let i=0;i<13;i++)C.step(exposed,.05,{firing:false});
  assert.equal(target.hp,720);assert.ok(target.exposed<=.56&&target.exposed>.5);assert.equal(exposed.hazards.some(h=>!h.fired&&h.source===target.id),false);
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

test('special composition cycles light disruptors more often than heavy specialists', () => {
  const s=quiet(state(()=>0));s.time=40;s.wave=3;s.threatStage=1;s.obstacles=[];const seen=[];
  for(let i=0;i<20;i++){s.spawn=0;C.step(s,.01,{firing:false});seen.push(...s.enemies.filter(e=>!e.dead).map(e=>e.type));s.enemies=[];}
  assert.ok(seen.filter(type=>['scout','jammer','mine','swarm'].includes(type)).length>seen.filter(type=>['shield','stier'].includes(type)).length);
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

test('drops count support mobs as ordinary while true elites and bosses pay better', () => {
  const s = quiet(state()); s.count = 1; s.hp = 20; s.shield = 80;
  for (let i = 0; i < 11; i++) { const e=C.spawnEnemy(s,'normal',120,180); C.damageEnemy(s,e,e.hp); }
  assert.equal(s.crates.length, 0);
  let e=C.spawnEnemy(s,'normal',700,180); C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length, 1); assert.equal(s.crates[0].kind, 'shield');
  s.crates=[];s.hp=s.maxHp;s.shield=0;
  e=C.spawnEnemy(s,'charger',200,200);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.at(-1).kind,'weapon');
  e=C.spawnEnemy(s,'artillery',800,200);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length,2,'each durable elite pays a premium reward');assert.equal(s.crates.at(-1).kind,'autocannon');
  s.normalKills=11;e=C.spawnEnemy(s,'scout',500,150);C.damageEnemy(s,e,e.hp);
  assert.equal(s.crates.length,3);assert.equal(s.crates.at(-1).kind,'repair');assert.ok(!s.events.some(event=>event.type==='eliteDown'&&event.sourceId===e.id));
  const boss=C.spawnSpecial(s,'dinosauria',500,250);C.damageEnemy(s,boss,boss.hp);
  assert.equal(s.crates.length,5,'boss always drops two rewards');assert.deepEqual(s.crates.slice(-2).map(box=>box.kind),['weapon','heavyCannon']);

  const cycle=quiet(state());cycle.count=1;cycle.hp=1;cycle.shield=0;
  for(let i=0;i<72;i++){const normal=C.spawnEnemy(cycle,'normal',120,180);C.damageEnemy(cycle,normal,normal.hp);}
  assert.deepEqual(cycle.crates.map(box=>box.kind),['shield','repair','shield','repair','charge','repair']);
});

test('all support mobs share the small-drop counter, same-tick elites pay, and a boss drops two legal distinct rewards', () => {
  const s=quiet(state());s.count=1;s.x=s.y=900;s.obstacles=[];const small=['scout','jammer','mine','swarm'];
  for(let i=0;i<12;i++){const e=C.spawnEnemy(s,small[i%small.length],150+i*45,180+(i%2)*80);C.damageEnemy(s,e,e.hp);}
  assert.deepEqual(s.crates.map(box=>box.kind),['shield']);assert.equal(s.events.some(event=>event.type==='eliteDown'&&small.includes(event.kind)),false);
  const before=s.crates.length;for(const [type,x] of [['charger',250],['stier',700]]){const e=C.spawnEnemy(s,type,x,500);C.damageEnemy(s,e,e.hp);}assert.equal(s.crates.length,before+2);assert.ok(s.crates.slice(-2).every(box=>box.premium));
  const boss=C.spawnSpecial(s,'phoenix',500,500);C.damageEnemy(s,boss,boss.hp);const rewards=s.crates.slice(-2);assert.equal(rewards.length,2);assert.equal(new Set(rewards.map(box=>box.kind)).size,2);assert.equal(rewards[0].kind,'weapon');assert.ok(rewards.every(box=>box.x>=s.bounds.left&&box.x<=s.bounds.right&&box.y>=s.bounds.top&&box.y<=s.bounds.bottom));
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

test('jammers at the main machine reduce wing range and killing them immediately restores it', () => {
  const s=quiet(state());s.count=2;s.obstacles=[];
  const target=C.spawnEnemy(s,'normal',740,542),jammer=C.spawnEnemy(s,'jammer',560,700);target.speed=jammer.speed=0;
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
  assert.equal(boss.model,'phoenix');assert.deepEqual([boss.max,boss.r,boss.speed],[2800,48,240]);
  C.damageEnemy(s,boss,boss.hp);s.boss=0;C.step(s,.05,{firing:false});
  boss=s.enemies.find(e=>e.type==='boss'&&!e.dead);assert.equal(boss.model,'morpho');
  C.damageEnemy(s,boss,boss.hp);s.boss=0;C.step(s,.05,{firing:false});
  boss=s.enemies.find(e=>e.type==='boss'&&!e.dead);assert.equal(boss.model,'dinosauria');
});

test('Phoenix stalks, warns, dashes continuously, then exposes after its follow-up slash', () => {
  const s=quiet(state(()=>.5,{bossModel:'phoenix'}));s.count=1;s.x=800;s.y=500;s.obstacles=[];
  const boss=C.spawnSpecial(s,'phoenix',300,500);boss.intro=0;boss.cooldown=0;
  C.step(s,.05,{firing:false});
  assert.equal(boss.phase,'stalk');assert.ok(s.events.some(e=>e.type==='phoenixStalk'&&e.duration===1.8));
  const before={x:boss.x,y:boss.y};for(let i=0;i<35;i++)C.step(s,.05,{firing:false});assert.ok(Math.hypot(boss.x-before.x,boss.y-before.y)>50);
  C.step(s,.05,{firing:false});assert.equal(boss.phase,'windup');assert.ok(s.events.some(e=>e.type==='phoenixCue'&&e.delay===.8));assert.equal(s.stats.bossShots,1);
  for(let i=0;i<16;i++)C.step(s,.05,{firing:false});
  assert.equal(boss.phase,'dash');const beforeDash=Math.hypot(boss.lockedX-boss.x,boss.lockedY-boss.y);
  C.step(s,.05,{firing:false});const afterDash=Math.hypot(boss.lockedX-boss.x,boss.lockedY-boss.y);assert.ok(afterDash<beforeDash&&afterDash>0,'dash advances without teleporting');
  for(let i=0;i<30&&boss.phase==='dash';i++)C.step(s,.05,{firing:false});assert.equal(boss.phase,'slashWindup');
  for(let i=0;i<30&&boss.phase!=='recover';i++)C.step(s,.05,{firing:false});assert.equal(boss.phase,'recover');assert.ok(boss.exposed>1.7);assert.ok(s.events.some(e=>e.type==='phoenixRecover'));
  boss.revealed=0;C.damageEnemy(s,boss,10);assert.ok(boss.revealed>=1.5);

  const interrupted=quiet(state());interrupted.count=1;interrupted.obstacles=[];
  const target=C.spawnSpecial(interrupted,'phoenix',500,300);target.hp=target.max=900;target.phase='slashWindup';target.windup=.8;
  C.addHazard(interrupted,'sector',target,'blade',{x:target.x,y:target.y,r:185,angle:Math.PI/2,halfAngle:Math.PI*5/12,heavy:true},.8,20);C.useTactic(interrupted,{x:500,y:500});
  for(let i=0;i<13;i++)C.step(interrupted,.05,{firing:false});
  assert.equal(target.phase,'slashWindup');assert.equal(target.stagger,0);assert.equal(target.exposed,0);assert.equal(target.revealed,3.5);assert.ok(interrupted.hazards.some(h=>!h.fired&&h.source===target.id));
});

test('Phoenix follow-up slash locks its warned angle before recovery', () => {
  const combo=quiet(state());combo.count=1;combo.obstacles=[];combo.x=800;const phase2=C.spawnSpecial(combo,'phoenix',400,500);phase2.bossStage=2;phase2.phase='dash';phase2.lockedX=405;phase2.lockedY=500;phase2.dashLeft=5;
  C.step(combo,.05,{firing:false});const follow=combo.hazards.find(h=>h.geometry==='sector');assert.equal(phase2.phase,'slashWindup');assert.deepEqual([follow.r,follow.halfAngle,follow.maxDelay],[165,Math.PI/3,.75]);const locked=follow.angle;combo.x=850;combo.y=700;for(let i=0;i<15;i++)C.step(combo,.05,{firing:false});assert.equal(follow.angle,locked);assert.ok(follow.fired);assert.equal(phase2.phase,'slash');for(let i=0;i<6&&phase2.phase!=='recover';i++)C.step(combo,.05,{firing:false});assert.equal(phase2.phase,'recover');assert.ok(phase2.exposed>1.7);
});

test('sector hazards share exact player and wing geometry while player dash avoids blades', () => {
  const s=quiet(state());s.count=2;s.obstacles=[];s.aimX=500;s.aimY=200;s.angle=-Math.PI/2;const slot=C.formation(s)[1],source={id:71,type:'boss',model:'phoenix',x:slot.x-100,y:slot.y};
  C.addHazard(s,'sector',source,'blade',{x:source.x,y:source.y,r:150,angle:0,halfAngle:.2,heavy:true},0,20);C.step(s,.01,{aimX:500,aimY:200,firing:false});assert.equal(s.wings[0].hp,48);assert.equal(s.hp,s.maxHp);
  const evade=quiet(state());evade.count=1;evade.obstacles=[];C.useAbility(evade,'dash',{moveX:1});const attacker={id:72,type:'boss',model:'phoenix',x:evade.x-30,y:evade.y};C.addHazard(evade,'sector',attacker,'blade',{x:attacker.x,y:attacker.y,r:185,angle:0,halfAngle:1,heavy:true},0,26);const hp=evade.hp;C.step(evade,.01,{firing:false});assert.equal(evade.hp,hp);
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
  assert.equal(target.phase,'cooling');assert.equal(target.windup,0);assert.ok(target.stagger>.7&&target.cooling<=.8);
  assert.equal(interrupted.hazards.some(h=>!h.fired&&h.source===target.id),false);
});

test('Gunner replaces normal spawns after twelve seconds and fires dodgeable enemy bullets', () => {
  const spawned=quiet(state(()=>0));assert.ok(C.spawnEnemy(spawned,'gunner'));
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

test('waves advance every thirty seconds and every three waves raises the threat tier', () => {
  const s=quiet(state());
  for(const [time,wave,stage,cap] of [[89.95,4,2,2],[179.95,7,3,3],[359.95,13,5,4]]){
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

test('heavy attackers keep warned damage and boss health scales linearly by wave', () => {
  const dino=quiet(state());dino.count=1;dino.obstacles=[];const boss=C.spawnSpecial(dino,'dinosauria',500,150);boss.intro=0;boss.cooldown=0;
  C.step(dino,.05,{firing:false});assert.deepEqual(dino.hazards.filter(h=>h.source===boss.id).map(h=>h.damage).sort((a,b)=>a-b),[30,36,36,36]);
  const morpho=quiet(state());morpho.count=1;morpho.obstacles=[];const rail=C.spawnSpecial(morpho,'morpho',500,150);rail.intro=0;rail.cooldown=0;
  C.step(morpho,.05,{firing:false});assert.equal(morpho.hazards.find(h=>h.source===rail.id&&h.geometry==='beam').damage,45);
  const late=quiet(state());late.time=360;late.wave=9;late.threatStage=3;late.bossCap=3;const scaled=C.spawnSpecial(late,'phoenix');assert.equal(scaled.max,4880);
  const stier=C.spawnEnemy(late,'stier',200,500);stier.cooldown=0;stier.speed=0;C.step(late,.05,{firing:false});
  assert.ok(late.hazards.filter(h=>h.source===stier.id).some(h=>Math.abs(h.damage-32*stier.damageScale)<1e-9));
});

test('enemy damage ramps linearly with early-wave relief', () => {
  const scales=[];for(const wave of [1,5,9]){const s=quiet(state());s.time=(wave-1)*20;s.wave=wave;s.threatStage=1+Math.floor((wave-1)/3);const e=C.spawnEnemy(s,'stier',200,500);scales.push(e.damageScale);}
  assert.deepEqual(scales,[.75,.9*1.08,1.16]);
  const phoenix=quiet(state());phoenix.count=1;phoenix.obstacles=[];phoenix.shield=0;const boss=C.spawnSpecial(phoenix,'phoenix');boss.x=430;boss.y=500;boss.phase='dash';boss.lockedX=650;boss.lockedY=500;boss.dashLeft=220;
  C.step(phoenix,.01,{firing:false});assert.equal(phoenix.hp,phoenix.maxHp-30*.75);
});

test('weapon levels grow forever and milestones add a bounded secondary shell', () => {
  const s=quiet(state());s.count=1;s.level=11;
  C.collect(s,{kind:'weapon',x:500,y:500,used:false});assert.equal(s.level,12);
  assert.ok(s.events.some(e=>e.type==='weaponMilestone'&&e.level===12&&e.tier===1));
  for(let i=0;i<3;i++){s.shot=0;C.step(s,.01,{aimX:900,aimY:500,firing:true});}assert.equal(s.bullets.filter(b=>!b.enemy).length,4);
  const early=s.bullets[0].damage;s.bullets=[];s.shot=0;s.level=28;
  for(let i=0;i<3;i++){s.shot=0;C.step(s,.01,{aimX:900,aimY:500,firing:true});}assert.equal(s.bullets.length,4);assert.ok(s.bullets[0].damage>early);assert.ok(s.bullets.at(-1).damage<s.bullets[0].damage);
  s.level=100;C.collect(s,{kind:'weapon',x:500,y:500,used:false});assert.equal(s.level,101);
});

test('wingmen keep health, can be damaged, and recover from warned local hijacking', () => {
  const s=quiet(state());s.count=3;s.obstacles=[];C.formation(s);
  assert.deepEqual(s.wings.map(w=>w.hp),[60,60]);const slot=C.formation(s)[1];
  s.bullets.push({x:slot.x,y:slot.y-30,px:slot.x,py:slot.y-30,vx:0,vy:600,r:4,damage:9,enemy:true,life:1,model:'gunner',sourceId:77});
  C.step(s,.05,{firing:false});assert.equal(s.wings[0].hp,51);assert.ok(s.events.some(e=>e.type==='wingHit'&&e.wingId===s.wings[0].id));
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
  C.collect(s,{kind:'recruit',x:500,y:500,used:false});assert.deepEqual(s.wings.map(w=>w.hp),[34,34,34]);assert.equal(s.count,4);
  C.hurt(s,s.hp,true,{kind:'rail'});assert.equal(s.count,0);assert.equal(C.formation(s).length,1);assert.equal(s.count,0);assert.equal(s.wings.length,0);
});

test('ordinary enemies leave capacity for specialists and up to three bosses within the total cap', () => {
  const s=quiet(state(()=>.5));s.bossCap=3;
  for(let i=0;i<60;i++)C.spawnEnemy(s,'normal');assert.equal(s.enemies.filter(e=>['normal','gunner'].includes(e.type)).length,24);
  assert.ok(C.spawnEnemy(s,'stier'));assert.ok(C.spawnSpecial(s,'dinosauria'));assert.ok(C.spawnSpecial(s,'phoenix'));assert.ok(C.spawnSpecial(s,'morpho'));
  assert.ok(s.enemies.length<=70);assert.equal(s.enemies.filter(e=>e.type==='boss').length,3);
});

test('stage one permanently reserves five slots for later concurrent bosses', () => {
  const s=quiet(state());s.obstacles=[];s.enemies=Array.from({length:65},(_,i)=>({id:i+1,type:'stier',x:500,y:500,hp:1,r:1,dead:false}));s.nextId=66;
  assert.equal(C.spawnEnemy(s,'stier'),null);s.bossCap=5;
  for(const [i,model] of ['dinosauria','phoenix','morpho','phoenix','dinosauria'].entries())assert.ok(C.spawnSpecial(s,model,100+i*190,100+(i%2)*700));
  assert.equal(s.enemies.length,70);assert.equal(s.enemies.filter(e=>e.type==='boss').length,5);
});

test('hostile hazards damage each wing once using their visible geometry', () => {
  const s=quiet(state());s.count=2;s.obstacles=[];s.aimX=500;s.aimY=200;s.angle=-Math.PI/2;
  const slot=C.formation(s)[1],source={id:81,type:'boss',model:'morpho',x:slot.x,y:300};
  C.addHazard(s,'beam',source,'rail',{x:slot.x,y:800,width:10},0,20);
  C.step(s,.01,{aimX:500,aimY:200,firing:false});assert.equal(s.wings[0].hp,40);assert.deepEqual(s.hazards[0].hitWingIds,[s.wings[0].id]);
  C.step(s,.01,{aimX:500,aimY:200,firing:false});assert.equal(s.wings[0].hp,40);
});

test('enemy bullets hit the main machine before a wing farther along the same path', () => {
  const s=quiet(state());s.count=4;s.obstacles=[];s.shield=0;s.aimX=500;s.aimY=200;s.angle=-Math.PI/2;C.formation(s);
  const rear=s.wings[2];s.bullets.push({x:500,y:400,px:500,py:400,vx:0,vy:6000,r:4,damage:6,enemy:true,life:1,model:'gunner',sourceId:9});
  C.step(s,.05,{aimX:500,aimY:200,firing:false});assert.equal(s.hp,s.maxHp-6);assert.equal(rear.hp,60);
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

test('three discoverable maps create distinct 1600 worlds with legal starts and obstacle kinds', () => {
  assert.deepEqual(Object.keys(C.maps), ['ruins','depot','rail']);
  const signatures=[];
  for(const map of Object.keys(C.maps)){
    const s=state(()=>.5,{map});assert.equal(s.mapId,map);assert.deepEqual(s.worldBounds,{left:0,right:1600,top:0,bottom:1600});assert.deepEqual([s.x,s.y],[800,800]);
    assert.ok(s.obstacles.some(o=>o.kind==='wall'&&o.height==='high'));assert.ok(s.obstacles.some(o=>o.kind==='cover'&&o.height==='low'));assert.ok(s.obstacles.every(o=>!o.dead));
    assert.ok(s.obstacles.every(o=>{const nx=Math.max(o.x-o.w/2,Math.min(o.x+o.w/2,s.x)),ny=Math.max(o.y-o.h/2,Math.min(o.y+o.h/2,s.y));return Math.hypot(s.x-nx,s.y-ny)>=s.r;}));
    signatures.push(s.obstacles.map(o=>[o.x,o.y,o.w,o.h]).join('|'));
  }
  assert.equal(new Set(signatures).size,3);
});

test('large worlds retain entities beyond 1000 and spawn every enemy size legally at 1600 edges', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.obstacles=[];s.count=1;
  s.bullets.push({x:1100,y:800,px:1100,py:800,vx:10,vy:0,r:3,damage:1,enemy:false,life:5,hitIds:[]});C.step(s,.05,{firing:false});assert.equal(s.bullets.length,1);
  for(const type of ['normal','stier'])for(let side=0;side<4;side++){s.spawnSide=side;const e=C.spawnEnemy(s,type);assert.ok(e);assert.ok(e.x-e.r>=0&&e.x+e.r<=1600&&e.y-e.r>=0&&e.y+e.r<=1600);e.dead=true;}
  s.bossCap=3;for(let side=0;side<3;side++){s.spawnSide=side;const e=C.spawnSpecial(s,['dinosauria','phoenix','morpho'][side]);assert.ok(e);assert.ok(e.x-e.r>=0&&e.x+e.r<=1600&&e.y-e.r>=0&&e.y+e.r<=1600);}
});

test('large-map spawns stay just outside the local view and expose their approach side', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.obstacles=[];
  const enemies=Array.from({length:4},()=>C.spawnEnemy(s,'normal'));for(const e of enemies){const d=Math.hypot(e.x-s.x,e.y-s.y);assert.ok(d>=540&&d<=680);assert.ok(['top','right','bottom','left'].includes(e.side));}
  s.bossCap=2;const boss=C.spawnSpecial(s,'dinosauria');const enter=s.events.find(e=>e.type==='bossEnter');assert.deepEqual([enter.spawnSide,enter.sourceX,enter.sourceY],[boss.side,boss.x,boss.y]);
});

test('boss warning reserves the same offscreen entry point used five seconds later', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.x=s.y=200;s.boss=5.01;s.bossWarned=false;C.step(s,.05,{firing:false});const warning=s.events.find(e=>e.type==='warning'&&e.kind==='boss');assert.ok(warning.spawnSide);assert.ok(Math.hypot(warning.sourceX-s.x,warning.sourceY-s.y)>=540);
  s.boss=0;C.step(s,.05,{firing:false});const boss=s.enemies.find(e=>e.type==='boss');assert.deepEqual([boss.side,boss.x,boss.y],[warning.spawnSide,warning.sourceX,warning.sourceY]);
});

test('permanent walls block shots and the full dash path while low cover remains destructible and dashable', () => {
  const wall=quiet(state(()=>.5,{map:'ruins'}));wall.count=1;wall.x=500;wall.y=800;wall.obstacles=[{id:'wall',kind:'wall',x:590,y:800,w:40,h:300,dead:false}];
  assert.equal(C.useAbility(wall,'dash',{moveX:1}),false);assert.equal(wall.dashCooldown,0);
  const source={id:99,type:'boss',model:'morpho',x:500,y:800};C.addHazard(wall,'beam',source,'rail',{x:800,y:800,width:20,heavy:true},0,60);C.step(wall,.01,{firing:false});assert.equal(wall.obstacles[0].dead,false);assert.equal(wall.obstacles[0].hp,undefined);
  const cover=quiet(state(()=>.5,{map:'ruins'}));cover.count=1;cover.x=500;cover.y=800;cover.obstacles=[{id:'cover',kind:'cover',x:590,y:800,w:40,h:100,hp:180,max:180,dead:false}];assert.equal(C.useAbility(cover,'dash',{moveX:1}),true);
});

test('map routes carry a large enemy around more than one permanent wall without entering either', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.x=1250;s.y=800;s.obstacles=[{id:'a',kind:'wall',x:500,y:800,w:180,h:500,dead:false},{id:'b',kind:'wall',x:700,y:400,w:180,h:500,dead:false}];
  const e=C.spawnSpecial(s,'dinosauria',180,800);e.intro=999;e.speed=90;const before=Math.hypot(e.x-s.x,e.y-s.y);
  for(let i=0;i<500;i++){C.updateEnemy(s,e,.05);assert.ok(s.obstacles.every(o=>{const nx=Math.max(o.x-o.w/2,Math.min(o.x+o.w/2,e.x)),ny=Math.max(o.y-o.h/2,Math.min(o.y+o.h/2,e.y));return Math.hypot(e.x-nx,e.y-ny)>=e.r-1e-6;}));}
  assert.ok(Math.hypot(e.x-s.x,e.y-s.y)<before-300,`enemy only reached ${e.x},${e.y}`);
});

test('map supply anchors and relocated drops are inside reachable walkable world space', () => {
  for(const map of Object.keys(C.maps)){const s=quiet(state(()=>.25,{map}));s.pickupTimer=0;C.step(s,.05,{firing:false});for(const box of s.crates)assert.ok(box.x>=s.bounds.left&&box.x<=s.bounds.right&&box.y>=s.bounds.top&&box.y<=s.bounds.bottom&&s.obstacles.every(o=>{const nx=Math.max(o.x-o.w/2,Math.min(o.x+o.w/2,box.x)),ny=Math.max(o.y-o.h/2,Math.min(o.y+o.h/2,box.y));return Math.hypot(box.x-nx,box.y-ny)>=s.r;}));}
});

test('finite weapon pickups switch slots, preserve ammo, and consume only for a clear aimed target', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.obstacles=[];s.enemies=[];
  assert.deepEqual([C.weapons[2].kind,C.weapons[2].max,C.weapons[3].kind,C.weapons[3].max],['autocannon',120,'heavy',18]);C.collect(s,{kind:'autocannon',x:s.x,y:s.y,used:false});C.collect(s,{kind:'heavyCannon',x:s.x,y:s.y,used:false});assert.deepEqual(s.specialAmmo,{autocannon:120,heavy:18});
  const items=s.stats.items;C.collect(s,{kind:'autocannon',x:s.x,y:s.y,used:false});assert.equal(s.stats.items,items+1);assert.equal(s.specialAmmo.autocannon,120);
  assert.equal(C.selectWeapon(s,2),true);assert.equal(s.weaponSlot,2);C.step(s,.05,{aimX:1200,aimY:800,firing:true});assert.equal(s.specialAmmo.autocannon,120);
  const target=C.spawnEnemy(s,'normal',1050,800);target.speed=0;s.shot=0;C.step(s,.05,{aimX:1200,aimY:800,firing:true});assert.equal(s.specialAmmo.autocannon,119);assert.ok(s.bullets.some(b=>b.ammo==='autocannon'));
  const saved=s.specialAmmo.autocannon;assert.equal(C.selectWeapon(s,3),true);assert.equal(C.selectWeapon(s,2),true);assert.equal(s.specialAmmo.autocannon,saved);assert.ok(s.events.some(e=>e.type==='weaponSwitch'&&e.slot===2));
});

test('finite weapons do not fire through cover and depletion returns to the infinite main cannon', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.x=500;s.y=800;s.obstacles=[{id:'wall',kind:'wall',x:700,y:800,w:40,h:300,dead:false}];const target=C.spawnEnemy(s,'normal',900,800);target.speed=0;s.specialAmmo={autocannon:1,heavy:1};C.selectWeapon(s,2);
  C.step(s,.05,{aimX:1000,aimY:800,firing:true});assert.equal(s.specialAmmo.autocannon,1);
  s.obstacles=[];s.shot=0;C.step(s,.05,{aimX:1000,aimY:800,firing:true});assert.deepEqual([s.specialAmmo.autocannon,s.weaponSlot],[0,1]);assert.ok(s.events.some(e=>e.type==='weaponDepleted'&&e.kind==='autocannon'));
  s.shot=0;C.step(s,.05,{aimX:1000,aimY:800,firing:true});assert.equal(s.specialAmmo.autocannon,0);assert.ok(s.bullets.some(b=>b.ammo==='standard'));
});

test('heavy cannon spends one round and penetrates four aligned enemies before a permanent wall', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.x=500;s.y=800;s.obstacles=[{id:'wall',kind:'wall',x:1250,y:800,w:40,h:300,dead:false}];const targets=[700,820,940,1060,1340].map(x=>{const e=C.spawnEnemy(s,'normal',x,800);e.hp=e.max=300;e.speed=0;return e;});s.specialAmmo={autocannon:0,heavy:18};C.selectWeapon(s,3);C.step(s,.05,{aimX:1400,aimY:800,firing:true});assert.equal(s.specialAmmo.heavy,17);
  for(let i=0;i<25;i++)C.step(s,.05,{aimX:1400,aimY:800,firing:false});assert.ok(targets.slice(0,4).every(e=>e.hp<300));assert.equal(targets[4].hp,300);assert.equal(s.obstacles[0].dead,false);
});

test('v40 waves use thirty-second linear scaling and staged boss capacity', () => {
  const s=quiet(state());s.obstacles=[];const samples=[];
  for(const wave of [1,10,28]){s.wave=wave;s.threatStage=1+Math.floor((wave-1)/3);const normal=C.spawnEnemy(s,'normal',100+wave*20,100);const stier=C.spawnEnemy(s,'stier',100+wave*20,300);samples.push([normal.max,stier.max,normal.damageScale]);normal.dead=stier.dead=true;}
  assert.deepEqual(samples,[[32,750,.75],[59,1380,1.18],[113,2640,1.54]]);
  for(const [time,wave,tier,cap] of [[89.95,4,2,2],[179.95,7,3,3],[359.95,13,5,4],[539.95,19,7,5]]){const pace=quiet(state());pace.time=time;C.step(pace,.05,{firing:false});assert.deepEqual([pace.wave,pace.threatStage,pace.bossCap],[wave,tier,cap]);}
});

test('v39 player growth is bounded and milestone shell fires every third main shot', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];s.level=28;
  for(let i=0;i<3;i++){s.shot=0;C.fire(s,C.machines.m1a4);}
  assert.equal(s.bullets.filter(b=>b.milestone).length,1);assert.equal(s.bullets.filter(b=>!b.milestone)[0].damage,70);
});

test('v39 ordinary drops sustain while elite and boss drops include premium rewards', () => {
  const s=quiet(state());s.obstacles=[];const ordinary=[];
  for(let cycle=0;cycle<4;cycle++){s.normalKills=11;const e=C.spawnEnemy(s,'normal',100+cycle*50,100);C.damageEnemy(s,e,e.hp);ordinary.push(s.crates.at(-1).kind);}
  assert.deepEqual(ordinary,['shield','repair','shield','repair']);assert.ok(!ordinary.includes('weapon'));
  const elite=[];for(let i=0;i<6;i++){s.time+=8;const e=C.spawnEnemy(s,'stier',100+i*70,300);C.damageEnemy(s,e,e.hp);elite.push(s.crates.at(-1).kind);}
  assert.ok(elite.includes('autocannon')&&elite.includes('heavyCannon')&&elite.includes('weapon'));
  s.bossCap=1;const boss=C.spawnSpecial(s,'phoenix',800,800);C.damageEnemy(s,boss,boss.hp);assert.ok(['weapon','heavyCannon','autocannon','overdrive'].includes(s.crates.at(-1).kind));
});

test('v39 swarm members have independent health and share a flock id', () => {
  const rolls=[0],s=quiet(state(()=>rolls.length?rolls.shift():.5));s.obstacles=[];s.time=150;s.wave=6;s.waveKind='normal';s.threatStage=2;s.eliteQueue=[];s.spawn=0;s.specialIndex=3;
  C.step(s,.01,{firing:false});const flock=s.enemies.filter(e=>e.type==='swarm');assert.equal(flock.length,6);assert.equal(new Set(flock.map(e=>e.flockId)).size,1);assert.equal(flock.filter(e=>e.flockLeader).length,1);
  assert.ok(flock.every((a,i)=>flock.slice(i+1).every(b=>Math.hypot(a.x-b.x,a.y-b.y)<=160)));
  C.damageEnemy(s,flock[0],flock[0].hp);assert.equal(flock.filter(e=>!e.dead).length,5);
});

test('v39 wings have durable HP, reduced AoE damage, and repair restores them', () => {
  const s=quiet(state());s.count=3;s.obstacles=[];s.angle=-Math.PI/2;C.formation(s);assert.deepEqual(s.wings.map(w=>w.hp),[60,60]);
  C.addHazard(s,'circle',{id:80,type:'boss',model:'dinosauria',x:s.x,y:s.y},'mortar',{x:s.x,y:s.y,r:100},0,30);C.step(s,.01,{firing:false});assert.deepEqual(s.wings.map(w=>w.hp),[42,42]);
  C.collect(s,{kind:'repair',x:s.x,y:s.y,used:false});assert.deepEqual(s.wings.map(w=>w.hp),[54,54]);
});

test('v39 limited weapons retain a late-game damage advantage', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];s.level=30;s.aimX=900;s.aimY=500;const target=C.spawnEnemy(s,'stier',800,500);target.speed=0;s.specialAmmo={autocannon:1,heavy:1};
  C.selectWeapon(s,2);C.fire(s,C.machines.m1a4);assert.ok(s.bullets.at(-1).damage>=27);
  s.shot=0;C.selectWeapon(s,3);C.fire(s,C.machines.m1a4);assert.ok(s.bullets.at(-1).damage>=168&&s.bullets.at(-1).left>=5);
});

test('v39 Phoenix routes around permanent walls and sector blades do not cut through them', () => {
  const s=quiet(state(()=>.5,{map:'ruins'}));s.count=1;s.x=900;s.y=800;s.obstacles=[{id:'wall',kind:'wall',x:600,y:800,w:100,h:500,dead:false}];const phoenix=C.spawnSpecial(s,'phoenix',300,800);phoenix.intro=0;phoenix.cooldown=999;
  const before=Math.hypot(phoenix.x-s.x,phoenix.y-s.y);let detour=0;for(let i=0;i<120;i++){C.step(s,.05,{firing:false});detour=Math.max(detour,Math.abs(phoenix.y-800));}assert.ok(Math.hypot(phoenix.x-s.x,phoenix.y-s.y)<before-100);assert.ok(detour>100);
  const blocked=quiet(state(()=>.5,{map:'ruins'}));blocked.count=1;blocked.x=900;blocked.y=800;blocked.obstacles=[{id:'wall',kind:'wall',x:600,y:800,w:100,h:500,dead:false}];const attacker=C.spawnSpecial(blocked,'phoenix',300,800),hp=blocked.hp;C.addHazard(blocked,'sector',attacker,'blade',{x:attacker.x,y:attacker.y,r:900,angle:0,halfAngle:1,heavy:true},0,40);C.step(blocked,.01,{firing:false});assert.equal(blocked.hp,hp);
});

test('v39 low-wing play receives a recruit in a survival slot within one guarantee window', () => {
  const s=quiet(state(()=>.5));s.count=1;s.spawn=s.boss=999;s.pickupTimer=8;let guaranteed=false;
  while(s.time<64&&!guaranteed){C.step(s,.05,{firing:false});guaranteed=s.events.some(event=>event.type==='supplyChoice'&&event.crates[0].kind==='recruit');s.crates=[];}
  assert.equal(guaranteed,true);assert.ok(s.time>=45&&s.time<=64);
});

test('v39 exposed heavy targets keep a stable attack-cycle TTK as waves rise', () => {
  const ttk=(wave,type)=>{const s=quiet(state());s.count=1;s.obstacles=[];s.x=200;s.y=500;s.wave=wave;s.level=wave-1;s.threatStage=1+Math.floor((wave-1)/3);s.aimX=700;s.aimY=500;const e=type==='phoenix'?C.spawnSpecial(s,'phoenix',700,500):C.spawnEnemy(s,'stier',700,500);e.speed=0;e.stagger=999;e.exposed=999;while(!e.dead&&s.time<20)C.step(s,.02,{aimX:e.x,aimY:e.y,firing:true});return s.time;};
  for(const wave of [10,28]){const boss=ttk(wave,'phoenix'),elite=ttk(wave,'stier');assert.ok(boss>=6&&boss<=13.1,`wave ${wave} boss ${boss}`);assert.ok(elite>=2&&elite<=5,`wave ${wave} elite ${elite}`);}
});

test('v40 cloaked Phoenix rejects wing lock but blind fire and countermeasures reveal it', () => {
  const s=quiet(state());s.obstacles=[];const boss=C.spawnSpecial(s,'phoenix',650,500);boss.phase='stalk';boss.revealed=0;s.wingShot=0;s.shot=999;
  C.step(s,.05,{aimX:boss.x,aimY:boss.y,firing:false});assert.equal(s.bullets.some(b=>b.ammo==='wing'),false);
  const hp=boss.hp;C.damageEnemy(s,boss,10);assert.equal(boss.hp,hp-10);assert.ok(boss.revealed>=1.5);
  boss.revealed=0;C.collect(s,{kind:'emp',x:boss.x,y:boss.y,used:false});assert.ok(boss.revealed>=3.5);
  boss.revealed=0;C.useTactic(s,{x:boss.x,y:boss.y});for(let i=0;i<13;i++)C.step(s,.05,{firing:false});assert.ok(boss.revealed>=3.49);
});

test('v40 Phoenix stalks without contact then performs two independently warned attacks before recovery', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];s.x=700;s.y=500;s.shield=0;const boss=C.spawnSpecial(s,'phoenix',520,500);boss.intro=0;boss.cooldown=0;const hp=s.hp;
  C.step(s,.05,{firing:false});assert.equal(boss.phase,'stalk');assert.ok(s.events.some(e=>e.type==='phoenixStalk'&&e.duration===1.8));
  for(let i=0;i<35;i++)C.step(s,.05,{firing:false});assert.equal(s.hp,hp);assert.equal(boss.phase,'stalk');
  C.step(s,.05,{firing:false});assert.equal(boss.phase,'windup');assert.ok(s.hazards.some(h=>h.source===boss.id&&h.kind==='charge'&&h.maxDelay>=.8));
  for(let i=0;i<80&&boss.phase!=='slashWindup';i++)C.step(s,.05,{firing:false});const slash=s.hazards.find(h=>h.source===boss.id&&h.geometry==='sector');assert.equal(boss.phase,'slashWindup');assert.ok(slash.maxDelay>=.75);
  for(let i=0;i<60&&boss.phase!=='recover';i++)C.step(s,.05,{firing:false});assert.equal(boss.phase,'recover');assert.ok(boss.exposed>1.7);
});

test('v40 an unrevealed stalking Phoenix does not form an invisible collision wall', () => {
  const s=quiet(state());s.count=1;s.obstacles=[];s.x=300;s.y=500;const boss=C.spawnSpecial(s,'phoenix',500,500);boss.phase='stalk';boss.stalkTime=9;boss.revealed=0;boss.stagger=999;
  for(let i=0;i<20;i++)C.step(s,.05,{moveX:1,firing:false});assert.ok(s.x>500);
  s.x=300;boss.revealed=1;for(let i=0;i<20;i++)C.step(s,.05,{moveX:1,firing:false});assert.ok(s.x<=430);
});

test('v40 every wave queues one true elite before composition spawns', () => {
  const s=quiet(state(()=>.99));s.pickupTimer=s.boss=999;s.spawn=0;const elite=new Set(['charger','artillery','shield','stier']);
  C.step(s,.05,{firing:false});assert.equal(s.enemies.filter(e=>elite.has(e.type)).length,1);const first=s.enemies.find(e=>elite.has(e.type)).type;s.enemies=[];
  s.time=29.95;s.spawn=0;C.step(s,.05,{firing:false});const second=s.enemies.find(e=>elite.has(e.type));assert.ok(second);assert.notEqual(second.type,first);assert.equal(s.eliteQueue.length,0);
});

test('v40 normal composition uses one roll for 25 percent light and 20 to 50 percent true elites', () => {
  const spawn=(wave,roll)=>{const s=quiet(state(()=>roll));s.obstacles=[];s.wave=wave;s.waveKind='normal';s.threatStage=1+Math.floor((wave-1)/3);s.time=(wave-1)*30;s.eliteQueue=[];s.spawn=0;C.step(s,.01,{firing:false});return s.enemies[0]?.type;};
  assert.equal(spawn(1,.24),'scout');assert.equal(spawn(1,.44),'charger');assert.equal(spawn(1,.46),'normal');assert.equal(spawn(19,.74),'charger');assert.equal(spawn(19,.76),'normal');
});

test('v40 fifth waves spawn only elites and tenth waves suppress every non-boss reinforcement', () => {
  const elite=new Set(['charger','artillery','shield','stier']),fifth=quiet(state(()=>.99));fifth.time=119.95;fifth.spawn=0;C.step(fifth,.05,{firing:false});assert.deepEqual([fifth.wave,fifth.waveKind],[5,'elite']);assert.ok(fifth.enemies.length&&fifth.enemies.every(e=>elite.has(e.type)));
  const tenth=quiet(state(()=>.99));tenth.time=269.95;tenth.spawn=0;tenth.boss=5;C.step(tenth,.05,{firing:false});assert.deepEqual([tenth.wave,tenth.waveKind,tenth.bossCap],[10,'boss',3]);assert.equal(tenth.enemies.some(e=>e.type!=='boss'),false);
});

test('v40 elite and boss reinforcement waves retain living enemies without leaking queued elites', () => {
  const elite=new Set(['charger','artillery','shield','stier']),s=quiet(state(()=>.99));s.obstacles=[];const survivor=C.spawnEnemy(s,'normal',200,200);s.eliteQueue=[2,3];s.time=419.95;s.spawn=s.boss=0;C.step(s,.05,{firing:false});assert.deepEqual([s.wave,s.waveKind],[15,'elite']);assert.ok(s.enemies.includes(survivor));assert.ok(s.enemies.filter(e=>e!==survivor).every(e=>elite.has(e.type)));assert.equal(s.enemies.some(e=>e.type==='boss'),false);assert.equal(s.boss,0);
  const bossWave=quiet(state(()=>.99));bossWave.obstacles=[];const old=C.spawnEnemy(bossWave,'normal',200,200);bossWave.wave=19;bossWave.waveKind='normal';bossWave.time=569.95;bossWave.spawn=bossWave.boss=0;bossWave.eliteQueue=[17,19];const queued=bossWave.eliteQueue.slice();C.step(bossWave,.05,{firing:false});assert.deepEqual([bossWave.wave,bossWave.waveKind,bossWave.bossCap],[20,'boss',5]);assert.ok(bossWave.enemies.includes(old));assert.equal(bossWave.enemies.some(e=>e!==old&&e.type!=='boss'),false);assert.deepEqual(bossWave.eliteQueue,queued);
});

test('v40 jammer state follows the main machine and blocks only tactics without spending a charge', () => {
  const s=quiet(state(()=>.5,{machine:'m4a3'}));s.count=2;s.obstacles=[];s.shot=s.burstCooldown=s.dashCooldown=0;const jammer=C.spawnEnemy(s,'jammer',500,750);jammer.speed=0;
  C.step(s,.05,{firing:false});assert.equal(s.uplinkBlocked,false);assert.equal(s.jammed,false);
  s.x=jammer.x;s.y=jammer.y-200;C.step(s,.05,{firing:false});s.shot=0;C.step(s,.05,{aimX:s.x+200,aimY:s.y,firing:true});assert.equal(s.uplinkBlocked,true);assert.ok(s.events.some(event=>event.type==='mainShot'));assert.equal(C.useBurst(s),true);assert.equal(C.useAbility(s,'dash',{moveX:1,moveY:0}),true);const charges=s.charges;assert.equal(C.useTactic(s,{x:s.x,y:s.y}),false);assert.equal(s.charges,charges);assert.equal(s.tacticCooldown,0);
  s.dash=null;s.x=900;s.y=900;C.step(s,.05,{firing:false});assert.equal(s.uplinkBlocked,false);s.x=jammer.x;s.y=jammer.y-200;C.step(s,.05,{firing:false});C.damageEnemy(s,jammer,jammer.hp);C.step(s,.05,{firing:false});assert.equal(s.uplinkBlocked,false);
});

test('v40 thin elites survive long enough to schedule an attack against basic fire', () => {
  for(const [type,x] of [['charger',430],['artillery',760]]){const s=quiet(state());s.count=1;s.obstacles=[];s.x=500;s.y=500;s.aimX=x;s.aimY=500;const e=C.spawnEnemy(s,type,x,500);e.cooldown=0;let warned=false;for(let i=0;i<60&&!e.dead&&!warned;i++){C.step(s,.05,{aimX:e.x,aimY:e.y,firing:true});warned=s.hazards.some(h=>h.source===e.id)||s.events.some(event=>event.sourceId===e.id&&event.type==='warning');}assert.ok(warned,`${type} died before telegraph`);}
});

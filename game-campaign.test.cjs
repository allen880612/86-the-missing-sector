const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('./game-arena-core.js');
const Campaign = require('./game-campaign.js');

const state = (random = () => .5, options = {}) => Campaign.setup(Campaign.create(random), options);
const tick = (s, seconds, input = { firing: false }) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += .05) Campaign.step(s, .05, input);
};
const node = (s, id) => s.campaign.nodes.find(n => n.id === id);
const moveTo = (s, id) => Object.assign(s, { x: node(s, id).x, y: node(s, id).y });

test('setup exposes the fixed Ash Return mission contract and a clean restart', () => {
  const s = state();
  assert.equal(s.mode, 'campaign');
  assert.equal(s.encounter, 'ash-return');
  assert.equal(s.machine, 'm1a4');
  assert.equal(s.arena, true);
  assert.deepEqual(s.worldBounds, { left: 0, right: 1600, top: 0, bottom: 1600 });
  assert.deepEqual([s.x, s.y], [800, 1480]);
  assert.deepEqual(s.campaign.nodes.map(n => [n.id, n.x, n.y, n.r]), [
    ['cargo', 800, 850, 80], ['rescue', 300, 930, 80], ['exit', 800, 130, 80]
  ]);
  s.campaign.cargo = s.campaign.rescued = true;
  s.enemies.push({ dead: false }); s.time = 99; s.over = s.won = true;
  Campaign.setup(s);
  assert.deepEqual([s.campaign.cargo, s.campaign.rescued, s.time, s.over, s.won, s.enemies.length], [false, false, 0, false, false, 0]);
});

test('setup preserves the selected ammunition while fixing the campaign machine and tactic', () => {
  for (const ammo of ['standard','ap','he']) {
    const s=state(()=>.5,{ammo,machine:'xm2'});
    assert.deepEqual([s.ammo,s.machine,s.tactic],[ammo,'m1a4','support']);
  }
});

test('exit is locked before cargo recovery and succeeds with living enemies after it', () => {
  const s = state();
  moveTo(s, 'exit');
  assert.equal(Campaign.interact(s), false);
  assert.equal(s.over, false);
  s.campaign.cargo = true; s.campaign.stage = 'extract';
  C.spawnEnemy(s, 'normal', 1000, 300);
  assert.equal(Campaign.interact(s), true);
  assert.deepEqual([s.over, s.won, s.enemies.filter(e => !e.dead).length], [true, true, 1]);
});

test('entering the exit after recovery wins automatically with living enemies', () => {
  const s=state();s.campaign.cargo=true;s.campaign.stage='extract';
  const living=C.spawnEnemy(s,'normal',1000,300);
  moveTo(s,'exit');Campaign.step(s,.05,{firing:false});
  assert.deepEqual([s.over,s.won,s.enemies.includes(living)],[true,true,true]);
});

test('defeat in the core step prevents same-frame recovery or victory', () => {
  const s=state();moveTo(s,'cargo');Campaign.interact(s);s.campaign.saved.cargo=5.99;s.campaign.progress=5.99/6;
  s.hp=1;s.shield=0;s.count=1;s.wings=[];C.addHazard(s,'circle',{id:99,type:'test',x:s.x,y:s.y},'mortar',{x:s.x,y:s.y,r:30},0,9);
  Campaign.step(s,.05,{firing:false});
  assert.equal(s.over,true);assert.equal(s.won,false);assert.equal(s.campaign.cargo,false);
});

test('cargo work toggles, loses a partial segment on leaving, and preserves completed segments', () => {
  const s = state(); moveTo(s, 'cargo');
  assert.equal(Campaign.interact(s), true);
  tick(s, 1.5); Campaign.interact(s);
  assert.equal(s.campaign.progress, 0);
  Campaign.interact(s); tick(s, 3.2);
  assert.ok(s.campaign.progress >= .5 && s.campaign.progress < 1);
  s.x += 200; Campaign.step(s, .05, { firing: false });
  assert.equal(s.campaign.working, null);
  assert.equal(s.campaign.progress, .5);
  moveTo(s, 'cargo'); Campaign.interact(s); tick(s, 3.1);
  assert.equal(s.campaign.cargo, true);
  assert.equal(s.campaign.stage, 'extract');
});

test('rescue is optional and grants one finite repair supply', () => {
  const direct = state(); direct.campaign.cargo = true; direct.campaign.stage = 'extract'; moveTo(direct, 'exit');
  assert.equal(Campaign.interact(direct), true);
  assert.equal(Campaign.result(direct).rescued, false);

  const rescued = state(); rescued.hp = 20; moveTo(rescued, 'rescue'); Campaign.interact(rescued); tick(rescued, 3.1);
  assert.equal(rescued.campaign.rescued, true);
  assert.equal(rescued.crates.filter(b => !b.used && b.campaignSupply && b.kind==='repair').length, 1);
});

test('campaign enemies are finite, progress-triggered, and never receive endless waves or periodic supplies', () => {
  const s = state();
  tick(s, 30);
  assert.equal(s.enemies.length, 0);
  assert.deepEqual(s.crates.map(b=>b.kind),['shield']);
  s.y = 1200; Campaign.step(s, .05, { firing: false });
  const firstIds = s.enemies.map(e => e.id);
  assert.ok(firstIds.length >= 2);
  tick(s, 90);
  assert.deepEqual(s.enemies.map(e => e.id).filter(id => firstIds.includes(id)).sort((a,b)=>a-b), s.enemies.map(e => e.id).sort((a,b)=>a-b));
  assert.equal(s.crates.filter(b => !b.campaignSupply).length, 0);
});

test('Lowe holds the northern blockade until the player reaches the central engagement', () => {
  const s=state();s.y=1200;Campaign.step(s,.05,{firing:false});
  const lowe=s.enemies.find(e=>e.type==='shield'),start=[lowe.x,lowe.y];lowe.cooldown=0;
  tick(s,10);
  assert.deepEqual([lowe.x,lowe.y],start);assert.equal(s.hazards.some(h=>h.source===lowe.id),false);
  s.x=800;s.y=850;Campaign.step(s,.05,{firing:false});
  assert.equal(lowe.campaignActive,true);assert.ok(s.hazards.some(h=>h.source===lowe.id));
});

test('cargo completion delivers one finite central weapon and repair pair', () => {
  const s=state();moveTo(s,'cargo');Campaign.interact(s);tick(s,6.1);
  assert.deepEqual(s.crates.filter(b=>b.campaignSupply).map(b=>b.kind).sort(),['autocannon','repair','shield']);
  const ids=s.crates.map(b=>b.id);tick(s,60);assert.deepEqual(s.crates.map(b=>b.id),ids);
});

test('living Ameise lets distant Lowe track, then Lowe fires at the last observation until close self-defence', () => {
  const s = state(); s.y = 1200; Campaign.step(s, .05, { firing: false });
  const scout = s.enemies.find(e => e.type === 'scout');
  const lowe = s.enemies.find(e => e.type === 'shield');
  assert.ok(scout && lowe);
  s.x=800;s.y=850;Campaign.step(s,.05,{firing:false});s.hazards.length=0;
  lowe.cooldown = 0; s.x = 1100; s.y = 1150;
  Campaign.step(s, .05, { firing: false });
  let rail = s.hazards.find(h => h.source === lowe.id && h.kind === 'rail');
  const currentAngle = Math.atan2(s.y - lowe.y, s.x - lowe.x);
  let shotAngle = Math.atan2(rail.rawToY - lowe.y, rail.rawToX - lowe.x);
  assert.ok(Math.abs(currentAngle - shotAngle) < .01, 'remote shot follows current player line');
  const observed = { ...lowe.lastObserved };
  C.damageEnemy(s, scout, scout.hp);
  s.hazards.length = 0; lowe.cooldown = 0; s.x = 300; s.y = 1300;
  Campaign.step(s, .05, { firing: false });
  rail = s.hazards.find(h => h.source === lowe.id && h.kind === 'rail');
  const oldAngle = Math.atan2(observed.y - lowe.y, observed.x - lowe.x);
  shotAngle = Math.atan2(rail.rawToY - lowe.y, rail.rawToX - lowe.x);
  assert.ok(Math.abs(oldAngle - shotAngle) < .01, 'remote shot stays on last observation');
  s.hazards.length = 0; lowe.cooldown = 0; lowe.cooling = 0; s.x = lowe.x + 200; s.y = lowe.y;
  Campaign.step(s, .05, { firing: false });
  rail = s.hazards.find(h => h.source === lowe.id && h.kind === 'rail');
  assert.ok(Math.abs(rail.rawToY - s.y) < 1, 'nearby Lowe reacquires for self-defence');
});

test('campaign result extends arena result with mission outcome and route summary', () => {
  const s = state(); s.campaign.cargo = true; s.campaign.stage = 'extract'; moveTo(s, 'exit'); Campaign.interact(s);
  const result = Campaign.result(s);
  assert.equal(result.mode, 'campaign');
  assert.equal(result.encounter, 'ash-return');
  assert.equal(result.won, true);
  assert.equal(result.cargo, true);
  assert.equal(result.rescued, false);
  assert.match(result.summary, /突破/);
  assert.equal(result.machine, 'm1a4');
});

test('both cargo routes and the northern exit are reachable without crossing a wall', () => {
  const run = (s, x, y) => {
    for (let i = 0; i < 240 && Math.hypot(s.x - x, s.y - y) > 12; i++) {
      const dx=x-s.x,dy=y-s.y,d=Math.hypot(dx,dy)||1;
      Campaign.step(s,.05,{moveX:dx/d,moveY:dy/d,aimX:x,aimY:y,firing:false});
    }
    assert.ok(Math.hypot(s.x-x,s.y-y)<25,`reached ${Math.round(s.x)},${Math.round(s.y)} instead of ${x},${y}`);
  };
  const centre=state();Object.assign(centre.campaign.spawned,{approach:true,recover:true,extract:true});
  run(centre,660,1180);run(centre,660,850);run(centre,800,850);run(centre,800,130);
  const west=state();Object.assign(west.campaign.spawned,{approach:true,recover:true,extract:true});
  run(west,420,1180);run(west,420,1110);run(west,300,930);
});


test('both outer streets remain traversable without a dash', () => {
  for (const x of [120,1480]) {
    const s=state();s.x=x;s.y=1200;
    tick(s,3.5,{moveY:-1,firing:false});
    assert(s.y<300, `outer route blocked at ${x}, ${s.y}`);
  }
});

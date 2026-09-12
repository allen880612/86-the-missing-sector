(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SortieCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PLAYER_RADIUS = 0.85;
  var X_LIMIT = 40;
  var Z_LIMIT = 48;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function length(x, z) { return Math.sqrt(x * x + z * z); }
  function distance(a, b) { return length(a.x - b.x, a.z - b.z); }
  function directionAngle(x, z) { return Math.atan2(-x, -z); }
  function makeRandom(seed) {
    var value = (Number(seed) || 1) >>> 0;
    return function () {
      value += 0x6D2B79F5;
      var t = value;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function entity(id, kind, x, z, hp, speed, radius) {
    return {
      id: id, kind: kind, x: x, z: z, angle: 0, aimAngle: 0,
      moving: false, speed: speed, jumpHeight: 0, recoil: 0,
      hp: hp, maxHp: hp, phase: 'idle', radius: radius
    };
  }

  function initialEnemies() {
    return [
      entity('relay-west', 'relay', -24, -18, 150, 0, 1.15),
      entity('relay-east', 'relay', 23, -21, 150, 0, 1.15),
      entity('scout-1', 'scout', -12, 1, 55, 3.7, 0.75),
      entity('hunter-1', 'hunter', 13, 5, 90, 6.2, 0.9),
      entity('heavy-1', 'heavy', 0, -34, 420, 1.4, 1.8)
    ];
  }

  function initialObstacles() {
    return [
      { id: 'low-south', x: -7, z: 20, w: 9, d: 1.3, h: 2.55, type: 'low', hp: 95, maxHp: 95 },
      { id: 'high-west', x: -18, z: 8, w: 2.4, d: 13, h: 3.8, type: 'high', hp: 220, maxHp: 220 },
      { id: 'low-center', x: 3, z: 5, w: 11, d: 1.4, h: 2.6, type: 'low', hp: 95, maxHp: 95 },
      { id: 'high-east', x: 18, z: -5, w: 2.6, d: 15, h: 4.2, type: 'high', hp: 220, maxHp: 220 },
      { id: 'low-north', x: -9, z: -18, w: 10, d: 1.4, h: 2.65, type: 'low', hp: 95, maxHp: 95 },
      { id: 'high-yard', x: 1, z: -27, w: 10, d: 2.3, h: 3.5, type: 'high', hp: 220, maxHp: 220 }
    ];
  }

  function create(options) {
    options = options || {};
    var seed = Number(options.seed) || 1;
    var player = entity('xm2', 'player', 0, 34, 100, 8.4, PLAYER_RADIUS);
    player.jumpCd = 0;
    player.skillCd = 0;
    player.supportCd = 0;
    var enemies = initialEnemies();
    var state = {
      phase: 'ready',
      time: 0,
      player: player,
      enemies: enemies,
      obstacles: initialObstacles(),
      projectiles: [],
      effects: [],
      events: [],
      objective: {
        stage: 'destroy-relays',
        relayRemaining: 2,
        heavyRemaining: 1,
        extraction: { x: 0, z: 42, radius: 3.2, active: false }
      },
      stats: {
        seed: seed, result: null, kills: 0, damageDealt: 0, damageTaken: 0,
        elapsed: 0, spawned: enemies.length, spawnLimit: 11, supplies: 0
      }
    };
    attachRuntime(state, seed);
    return state;
  }

  function attachRuntime(state, seed) {
    Object.defineProperty(state, '_runtime', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: {
        seed: seed,
        random: makeRandom(seed),
        nextId: 1,
        phaseTime: 0,
        observation: null,
        reinforcementIndex: 0,
        support: [],
        result: null
      }
    });
  }

  function resetInto(state) {
    var seed = state._runtime ? state._runtime.seed : (state.stats && state.stats.seed) || 1;
    var fresh = create({ seed: seed });
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.keys(fresh).forEach(function (key) { state[key] = fresh[key]; });
    attachRuntime(state, seed);
  }

  function start(state) {
    if (!state || !state.stats) throw new TypeError('SortieCore.start requires a state from create()');
    resetInto(state);
    state.phase = 'launching';
    state.player.phase = 'launching';
    state.events.push({ type: 'launch', x: state.player.x, z: state.player.z });
    return state;
  }

  function nextId(state, prefix) {
    return prefix + '-' + state._runtime.nextId++;
  }

  function activeObstacle(obstacle) { return obstacle.hp === undefined || obstacle.hp > 0; }

  function pointInExpandedObstacle(x, z, obstacle, radius) {
    return activeObstacle(obstacle) &&
      x >= obstacle.x - obstacle.w / 2 - radius && x <= obstacle.x + obstacle.w / 2 + radius &&
      z >= obstacle.z - obstacle.d / 2 - radius && z <= obstacle.z + obstacle.d / 2 + radius;
  }

  function blockingWallAt(state, x, z, radius, jumpHeight) {
    return state.obstacles.find(function (obstacle) {
      if (obstacle.type === 'low' && jumpHeight > obstacle.h + 0.1) return false;
      return pointInExpandedObstacle(x, z, obstacle, radius);
    }) || null;
  }

  function blockingEntityAt(state, actor, x, z, jumping) {
    if (actor === state.player || actor.kind === 'player') {
      return state.enemies.find(function (enemy) {
        if (enemy.hp <= 0 || enemy.kind === 'supply') return false;
        if (jumping && actor.jumpHeight >= 1.8 && enemy.kind !== 'heavy' && enemy.kind !== 'relay') return false;
        return length(x - enemy.x, z - enemy.z) < (actor.radius || PLAYER_RADIUS) + (enemy.radius || 0.75);
      }) || null;
    }
    var player = state.player;
    if (!player || player.hp <= 0 ||
        (player.jumpHeight >= 1.8 && actor.kind !== 'heavy' && actor.kind !== 'relay')) return null;
    return length(x - player.x, z - player.z) < (actor.radius || 0.75) + (player.radius || PLAYER_RADIUS) ? player : null;
  }

  function blockingAt(state, actor, x, z, jumping) {
    var wall = blockingWallAt(state, x, z, actor.radius || 0.75, jumping ? actor.jumpHeight : 0);
    if (wall) return { wall: wall, entity: null };
    var other = blockingEntityAt(state, actor, x, z, jumping);
    return other ? { wall: null, entity: other } : null;
  }

  function moveWithWalls(state, actor, dx, dz, jumping) {
    var radius = actor.radius || 0.75;
    var collision = null;
    var nextX = clamp(actor.x + dx, -X_LIMIT + radius, X_LIMIT - radius);
    var xBlock = blockingAt(state, actor, nextX, actor.z, jumping);
    if (!xBlock) actor.x = nextX;
    else collision = xBlock;
    var nextZ = clamp(actor.z + dz, -Z_LIMIT + radius, Z_LIMIT - radius);
    var zBlock = blockingAt(state, actor, actor.x, nextZ, jumping);
    if (!zBlock) actor.z = nextZ;
    else collision = collision || zBlock;
    return collision;
  }

  function segmentObstacleHit(state, x1, z1, x2, z2) {
    var dx = x2 - x1;
    var dz = z2 - z1;
    var distanceTotal = Math.max(0.001, length(dx, dz));
    var steps = Math.ceil(distanceTotal / 0.35);
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var x = x1 + dx * t;
      var z = z1 + dz * t;
      for (var j = 0; j < state.obstacles.length; j++) {
        if (pointInExpandedObstacle(x, z, state.obstacles[j], 0.08)) {
          return { obstacle: state.obstacles[j], x: x, z: z };
        }
      }
    }
    return null;
  }

  function segmentHitsObstacle(state, x1, z1, x2, z2) {
    var hit = segmentObstacleHit(state, x1, z1, x2, z2);
    return hit && hit.obstacle;
  }

  function lineOfSight(state, from, to) {
    return !segmentHitsObstacle(state, from.x, from.z, to.x, to.z);
  }

  function addEffect(state, data) {
    var effect = Object.assign({
      id: nextId(state, 'fx'), type: 'spark', x: 0, z: 0,
      radius: 1, life: 0.3, maxLife: 0.3
    }, data);
    state.effects.push(effect);
    if (state.effects.length > 64) state.effects.splice(0, state.effects.length - 64);
    return effect;
  }

  function damageEnemy(state, enemy, amount) {
    if (!enemy || enemy.hp <= 0) return;
    var multiplier = enemy.kind === 'heavy' && enemy.phase !== 'recover' ? 0.25 :
      enemy.phase === 'exposed' ? 1.6 : 1;
    var dealt = Math.min(enemy.hp, amount * multiplier);
    enemy.hp = Math.max(0, enemy.hp - dealt);
    state.stats.damageDealt += dealt;
    enemy.phase = enemy.hp > 0 ? enemy.phase : 'destroyed';
    if (enemy.hp <= 0) {
      state.stats.kills++;
      state.events.push({ type: 'destroyed', id: enemy.id, kind: enemy.kind, x: enemy.x, z: enemy.z });
      addEffect(state, { type: 'explosion', x: enemy.x, z: enemy.z, radius: enemy.kind === 'heavy' ? 3.4 : 1.6, life: 0.65, maxLife: 0.65 });
    }
  }

  function hurtPlayer(state, amount, source) {
    if (state.phase !== 'playing' || state.player.hp <= 0) return;
    var dealt = Math.min(state.player.hp, amount);
    state.player.hp = Math.max(0, state.player.hp - dealt);
    state.stats.damageTaken += dealt;
    state.events.push({ type: 'playerHit', source: source, x: state.player.x, z: state.player.z, damage: dealt });
    state.player.phase = state.player.hp > 0 ? 'hit' : 'disabled';
    if (state.player.hp <= 0) beginSettling(state, 'lost');
  }

  function updateAim(player, input) {
    if (Number.isFinite(input.aimX) && Number.isFinite(input.aimZ)) {
      var dx = input.aimX - player.x;
      var dz = input.aimZ - player.z;
      if (length(dx, dz) > 0.01) player.aimAngle = directionAngle(dx, dz);
    }
  }

  function updatePlayer(state, input, dt) {
    var player = state.player;
    player.jumpCd = Math.max(0, player.jumpCd - dt);
    player.skillCd = Math.max(0, player.skillCd - dt);
    player.supportCd = Math.max(0, player.supportCd - dt);
    player.recoil = Math.max(0, player.recoil - dt * 5);
    player.fireCd = Math.max(0, (player.fireCd || 0) - dt);
    updateAim(player, input);

    var mx = Number(input.moveX) || 0;
    var mz = Number(input.moveZ) || 0;
    var magnitude = length(mx, mz);
    if (magnitude > 1) { mx /= magnitude; mz /= magnitude; magnitude = 1; }

    if (input.jump && player.jumpCd <= 0 && !player.leapTime) {
      if (magnitude < 0.1) {
        mx = -Math.sin(player.aimAngle);
        mz = -Math.cos(player.aimAngle);
      }
      player.leapX = mx;
      player.leapZ = mz;
      player.leapTime = 0.001;
      player.leapSafeX = player.x;
      player.leapSafeZ = player.z;
      player.jumpCd = 3.2;
      player.phase = 'leap';
      state.events.push({ type: 'leap', x: player.x, z: player.z });
    }

    if (player.leapTime) {
      var leapDuration = 0.76;
      player.leapTime += dt;
      var progress = Math.min(1, player.leapTime / leapDuration);
      player.jumpHeight = Math.sin(progress * Math.PI) * 3.25;
      player.moving = true;
      player.speed = 12.2;
      player.fireCd = Math.max(player.fireCd, 0.45);
      player.angle = directionAngle(player.leapX, player.leapZ);
      var collision = moveWithWalls(state, player, player.leapX * player.speed * dt, player.leapZ * player.speed * dt, true);
      var groundBlock = blockingAt(state, player, player.x, player.z, false);
      var airBlock = blockingAt(state, player, player.x, player.z, true);
      if (!groundBlock) { player.leapSafeX = player.x; player.leapSafeZ = player.z; }
      var hardStop = collision && ((collision.wall && collision.wall.type === 'high') ||
        (collision.entity && (collision.entity.kind === 'heavy' || collision.entity.kind === 'relay')));
      if (hardStop || (progress > 0.5 && airBlock)) {
        if (groundBlock) { player.x = player.leapSafeX; player.z = player.leapSafeZ; }
        finishLeap(state, player);
      } else if (progress >= 1) {
        if (groundBlock) { player.x = player.leapSafeX; player.z = player.leapSafeZ; }
        finishLeap(state, player);
      }
    } else {
      player.speed = 8.4;
      player.moving = magnitude > 0.08;
      if (player.moving) {
        player.angle = directionAngle(mx, mz);
        moveWithWalls(state, player, mx * player.speed * dt, mz * player.speed * dt, false);
        if (player.phase !== 'blade') player.phase = 'move';
      } else if (player.phase !== 'blade' && player.phase !== 'hit') player.phase = 'idle';
    }

    if (input.skill && player.skillCd <= 0 && !player.leapTime) useBlade(state);
    if (input.support && player.supportCd <= 0 && !player.leapTime) useSupport(state, input);
    if (!player.leapTime) autoFire(state);
  }

  function finishLeap(state, player) {
    player.leapTime = 0;
    player.jumpHeight = 0;
    player.speed = 8.4;
    player.phase = 'idle';
    state.events.push({ type: 'land', x: player.x, z: player.z });
  }

  function angleDelta(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }

  function useBlade(state) {
    var player = state.player;
    player.skillCd = 4.4;
    player.phase = 'blade';
    addEffect(state, { type: 'blade', x: player.x, z: player.z, radius: 3.6, angle: player.aimAngle, life: 0.28, maxLife: 0.28 });
    state.events.push({ type: 'blade', x: player.x, z: player.z, angle: player.aimAngle });
    state.enemies.forEach(function (enemy) {
      if (enemy.hp <= 0 || distance(player, enemy) > 3.7 + (enemy.radius || 0)) return;
      var toward = directionAngle(enemy.x - player.x, enemy.z - player.z);
      if (angleDelta(toward, player.aimAngle) <= 1.2 && lineOfSight(state, player, enemy)) {
        damageEnemy(state, enemy, 34);
      }
    });
  }

  function useSupport(state, input) {
    var player = state.player;
    var x = Number.isFinite(input.aimX) ? clamp(input.aimX, -X_LIMIT, X_LIMIT) : player.x;
    var z = Number.isFinite(input.aimZ) ? clamp(input.aimZ, -Z_LIMIT, Z_LIMIT) : player.z;
    player.supportCd = 18;
    state._runtime.support.push({ x: x, z: z, time: 0.8, radius: 6.5 });
    addEffect(state, { type: 'support-warning', x: x, z: z, radius: 6.5, life: 0.8, maxLife: 0.8 });
    state.events.push({ type: 'supportCalled', x: x, z: z, radius: 6.5 });
  }

  function autoFire(state) {
    var player = state.player;
    if (player.fireCd > 0) return;
    var best = null;
    var bestDistance = 24;
    state.enemies.forEach(function (enemy) {
      if (enemy.hp <= 0 || enemy.kind === 'supply') return;
      var d = distance(player, enemy);
      var toward = directionAngle(enemy.x - player.x, enemy.z - player.z);
      if (d < bestDistance && angleDelta(toward, player.aimAngle) < 0.42) {
        best = enemy;
        bestDistance = d;
      }
    });
    if (!best) return;
    var dx = best.x - player.x;
    var dz = best.z - player.z;
    var d = Math.max(0.001, length(dx, dz));
    player.fireCd = 0.48;
    player.recoil = 1;
    var muzzle = muzzlePoint(player, 3.61);
    var muzzleHit = segmentObstacleHit(state, player.x, player.z, muzzle.x, muzzle.z);
    if (muzzleHit) {
      state.events.push({ type: 'wallHit', id: muzzleHit.obstacle.id, x: muzzleHit.x, z: muzzleHit.z });
      addEffect(state, { type: 'wall-hit', x: muzzleHit.x, z: muzzleHit.z, radius: 0.55, life: 0.2, maxLife: 0.2 });
      return;
    }
    state.projectiles.push({
      id: nextId(state, 'shell'), x: muzzle.x, z: muzzle.z,
      dx: dx / d, dz: dz / d, enemy: false, damage: 11,
      radius: 0.16, speed: 27, life: 1.2, height: 1.72
    });
    state.events.push({ type: 'mainFire', x: muzzle.x, z: muzzle.z, height: 1.72, angle: player.aimAngle });
  }

  function muzzlePoint(actor, offset) {
    return {
      x: actor.x - Math.sin(actor.aimAngle) * offset,
      z: actor.z - Math.cos(actor.aimAngle) * offset
    };
  }

  function updateSupport(state, dt) {
    for (var i = state._runtime.support.length - 1; i >= 0; i--) {
      var strike = state._runtime.support[i];
      strike.time -= dt;
      if (strike.time > 0) continue;
      state.enemies.forEach(function (enemy) {
        if (enemy.hp > 0 && length(enemy.x - strike.x, enemy.z - strike.z) <= strike.radius + (enemy.radius || 0)) {
          damageEnemy(state, enemy, 58);
        }
      });
      addEffect(state, { type: 'support-impact', x: strike.x, z: strike.z, radius: strike.radius, life: 0.55, maxLife: 0.55 });
      state.events.push({ type: 'supportImpact', x: strike.x, z: strike.z, radius: strike.radius });
      state._runtime.support.splice(i, 1);
    }
  }

  function updateProjectiles(state, dt) {
    for (var i = state.projectiles.length - 1; i >= 0; i--) {
      var shot = state.projectiles[i];
      var oldX = shot.x;
      var oldZ = shot.z;
      shot.x += shot.dx * shot.speed * dt;
      shot.z += shot.dz * shot.speed * dt;
      shot.life -= dt;
      var wall = segmentHitsObstacle(state, oldX, oldZ, shot.x, shot.z);
      if (wall) {
        addEffect(state, { type: 'wall-hit', x: shot.x, z: shot.z, radius: 0.55, life: 0.2, maxLife: 0.2 });
        state.events.push({ type: 'wallHit', id: wall.id, x: shot.x, z: shot.z });
        state.projectiles.splice(i, 1);
        continue;
      }
      if (shot.enemy) {
        if (length(shot.x - state.player.x, shot.z - state.player.z) <= PLAYER_RADIUS + shot.radius) {
          hurtPlayer(state, shot.damage || 8, 'projectile');
          state.projectiles.splice(i, 1);
          continue;
        }
      } else {
        var hit = state.enemies.find(function (enemy) {
          return enemy.hp > 0 && length(shot.x - enemy.x, shot.z - enemy.z) <= (enemy.radius || 0.75) + shot.radius;
        });
        if (hit) {
          damageEnemy(state, hit, shot.damage || 10);
          addEffect(state, { type: 'hit', x: shot.x, z: shot.z, radius: 0.6, life: 0.18, maxLife: 0.18 });
          state.projectiles.splice(i, 1);
          continue;
        }
      }
      if (shot.life <= 0 || Math.abs(shot.x) > X_LIMIT + 2 || Math.abs(shot.z) > Z_LIMIT + 2) state.projectiles.splice(i, 1);
    }
    if (state.projectiles.length > 48) state.projectiles.splice(0, state.projectiles.length - 48);
  }

  function observePlayer(state, scout) {
    if (distance(scout, state.player) <= 32 && lineOfSight(state, scout, state.player)) {
      state._runtime.observation = { x: state.player.x, z: state.player.z, age: 0, sourceId: scout.id };
      scout.phase = 'observing';
      var existing = state.effects.find(function (fx) { return fx.id === 'observation-' + scout.id; });
      if (!existing) {
        addEffect(state, { id: 'observation-' + scout.id, type: 'observation', x: scout.x, z: scout.z,
          toX: state.player.x, toZ: state.player.z, radius: 0.2, life: 0.18, maxLife: 0.18 });
      } else {
        existing.x = scout.x; existing.z = scout.z;
        existing.toX = state.player.x; existing.toZ = state.player.z; existing.life = 0.18;
      }
    }
  }

  function updateScout(state, scout, dt) {
    observePlayer(state, scout);
    if (distance(scout, state.player) < 10) {
      var dx = scout.x - state.player.x;
      var dz = scout.z - state.player.z;
      var d = Math.max(0.001, length(dx, dz));
      scout.angle = directionAngle(dx, dz);
      scout.moving = true;
      moveWithWalls(state, scout, dx / d * scout.speed * dt, dz / d * scout.speed * dt, false);
    } else scout.moving = false;
  }

  function warningEffect(state, enemy, type, target, tracking, locked, life) {
    var id = type + '-' + enemy.id;
    var effect = state.effects.find(function (fx) { return fx.id === id; });
    if (!effect) {
      effect = addEffect(state, { id: id, type: type, x: target.x, z: target.z,
        toX: enemy.x, toZ: enemy.z, radius: type === 'heavy-warning' ? 2.5 : 1.4,
        tracking: !!tracking, locked: !!locked, life: life, maxLife: life });
    } else {
      effect.x = target.x; effect.z = target.z;
      effect.toX = enemy.x; effect.toZ = enemy.z;
      effect.tracking = !!tracking; effect.locked = !!locked;
      effect.life = Math.max(effect.life, life); effect.maxLife = Math.max(effect.maxLife, life);
    }
    return effect;
  }

  function updateHeavy(state, heavy, dt) {
    heavy.attackCd = Math.max(0, (heavy.attackCd === undefined ? 0.45 : heavy.attackCd) - dt);
    var near = distance(heavy, state.player) <= 20;
    if (near && lineOfSight(state, heavy, state.player)) {
      state._runtime.observation = { x: state.player.x, z: state.player.z, age: 0, sourceId: heavy.id };
    }
    var known = state._runtime.observation || (near ? { x: state.player.x, z: state.player.z, age: 0 } : null);
    if (heavy.phase !== 'tracking' && heavy.phase !== 'locking' && heavy.phase !== 'recover' && known) {
      heavy.aimAngle = directionAngle(known.x - heavy.x, known.z - heavy.z);
      var muzzle = muzzlePoint(heavy, 6.06);
      if (segmentHitsObstacle(state, heavy.x, heavy.z, muzzle.x, muzzle.z) ||
          segmentHitsObstacle(state, muzzle.x, muzzle.z, known.x, known.z)) {
        var tx = known.x - heavy.x;
        var tz = known.z - heavy.z;
        var td = Math.max(0.001, length(tx, tz));
        var side = heavy.repositionSide || (heavy.x <= 0 ? -1 : 1);
        heavy.repositionSide = side;
        heavy.phase = 'reposition';
        heavy.moving = true;
        moveWithWalls(state, heavy, tz / td * side * heavy.speed * dt, -tx / td * side * heavy.speed * dt, false);
        return;
      }
      if (heavy.phase === 'reposition') heavy.phase = 'idle';
    }
    heavy.moving = false;
    if (heavy.phase === 'tracking') {
      heavy.phaseTime -= dt;
      if (state._runtime.observation) {
        heavy.targetX = state._runtime.observation.x;
        heavy.targetZ = state._runtime.observation.z;
      }
      warningEffect(state, heavy, 'heavy-warning', { x: heavy.targetX, z: heavy.targetZ }, true, false, heavy.phaseTime + 0.7);
      heavy.aimAngle = directionAngle(heavy.targetX - heavy.x, heavy.targetZ - heavy.z);
      if (heavy.phaseTime <= 0) { heavy.phase = 'locking'; heavy.phaseTime = 0.62; }
      return;
    }
    if (heavy.phase === 'locking') {
      heavy.phaseTime -= dt;
      warningEffect(state, heavy, 'heavy-warning', { x: heavy.targetX, z: heavy.targetZ }, false, true, heavy.phaseTime);
      if (heavy.phaseTime <= 0) fireHeavy(state, heavy);
      return;
    }
    if (heavy.phase === 'recover') {
      heavy.phaseTime -= dt;
      if (heavy.phaseTime <= 0) { heavy.phase = 'idle'; heavy.attackCd = 2.5; }
      return;
    }
    if (heavy.attackCd <= 0 && state._runtime.observation && state._runtime.observation.age <= 7) {
      heavy.phase = 'tracking';
      heavy.phaseTime = 0.75;
      heavy.targetX = state._runtime.observation.x;
      heavy.targetZ = state._runtime.observation.z;
    }
  }

  function fireHeavy(state, heavy) {
    heavy.recoil = 1;
    var target = { x: heavy.targetX, z: heavy.targetZ };
    heavy.aimAngle = directionAngle(target.x - heavy.x, target.z - heavy.z);
    var muzzle = muzzlePoint(heavy, 6.06);
    var barrelHit = segmentObstacleHit(state, heavy.x, heavy.z, muzzle.x, muzzle.z);
    var beamStart = barrelHit ? { x: heavy.x, z: heavy.z } : muzzle;
    var beamHit = barrelHit || segmentObstacleHit(state, muzzle.x, muzzle.z, target.x, target.z);
    var beamEnd = beamHit ? { x: beamHit.x, z: beamHit.z } : target;
    state.events.push({ type: 'heavyFire', id: heavy.id, x: beamStart.x, z: beamStart.z, height: 2.45,
      targetX: target.x, targetZ: target.z, hitX: beamEnd.x, hitZ: beamEnd.z, blocked: !!beamHit });
    addEffect(state, { type: 'heavy-shot', x: beamStart.x, z: beamStart.z, height: 2.45,
      toX: beamEnd.x, toZ: beamEnd.z,
      radius: 0.4, life: 0.22, maxLife: 0.22 });
    if (!beamHit &&
        length(state.player.x - target.x, state.player.z - target.z) <= 2.5) hurtPlayer(state, 24, 'heavy');
    heavy.phase = 'recover';
    heavy.phaseTime = 1.15;
  }

  function updateHunter(state, hunter, dt) {
    hunter.attackCd = Math.max(0, (hunter.attackCd === undefined ? 0.2 : hunter.attackCd) - dt);
    if (hunter.phase === 'windup') {
      hunter.phaseTime -= dt;
      warningEffect(state, hunter, 'hunter-warning', { x: hunter.targetX, z: hunter.targetZ }, false, true, hunter.phaseTime);
      hunter.aimAngle = directionAngle(hunter.targetX - hunter.x, hunter.targetZ - hunter.z);
      if (hunter.phaseTime <= 0) {
        var dashX = hunter.targetX - hunter.x;
        var dashZ = hunter.targetZ - hunter.z;
        var dashDistance = Math.max(0.001, length(dashX, dashZ));
        hunter.dashX = dashX / dashDistance;
        hunter.dashZ = dashZ / dashDistance;
        hunter.dashRemaining = dashDistance;
        hunter.dashHit = false;
        hunter.phase = 'dash';
        hunter.phaseTime = 0.4;
      }
      return;
    }
    if (hunter.phase === 'dash') {
      var travel = Math.min(hunter.dashRemaining, Math.max(12, hunter.dashRemaining / Math.max(0.05, hunter.phaseTime)) * dt);
      var oldX = hunter.x;
      var oldZ = hunter.z;
      moveWithWalls(state, hunter, hunter.dashX * travel, hunter.dashZ * travel, false);
      var moved = length(hunter.x - oldX, hunter.z - oldZ);
      hunter.dashRemaining -= moved;
      hunter.phaseTime -= dt;
      hunter.moving = true;
      if (!hunter.dashHit && distance(hunter, state.player) <= 1.9) {
        hurtPlayer(state, 18, 'hunter');
        hunter.dashHit = true;
      }
      if (moved < travel * 0.5 || hunter.dashRemaining <= 0.05 || hunter.phaseTime <= 0) {
        state.events.push({ type: 'hunterLunge', id: hunter.id, x: hunter.x, z: hunter.z,
          targetX: hunter.targetX, targetZ: hunter.targetZ });
        hunter.phase = 'exposed'; hunter.phaseTime = 1.05; hunter.moving = false;
      }
      return;
    }
    if (hunter.phase === 'exposed') {
      hunter.phaseTime -= dt;
      if (hunter.phaseTime <= 0) { hunter.phase = 'idle'; hunter.attackCd = 2.4; }
      return;
    }
    var d = distance(hunter, state.player);
    if (hunter.attackCd <= 0 && d <= 13 && lineOfSight(state, hunter, state.player)) {
      hunter.phase = 'windup'; hunter.phaseTime = 0.62;
      hunter.targetX = state.player.x; hunter.targetZ = state.player.z;
      return;
    }
    if (d > 7) {
      var dx = state.player.x - hunter.x;
      var dz = state.player.z - hunter.z;
      hunter.angle = directionAngle(dx, dz);
      hunter.moving = true;
      moveWithWalls(state, hunter, dx / d * hunter.speed * dt, dz / d * hunter.speed * dt, false);
    } else hunter.moving = false;
  }

  function updateRaider(state, enemy, dt) {
    enemy.attackCd = Math.max(0, (enemy.attackCd || 0) - dt);
    var d = distance(enemy, state.player);
    if (d > 8) {
      var dx = state.player.x - enemy.x;
      var dz = state.player.z - enemy.z;
      enemy.angle = directionAngle(dx, dz);
      enemy.moving = true;
      moveWithWalls(state, enemy, dx / d * enemy.speed * dt, dz / d * enemy.speed * dt, false);
    } else {
      enemy.moving = false;
      if (enemy.attackCd <= 0 && lineOfSight(state, enemy, state.player)) {
        var sx = state.player.x - enemy.x;
        var sz = state.player.z - enemy.z;
        var sd = Math.max(0.001, length(sx, sz));
        state.projectiles.push({ id: nextId(state, 'enemy-shell'), x: enemy.x, z: enemy.z,
          dx: sx / sd, dz: sz / sd, enemy: true, damage: 6, radius: 0.15, speed: 14, life: 1.3 });
        enemy.attackCd = 1.6;
      }
    }
  }

  function updateEnemies(state, dt) {
    if (state._runtime.observation) state._runtime.observation.age += dt;
    state.enemies.forEach(function (enemy) {
      enemy.recoil = Math.max(0, enemy.recoil - dt * 4);
      if (enemy.hp <= 0) return;
      if (enemy.kind === 'scout') updateScout(state, enemy, dt);
      else if (enemy.kind === 'heavy') updateHeavy(state, enemy, dt);
      else if (enemy.kind === 'hunter') updateHunter(state, enemy, dt);
      else if (enemy.kind === 'raider') updateRaider(state, enemy, dt);
    });
  }

  function spawnReinforcement(state) {
    var room = state.stats.spawnLimit - state.stats.spawned;
    if (room <= 0) return;
    var wave = state._runtime.reinforcementIndex;
    var specs = wave === 0 ? [['raider', -35, -3], ['hunter', 34, -9], ['supply', -30, 29]] :
      [['scout', 30, -31], ['raider', -33, -27], ['supply', 31, 25]];
    specs.slice(0, room).forEach(function (spec) {
      var values = spec[0] === 'hunter' ? [90, 6.2, 0.9] : spec[0] === 'scout' ? [55, 3.7, 0.75] :
        spec[0] === 'supply' ? [35, 3.2, 0.72] : [65, 3.8, 0.78];
      state.enemies.push(entity(nextId(state, spec[0]), spec[0], spec[1], spec[2], values[0], values[1], values[2]));
      state.stats.spawned++;
    });
    state.events.push({ type: 'reinforcements', wave: wave + 1, x: 0, z: -42 });
  }

  function updateMission(state) {
    state.enemies = state.enemies.filter(function (enemy) { return enemy.hp > 0; });
    state.objective.relayRemaining = state.enemies.filter(function (enemy) { return enemy.kind === 'relay'; }).length;
    state.objective.heavyRemaining = state.enemies.filter(function (enemy) { return enemy.kind === 'heavy'; }).length;
    if (state.objective.relayRemaining < 2 && state._runtime.reinforcementIndex === 0) {
      spawnReinforcement(state);
      state._runtime.reinforcementIndex++;
    }
    if (!state.objective.relayRemaining && state._runtime.reinforcementIndex === 1) {
      spawnReinforcement(state);
      state._runtime.reinforcementIndex++;
    }
    var threats = state.enemies.filter(function (enemy) { return enemy.kind !== 'supply'; }).length;
    if (!threats && state._runtime.reinforcementIndex >= 2) {
      state.objective.stage = 'extract';
      state.objective.extraction.active = true;
      if (distance(state.player, state.objective.extraction) <= state.objective.extraction.radius) beginSettling(state, 'won');
    } else if (!state.objective.relayRemaining && state.objective.heavyRemaining) state.objective.stage = 'destroy-heavy';
    else if (!state.objective.relayRemaining) state.objective.stage = 'clear-threats';
  }

  function collectSupplies(state) {
    state.enemies.forEach(function (enemy) {
      if (enemy.kind !== 'supply' || enemy.hp <= 0 || distance(enemy, state.player) > 2.2) return;
      enemy.hp = 0;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 18);
      state.stats.supplies++;
      state.events.push({ type: 'supply', id: enemy.id, x: enemy.x, z: enemy.z, amount: 18 });
      addEffect(state, { type: 'supply-pickup', x: enemy.x, z: enemy.z, radius: 1.2, life: 0.35, maxLife: 0.35 });
    });
  }

  function beginSettling(state, result) {
    if (state.phase !== 'playing') return;
    state.phase = 'settling';
    state._runtime.phaseTime = 0;
    state._runtime.result = result;
    state.events.push({ type: result === 'won' ? 'victory' : 'defeat', x: state.player.x, z: state.player.z });
  }

  function updateEffects(state, dt) {
    state.effects.forEach(function (effect) { effect.life -= dt; });
    state.effects = state.effects.filter(function (effect) { return effect.life > 0; });
  }

  function step(state, input, dt) {
    if (!state || !state._runtime) throw new TypeError('SortieCore.step requires a state from create()');
    input = input || {};
    dt = clamp(Number(dt) || 0, 0, 0.1);
    state.events = [];
    updateEffects(state, dt);
    if (state.phase === 'launching') {
      state._runtime.phaseTime += dt;
      if (state._runtime.phaseTime >= 1.05) {
        state.phase = 'playing';
        state.player.phase = 'idle';
        state.events.push({ type: 'combatStart', x: state.player.x, z: state.player.z });
      }
      return state;
    }
    if (state.phase === 'settling') {
      state._runtime.phaseTime += dt;
      if (state._runtime.phaseTime >= 1.15) {
        state.phase = state._runtime.result;
        state.stats.result = state._runtime.result;
        state.stats.elapsed = state.time;
      }
      return state;
    }
    if (state.phase !== 'playing' || dt <= 0) return state;

    state.time += dt;
    state.stats.elapsed = state.time;
    updatePlayer(state, input, dt);
    updateSupport(state, dt);
    updateEnemies(state, dt);
    updateProjectiles(state, dt);
    collectSupplies(state);
    updateMission(state);
    return state;
  }

  return { create: create, start: start, step: step };
});

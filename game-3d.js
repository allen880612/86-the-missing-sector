(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('battlefield');
  const B = window.BABYLON, Core = window.SortieCore;
  function fail(message) { $('loadError').hidden = false; $('errorText').textContent = message; }
  if (!B || !Core || !window.SortieModels) { fail('必要的戰場檔案尚未載入。請重新整理，或先返回 2D 戰線。'); return; }
  let engine, scene;
  try {
    engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'high-performance' });
    scene = new B.Scene(engine);
  } catch (_) { fail('目前無法啟用 WebGL。請開啟瀏覽器硬體加速，或使用其他桌面瀏覽器。'); return; }
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  scene.clearColor = new B.Color4(0.07, 0.105, 0.13, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogDensity = 0.005;
  scene.fogColor = new B.Color3(0.13, 0.19, 0.22);
  scene.ambientColor = new B.Color3(0.13, 0.17, 0.18);
  const camera = new B.UniversalCamera('sortie-camera', new B.Vector3(20, 30, 60), scene);
  camera.inputs.clear(); camera.minZ = 0.2; camera.maxZ = 240; camera.fov = 0.78;
  scene.activeCamera = camera;
  const hemi = new B.HemisphericLight('overcast', new B.Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.88; hemi.diffuse = new B.Color3(0.71, 0.84, 0.87); hemi.groundColor = new B.Color3(0.22, 0.25, 0.28);
  const sun = new B.DirectionalLight('late-light', new B.Vector3(-0.8, -1.8, 0.5), scene);
  sun.position = new B.Vector3(35, 60, -30); sun.intensity = 1.8; sun.diffuse = new B.Color3(1, 0.84, 0.66);
  const shadow = new B.ShadowGenerator(1024, sun);
  shadow.usePercentageCloserFiltering = true; shadow.filteringQuality = B.ShadowGenerator.QUALITY_LOW;
  shadow.bias = 0.002; shadow.normalBias = 0.04; shadow.setDarkness(0.3);
  const art = window.SortieModels.create(scene);
  const useM1A4 = new URLSearchParams(location.search).get('model') === 'm1a4';
  const inspectMotion = new URLSearchParams(location.search).has('inspect');
  let modelReady = !useM1A4;
  const createState = () => Core.create({ seed: 86, playerModel: useM1A4 ? 'm1a4' : 'xm2' });
  let state = createState(), environment = art.createEnvironment(state.obstacles);
  if (useM1A4) {
    $('machineCode').textContent = 'M1A4 / JUGGERNAUT'; $('machineName').textContent = '破壞神';
    $('hudMachine').textContent = 'M1A4'; $('machineRole').textContent = '機動試驗配置 · 自動主砲 · 翻越躍進';
    $('prototypeNote').textContent = '本地動作試驗 · Project-86 M1A4 真模型；敵機仍為程序原型。性能採樣板測試值。';
  }
  function cast(root) { root.getChildMeshes().forEach(mesh => { if (mesh.isVisible) shadow.addShadowCaster(mesh); }); }
  cast(environment.root);
  const rigs = new Map(), shots = new Map(), visualEffects = new Map();
  const mats = {}; const puffs = [], flashes = [];
  function material(name, color, emissive, alpha) {
    const m = new B.StandardMaterial(name, scene); m.diffuseColor = B.Color3.FromHexString(color);
    m.emissiveColor = m.diffuseColor.scale(emissive || 0); m.specularColor = new B.Color3(.13, .16, .16);
    m.alpha = alpha === undefined ? 1 : alpha; mats[name] = m; return m;
  }
  material('friendly', '#b4eee1', 0.8); material('enemy', '#f3ac70', 0.85);
  material('warning', '#eaaa64', 0.7, 0.7); material('locked', '#ff754b', 0.9, 0.92); material('scan', '#ac9bcc', 0.45, 0.25);
  material('support', '#8bcac5', 0.6, 0.24); material('hot', '#ffd8a0', 1);
  material('smoke', '#263037', 0, 0.42); material('relay', '#435b69', 0);
  material('supply', '#547f6a', 0.15); material('ring', '#a5dbd0', 0.5, 0.65);
  const smokeTexture = new B.Texture('assets/vfx/kenney-smoke/blackSmoke05.png', scene);
  smokeTexture.hasAlpha = true;
  const smokeSprite = new B.StandardMaterial('kenney-smoke-sprite', scene);
  smokeSprite.diffuseTexture = smokeTexture; smokeSprite.useAlphaFromDiffuseTexture = true;
  smokeSprite.emissiveColor = new B.Color3(.18, .20, .22); smokeSprite.disableLighting = true;
  smokeSprite.backFaceCulling = false; smokeSprite.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
  const steamTexture = new B.Texture('assets/vfx/kenney-smoke/whitePuff03.png', scene); steamTexture.hasAlpha = true;
  const steamSprite = new B.StandardMaterial('kenney-steam-sprite', scene);
  steamSprite.diffuseTexture = steamTexture; steamSprite.useAlphaFromDiffuseTexture = true;
  steamSprite.emissiveColor = new B.Color3(.65, .74, .73); steamSprite.disableLighting = true;
  steamSprite.backFaceCulling = false; steamSprite.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
  function puff(x, z, height, size, life, steam) {
    if (puffs.length >= 24) puffs.shift().mesh.dispose();
    const mesh = B.MeshBuilder.CreatePlane('aftermath', { size: 1 }, scene);
    mesh.material = steam ? steamSprite : smokeSprite; mesh.billboardMode = B.Mesh.BILLBOARDMODE_ALL; mesh.isPickable = false;
    mesh.position.set(x, height, z); puffs.push({ mesh, age: 0, life, size, height, steam });
  }
  function muzzleFlash(e) {
    if (flashes.length >= 8) flashes.shift().mesh.dispose();
    const mesh = B.MeshBuilder.CreateSphere('muzzle-flash', { diameter: 1, segments: 6 }, scene);
    mesh.material = mats.hot; mesh.isPickable = false;
    mesh.position.set(e.x, e.height || (e.type === 'heavyFire' ? 2.45 : 1.72), e.z);
    mesh.rotation.y = e.angle || 0; mesh.scaling.set(.24, .18, e.type === 'heavyFire' ? 1.7 : .8);
    flashes.push({ mesh, age: 0 });
  }
  function updateAftermath(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.age += dt;
      if (p.age >= p.life) { p.mesh.dispose(); puffs.splice(i, 1); continue; }
      const t = p.age / p.life; p.mesh.position.y = p.height + t * 1.8; p.mesh.position.x += dt * .3;
      p.mesh.scaling.setAll(p.size * (.6 + t)); p.mesh.visibility = Math.sin(Math.PI * t) * (p.steam ? .33 : .52);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.age += dt;
      if (f.age > .07) { f.mesh.dispose(); flashes.splice(i, 1); } else f.mesh.visibility = 1 - f.age / .07;
    }
  }
  const playerRing = B.MeshBuilder.CreateTorus('player-identifier', { diameter: 5.1, thickness: 0.055, tessellation: 40 }, scene);
  playerRing.material = mats.ring; playerRing.isPickable = false;
  const extraction = B.MeshBuilder.CreateTorus('extraction', { diameter: state.objective.extraction.radius * 2, thickness: .1, tessellation: 48 }, scene);
  extraction.material = mats.support; extraction.position.set(0, .08, 42); extraction.isPickable = false;
  let pause = false, lowCamera = false, audioEnabled = true, audioUnlocked = false;
  let pointer = { x: innerWidth / 2, y: innerHeight / 2 }, aim = { x: 0, z: 0 };
  let pressed = { jump: false, skill: false, support: false }, keys = new Set();
  let lastPhase = 'ready', lastObjective = '', hudTime = 0, clock = 0, radioUntil = 0, damagedUntil = 0;
  let previousTime = performance.now(), accumulator = 0, cameraTarget = new B.Vector3(0, 0, 28);
  let lastPointerActivity = 0, readyCam = true;
  const sound = window.FrontlineAudio;
  function unlock() {
    if (!sound) return;
    sound.unlock(); audioUnlocked = true;
    sound.setMusic(audioEnabled); sound.setSfx(audioEnabled);
    $('audioBtn').textContent = audioEnabled ? '音訊：開' : '音訊：關';
    $('audioBtn').setAttribute('aria-pressed', String(audioEnabled));
  }
  function sfx(type, detail) { if (sound && audioUnlocked && audioEnabled) sound.effect(type, detail || {}); }
  function music(name) { if (sound) sound.setScene(name); }
  function radio(text, commander, seconds) {
    $('radio').hidden = false; $('radioText').textContent = text;
    $('radioPortrait').src = commander ? 'assets/characters/lena-reference.png' : 'assets/characters/shin-reference.png';
    $('radioPortrait').alt = commander ? '蕾娜' : '辛';
    $('radioName').textContent = commander ? 'HANDLER ONE / 蕾娜' : 'UNDERTAKER / 辛';
    radioUntil = clock + (seconds || 6);
  }
  function clearInput() { keys.clear(); pressed = { jump: false, skill: false, support: false }; }
  function setPause(value) {
    if (!['playing', 'launching'].includes(state.phase)) return;
    pause = value; clearInput(); $('pauseScreen').hidden = !pause;
    if (sound) sound.update({ phase: pause ? 'paused' : state.phase });
    if (!pause) canvas.focus({ preventScroll: true });
  }
  function disposeTransient() {
    for (const collection of [rigs, shots, visualEffects]) {
      for (const item of collection.values()) item.dispose();
      collection.clear();
    }
    for (const arr of [puffs, flashes]) { arr.forEach(p => p.mesh.dispose()); arr.length = 0; }
    shadow.getShadowMap().renderList = [];
  }
  function reset(launch) {
    disposeTransient(); environment.dispose();
    state = createState(); environment = art.createEnvironment(state.obstacles); cast(environment.root);
    pause = false; clearInput(); accumulator = 0;
    lastPhase = ''; lastObjective = ''; radioUntil = 0; $('radio').hidden = true;
    $('resultScreen').hidden = true; $('pauseScreen').hidden = true; $('briefing').hidden = launch;
    $('combatUI').hidden = !launch; $('pauseBtn').hidden = !launch; $('transition').style.opacity = '0';
    $('transition').className = ''; document.body.classList.toggle('playing', launch);
    readyCam = !launch; cameraTarget.set(0, 0, 28);
    if (launch) { Core.start(state); unlock(); music('battle'); canvas.focus({ preventScroll: true }); }
    else { music('prep'); if (sound) sound.update({ phase: 'ready' }); }
  }
  function createUtility(entity) {
    const root = new B.TransformNode(entity.id, scene);
    if (entity.kind === 'relay') {
      const base = B.MeshBuilder.CreateBox('relay-base', { width: 2.2, depth: 2.2, height: 1.2 }, scene); base.parent = root; base.position.y = .6; base.material = mats.relay;
      const mast = B.MeshBuilder.CreateCylinder('relay-mast', { height: 4.5, diameter: .18, tessellation: 6 }, scene); mast.parent = root; mast.position.y = 2.8; mast.material = mats.relay;
      const dish = B.MeshBuilder.CreateSphere('relay-dish', { diameter: 1.6, segments: 8 }, scene); dish.scaling.z = .16; dish.parent = root; dish.position.y = 4.3; dish.material = mats.enemy;
      const ring = B.MeshBuilder.CreateTorus('relay-ring', { diameter: 3.1, thickness: .06, tessellation: 32 }, scene); ring.parent = root; ring.position.y = .08; ring.material = mats.enemy;
    } else {
      const crate = B.MeshBuilder.CreateBox('supply-crate', { width: 1.3, height: .8, depth: 1.1 }, scene); crate.parent = root; crate.position.y = .4; crate.material = mats.supply;
      for (let i = 0; i < 2; i++) { const stripe = B.MeshBuilder.CreateBox('repair-mark', { width: i ? .2 : .8, height: .02, depth: i ? .8 : .2 }, scene); stripe.parent = root; stripe.position.y = .82; stripe.material = mats.friendly; }
    }
    return { root, dispose: () => root.dispose(false) };
  }
  function syncEntities(dt) {
    if (!modelReady) return;
    const all = [state.player].concat(state.enemies.filter(e => e.hp > 0));
    const ids = new Set(all.map(e => e.id));
    for (const [id, rig] of rigs) if (!ids.has(id)) { rig.root.getChildMeshes().forEach(m => shadow.removeShadowCaster(m)); rig.dispose(); rigs.delete(id); }
    for (const e of all) {
      let rig = rigs.get(e.id);
      if (!rig) { rig = ['relay', 'supply'].includes(e.kind) ? createUtility(e) : useM1A4 && e.kind === 'player' ? art.createPlayerMotion(e.id) : art.createMech(e.kind === 'raider' ? 'scout' : e.kind, e.id); rigs.set(e.id, rig); cast(rig.root); }
      if (['relay', 'supply'].includes(e.kind)) { rig.root.position.set(e.x, 0, e.z); if (e.kind === 'supply') rig.root.rotation.y = clock * .2; }
      else art.updateMech(rig, e, state.time, dt);
    }
    for (const o of state.obstacles) { const node = environment.obstacles.get(o.id); if (node) node.setEnabled(o.hp > 0); }
    playerRing.position.set(state.player.x, .09, state.player.z);
    playerRing.setEnabled(state.phase !== 'ready');
    extraction.setEnabled(state.objective.extraction.active);
    extraction.scaling.setAll(1 + Math.sin(clock * 2) * .04);
    if (useM1A4 && inspectMotion) {
      const rig = rigs.get(state.player.id);
      rig.root.getDescendants().forEach(n => n.computeWorldMatrix && n.computeWorldMatrix(true));
      const muzzle = rig.muzzle.getAbsolutePosition();
      $('motionStatus').hidden = false;
      $('motionStatus').textContent = `${rig.clip} · 位置 ${state.player.x.toFixed(2)},${state.player.z.toFixed(2)} · 砲口 ${muzzle.x.toFixed(3)},${muzzle.y.toFixed(3)},${muzzle.z.toFixed(3)} · 跳高 ${state.player.jumpHeight.toFixed(2)} · ${scene.meshes.length} meshes`;
    }
  }
  function syncShots() {
    const ids = new Set(state.projectiles.map(s => s.id));
    for (const [id, mesh] of shots) if (!ids.has(id)) { mesh.dispose(); shots.delete(id); }
    for (const shot of state.projectiles) {
      let mesh = shots.get(shot.id);
      if (!mesh) { mesh = B.MeshBuilder.CreateBox(shot.id, { width: .07, height: .07, depth: .95 }, scene); mesh.material = shot.enemy ? mats.enemy : mats.friendly; mesh.isPickable = false; shots.set(shot.id, mesh); }
      mesh.position.set(shot.x, shot.height || 1.4, shot.z); mesh.rotation.y = Math.atan2(shot.dx, shot.dz);
    }
  }
  function makeEffect(fx) {
    const root = new B.TransformNode('fx-' + fx.id, scene);
    const warning = /warning|observation/.test(fx.type), line = Number.isFinite(fx.toX);
    const good = /support|blade/.test(fx.type);
    let beam, ring;
    if (line) {
      beam = B.MeshBuilder.CreateBox('telegraph', { width: fx.type === 'heavy-shot' ? .22 : fx.type === 'observation' ? .03 : .24, height: .015, depth: 1 }, scene);
      beam.parent = root; beam.material = fx.type === 'observation' ? mats.scan : warning ? mats.warning : mats.hot;
    }
    if (warning || fx.type === 'blade' || fx.type === 'support-impact') {
      ring = B.MeshBuilder.CreateTorus('ground-ring', { diameter: 2, thickness: warning ? .095 : .1, tessellation: 32 }, scene);
      ring.parent = root; ring.material = good ? mats.support : mats.warning;
    }
    const bits = [];
    if (!warning && !line) {
      const count = /explosion|impact/.test(fx.type) ? 9 : 4;
      for (let i = 0; i < count; i++) {
        const bit = B.MeshBuilder.CreateBox('spark', { size: .06 + (i % 3) * .025 }, scene);
        bit.material = i < 2 ? mats.smoke : mats.hot; bit.parent = root; bits.push(bit);
      }
    }
    root.getChildMeshes().forEach(m => m.isPickable = false);
    return { root, beam, ring, bits, dispose: () => root.dispose(false) };
  }
  function syncEffects() {
    const ids = new Set(state.effects.map(e => e.id));
    for (const [id, item] of visualEffects) if (!ids.has(id)) { item.dispose(); visualEffects.delete(id); }
    for (const fx of state.effects) {
      let item = visualEffects.get(fx.id); if (!item) { item = makeEffect(fx); visualEffects.set(fx.id, item); if (fx.type === 'heavy-warning') sfx('mortarReady'); if (fx.type === 'hunter-warning') sfx('chargerReady'); }
      const p = 1 - Math.min(1, fx.life / fx.maxLife), r = fx.radius || 1;
      item.root.position.set(fx.x, .065, fx.z);
      if (item.beam) {
        const dx = fx.toX - fx.x, dz = fx.toZ - fx.z;
        item.beam.scaling.z = Math.hypot(dx, dz); item.beam.position.set(dx / 2, .02, dz / 2); item.beam.rotation.y = Math.atan2(dx, dz);
        item.beam.visibility = fx.locked ? 1 : .75; if (/warning/.test(fx.type)) item.beam.material = fx.locked ? mats.locked : mats.warning;
      }
      if (item.ring) { item.ring.scaling.set(r, 1, r); item.ring.visibility = /warning/.test(fx.type) ? (fx.locked ? .85 + .15 * Math.sin(clock * 14) : .8) : 1 - p; if (/warning/.test(fx.type) && !/support/.test(fx.type)) item.ring.material = fx.locked ? mats.locked : mats.warning; }
      item.bits.forEach((bit, i) => {
        const a = i * 2.399, travel = r * p;
        bit.position.set(Math.cos(a) * travel, .3 + Math.sin(p * Math.PI) * r * .55, Math.sin(a) * travel);
        bit.rotation.set(p * 3, a, p * 4); bit.visibility = 1 - p;
        bit.scaling.setAll(i < 2 ? .5 + p * r * 6 : 1);
      });
    }
  }
  function processEvents(events) {
    for (const e of events) {
      if (e.type === 'mainFire') { sfx('mainShot'); muzzleFlash(e); }
      else if (e.type === 'leap') sfx('chargerDash', { intensity: .5 });
      else if (e.type === 'land') { sfx('impact', { intensity: .3 }); puff(e.x, e.z, .3, 3, .8, true); }
      else if (e.type === 'blade') sfx('blade');
      else if (e.type === 'supportCalled') { sfx('uiConfirm'); radio('支援座標確認。砲擊即將抵達，保持機動。', true, 4); }
      else if (e.type === 'supportImpact') sfx('support');
      else if (e.type === 'heavyFire') { sfx('heavyCannon'); muzzleFlash(e); puff(e.x, e.z, 2, 3, 1.2, true); }
      else if (e.type === 'hunterLunge') sfx('chargerReady');
      else if (e.type === 'playerHit') { sfx('hurt'); damagedUntil = clock + .3; if (state.player.hp < state.player.maxHp * .35) radio('裝甲撐不住了。越過低牆，拉開距離。', false, 4); }
      else if (e.type === 'wallHit') sfx('ricochet', { intensity: .35 });
      else if (e.type === 'destroyed') { sfx(e.kind === 'heavy' ? 'bossDown' : 'kill', { intensity: .7 }); puff(e.x, e.z, .8, e.kind === 'heavy' ? 6 : 2.5, e.kind === 'heavy' ? 3.3 : 1.8, false); }
      else if (e.type === 'supply') { sfx('upgrade'); radio('修復模組回收。繼續前進。', false, 3); }
      else if (e.type === 'reinforcements') radio('新一批敵機。留意側面，別讓獵兵逼進死角。', false, 5);
    }
  }
  function formatTime(value) { const n = Math.max(0, Math.floor(value || 0)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function showResult() {
    const won = state.phase === 'won';
    $('resultTitle').textContent = won ? '接應完成' : '連線中斷';
    $('resultKicker').textContent = won ? 'EXTRACTION COMPLETE / 作戰回報' : 'SIGNAL LOST / 作戰回報';
    $('resultMessage').textContent = won ? '觀測節點已摧毀。重型威脅解除，機體返回接應區。' : '主機失去戰鬥能力。利用牆壁切斷射線，預警鎖定後再換位。';
    $('resultTime').textContent = formatTime(state.stats.elapsed || state.time);
    $('resultKills').textContent = state.stats.kills || 0;
    $('resultDamage').textContent = Math.round(state.stats.damageTaken || 0);
    $('resultRadio').textContent = won ? '蕾娜：收到撤離訊號。辛，歡迎回來。' : '蕾娜：戰鬥紀錄已收到。我們重新整備，再找一條路。';
    $('resultScreen').hidden = false; $('combatUI').hidden = true; $('pauseBtn').hidden = true;
    $('retryBtn').focus({ preventScroll: true });
  }
  function updateMap() {
    const map = $('tacticalMap'), ctx = map.getContext('2d');
    const px = x => (x + 40) / 80 * 136 + 8, pz = z => (z + 48) / 96 * 160 + 8;
    ctx.clearRect(0, 0, 152, 178); ctx.strokeStyle = '#9dbcb72c'; ctx.strokeRect(8, 8, 136, 160);
    for (const o of state.obstacles) if (o.hp > 0) { ctx.fillStyle = o.type === 'high' ? '#91a6ab' : '#52676b'; ctx.fillRect(px(o.x - o.w / 2), pz(o.z - o.d / 2), o.w / 80 * 136, o.d / 96 * 160); }
    const ext = state.objective.extraction;
    ctx.strokeStyle = ext.active ? '#a2ede0' : '#526e72'; ctx.beginPath(); ctx.arc(px(ext.x), pz(ext.z), 5, 0, Math.PI * 2); ctx.stroke();
    for (const e of state.enemies) {
      if (e.kind !== 'relay' && e.kind !== 'supply' && Math.hypot(e.x - state.player.x, e.z - state.player.z) > 28) continue;
      ctx.fillStyle = e.kind === 'relay' ? '#eabb7e' : e.kind === 'supply' ? '#a2ddbc' : '#d17c67';
      const size = e.kind === 'heavy' ? 5 : e.kind === 'relay' ? 4 : 2;
      ctx.fillRect(px(e.x) - size / 2, pz(e.z) - size / 2, size, size);
    }
    ctx.fillStyle = '#edfff7'; ctx.beginPath(); ctx.arc(px(state.player.x), pz(state.player.z), 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c7f5e8'; ctx.beginPath(); ctx.moveTo(px(state.player.x), pz(state.player.z)); ctx.lineTo(px(state.player.x - Math.sin(state.player.aimAngle) * 6), pz(state.player.z - Math.cos(state.player.aimAngle) * 6)); ctx.stroke();
  }
  function updateHud() {
    updateMap();
    const p = state.player;
    $('hp').max = p.maxHp; $('hp').value = p.hp; $('hpText').textContent = Math.ceil(p.hp);
    $('missionTime').textContent = formatTime(state.time);
    const stages = { 'destroy-relays': ['觀測封鎖', '摧毀兩處觀測節點'], 'destroy-heavy': ['重型威脅', '繞側擊破重戰車'], 'clear-threats': ['接應準備', '清除殘存戰鬥機體'], extract: ['撤離窗口', '返回南側接應區'] };
    const stage = state.objective.stage, wording = stages[stage] || stages['destroy-relays'];
    $('objectiveLabel').textContent = wording[0]; $('objectiveText').textContent = wording[1];
    $('objectiveCount').textContent = stage === 'destroy-relays' ? (2 - state.objective.relayRemaining) + ' / 2' : stage === 'destroy-heavy' ? '重型目標 ' + state.objective.heavyRemaining : stage === 'clear-threats' ? '敵機 ' + state.enemies.filter(e => e.kind !== 'supply').length : '南側標記';
    if (stage !== lastObjective && state.phase === 'playing') {
      lastObjective = stage;
      radio(stage === 'destroy-relays' ? '先處理兩側觀測節點。斥候會替重砲校正射線。' : stage === 'destroy-heavy' ? '觀測節點已清除。重砲發射後，從側面接近。' : stage === 'clear-threats' ? '重型威脅解除。處理剩下的追兵，再返回接應區。' : '威脅解除。南側接應區已標定，我們撤離。', stage === 'extract', 7);
    }
    for (const [id, cd, max] of [['jumpSkill', p.jumpCd, 3.2], ['bladeSkill', p.skillCd, 4.4], ['supportSkill', p.supportCd, 18]]) {
      const el = $(id); el.classList.toggle('cooldown', cd > .05); el.querySelector('span').textContent = cd > .05 ? cd.toFixed(1) + 's' : '就緒'; el.querySelector('i').style.transform = 'scaleX(' + (1 - Math.min(1, cd / max)) + ')';
    }
    const heavy = state.enemies.find(e => e.kind === 'heavy' && e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 40);
    $('heavyBar').hidden = !heavy; if (heavy) { $('heavyHealth').value = heavy.hp / heavy.maxHp; $('heavyBar').querySelector('small').textContent = heavy.phase === 'recover' ? '散熱窗口 · 反擊' : '裝甲閉合'; }
  }
  function phaseChanged() {
    if (state.phase === lastPhase) return;
    lastPhase = state.phase;
    if (state.phase === 'launching') { $('transition').style.opacity = '.65'; radio('各機，前進。觀測節點在廢墟兩側，我會支援你。', true, 6); }
    if (state.phase === 'playing') { $('transition').style.opacity = '0'; music('battle'); }
    if (state.phase === 'settling') {
      clearInput(); $('transition').className = state.player.hp <= 0 ? 'defeat' : ''; $('transition').style.opacity = '.92';
      music(state.player.hp <= 0 ? 'defeat' : 'victory'); sfx(state.player.hp <= 0 ? 'defeat' : 'victory');
    }
    if (state.phase === 'won' || state.phase === 'lost') { showResult(); document.body.classList.remove('playing'); }
    if (sound) sound.update({ phase: ['won', 'lost'].includes(state.phase) ? 'over' : state.phase, won: state.phase === 'won' ? true : state.phase === 'lost' ? false : undefined });
  }
  function updateCamera(dt) {
    const p = state.player;
    const target = new B.Vector3(p.x + (readyCam ? 7 : 0), .5, p.z + (readyCam ? -4 : -3));
    const blend = 1 - Math.exp(-dt * 5);
    cameraTarget = B.Vector3.Lerp(cameraTarget, target, blend);
    const offset = readyCam ? new B.Vector3(13, 20, 23) : lowCamera ? new B.Vector3(19, 20, 28) : new B.Vector3(22, 38, 30);
    camera.position.copyFrom(cameraTarget.add(offset)); camera.setTarget(cameraTarget);
  }
  function readAim() {
    const ray = scene.createPickingRay(pointer.x, pointer.y, B.Matrix.Identity(), camera);
    const t = ray.intersectsPlane(new B.Plane(0, 1, 0, 0));
    if (t !== null && t >= 0) { const point = ray.origin.add(ray.direction.scale(t)); aim = { x: point.x, z: point.z }; }
    $('reticle').style.left = pointer.x + 'px'; $('reticle').style.top = pointer.y + 'px';
  }
  $('deployBtn').onclick = () => reset(true); $('retryBtn').onclick = () => reset(true);
  $('briefBtn').onclick = () => reset(false); $('abandonBtn').onclick = () => reset(false);
  $('resumeBtn').onclick = () => setPause(false); $('pauseBtn').onclick = () => setPause(true);
  $('radioClose').onclick = () => { $('radio').hidden = true; radioUntil = 0; };
  $('audioBtn').onclick = () => { if (audioUnlocked) audioEnabled = !audioEnabled; unlock(); };
  $('cameraBtn').onclick = () => { lowCamera = !lowCamera; $('cameraBtn').textContent = '視角：' + (lowCamera ? '低俯' : '斜俯'); sfx('uiSelect'); };
  document.querySelectorAll('button,a').forEach(el => { el.addEventListener('mouseenter', () => sfx('uiHover')); el.addEventListener('click', () => sfx('uiConfirm')); });
  canvas.addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; lastPointerActivity = clock; });
  canvas.addEventListener('pointerdown', e => { if (state.phase !== 'playing' || pause) return; unlock(); canvas.focus({ preventScroll: true }); if (e.button === 2) pressed.jump = true; if (e.button === 0) pressed.skill = true; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) setPause(!pause); e.preventDefault(); return; }
    if (!['playing', 'launching'].includes(state.phase) || pause) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code); if (e.code === 'Space' && !e.repeat) pressed.support = true;
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => setPause(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
  window.addEventListener('resize', () => engine.resize());
  (useM1A4 ? art.loadPlayerMotion() : Promise.resolve()).then(() => {
    modelReady = true;
    scene.executeWhenReady(() => { $('deployBtn').disabled = false; $('deployBtn').firstElementChild.textContent = '接通指揮頻道'; });
  }).catch(error => fail('M1A4 模型未能載入：' + error.message));
  music('prep');
  window.SortieApp = { get state() { return state; }, get scene() { return scene; }, get engine() { return engine; }, get paused() { return pause; }, project(x, z) { const p = B.Vector3.Project(new B.Vector3(x, 0, z), B.Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight())); const scale = canvas.clientWidth / engine.getRenderWidth(); return { x: p.x * scale, y: p.y * scale }; } };
  engine.runRenderLoop(() => {
    const now = performance.now(), dt = Math.min(.05, (now - previousTime) / 1000); previousTime = now; clock += dt;
    if (!pause && !document.hidden) {
      updateCamera(dt); readAim();
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
        const z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
        const right = camera.getDirection(B.Axis.X); const forward = camera.getForwardRay().direction; const flat = Math.hypot(forward.x, forward.z) || 1;
        Core.step(state, { moveX: x * right.x - z * forward.x / flat, moveZ: x * right.z - z * forward.z / flat, aimX: aim.x, aimZ: aim.z, jump: pressed.jump, skill: pressed.skill, support: pressed.support }, 1 / 60);
        pressed = { jump: false, skill: false, support: false }; processEvents(state.events); accumulator -= 1 / 60;
      }
      phaseChanged(); syncEntities(dt); syncShots(); syncEffects(); updateAftermath(dt);
      hudTime += dt; if (hudTime > .1) { updateHud(); hudTime = 0; }
    }
    if (radioUntil && clock > radioUntil) { $('radio').hidden = true; radioUntil = 0; }
    document.body.classList.toggle('damaged', clock < damagedUntil);
    scene.render();
  });
}());

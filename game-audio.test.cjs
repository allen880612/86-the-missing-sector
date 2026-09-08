const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const flush = () => new Promise(resolve => setImmediate(resolve));

function setup(bufferDuration = 10) {
  const fetches = [], pending = [], sources = [], oscillators = [], gains = [], mediaSources = [], audios = [];
  const documentListeners = {};
  const parameter = value => ({ value, setValueAtTime(next, time) { (this.values ||= []).push(next); (this.calls ||= []).push(['set', next, time]); this.value = next; }, linearRampToValueAtTime(next, time) { (this.calls ||= []).push(['linear', next, time]); this.value = next; }, exponentialRampToValueAtTime(next, time) { (this.calls ||= []).push(['exponential', next, time]); this.value = next; }, setTargetAtTime(next, time, constant) { (this.calls ||= []).push(['target', next, time, constant]); this.value = next; }, cancelScheduledValues() {} });
  class Context {
    constructor() { this.currentTime = 1; this.sampleRate = 8000; this.destination = {}; Context.instance = this; }
    resume() { return Promise.resolve(); }
    createGain() { const node = { gain: parameter(1), connect() {}, disconnect() { this.disconnects = (this.disconnects || 0) + 1; } }; gains.push(node); return node; }
    createMediaElementSource(audio) { const node = { audio, connect() {}, disconnect() { this.disconnects = (this.disconnects || 0) + 1; } }; mediaSources.push(node); return node; }
    createOscillator() { const node = { frequency: parameter(0), connect() {}, disconnect() { this.disconnects = (this.disconnects || 0) + 1; }, start() { this.started = true; }, stop(when) { if (when !== undefined) { this.scheduledStop = when; return; } this.stopped = true; this.onended?.(); } }; oscillators.push(node); return node; }
    createBuffer(_, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBiquadFilter() { return { frequency: parameter(0), Q: parameter(0), connect() {}, disconnect() {} }; }
    createBufferSource() { const node = { playbackRate: parameter(1), connect() {}, disconnect() { this.disconnects = (this.disconnects || 0) + 1; }, start(when, offset = 0, duration) { this.started = true; this.startWhen = when; this.offset = offset; this.duration = duration; }, stop(when) { if (when !== undefined) { this.scheduledStop = when; return; } this.stopped = true; this.onended?.(); } }; sources.push(node); return node; }
    decodeAudioData(raw) { return Promise.resolve({ tag: raw.tag, duration: bufferDuration }); }
  }
  function FakeAudio() { this.paused = true; this.currentTime = 0; this.volume = 1; this.playCount = 0; this.pauseCount = 0; this._src = ''; audios.push(this); }
  Object.defineProperty(FakeAudio.prototype, 'src', { get() { return this._src ? new URL(this._src, 'https://game.example.test/play/').href : ''; }, set(value) { this._src = value; } });
  FakeAudio.prototype.play = function () { this.paused = false; this.playCount++; return Promise.resolve(); };
  FakeAudio.prototype.pause = function () { this.paused = true; this.pauseCount++; };
  const scope = {
    window: { AudioContext: Context, document: { hidden: false, createElement(name) { assert.equal(name, 'audio'); return new FakeAudio(); }, addEventListener(type, listener) { documentListeners[type] = listener; } } },
    fetch(url) { fetches.push(url); return new Promise(resolve => pending.push({ url, resolve })); }, setTimeout, clearTimeout, Math
  };
  vm.runInNewContext(fs.readFileSync('game-audio.js', 'utf8'), scope);
  const resolveAll = async () => { for (const item of pending.splice(0)) item.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ tag: item.url }) }); await flush(); await flush(); };
  return { api: scope.window.FrontlineAudio, fetches, sources, oscillators, gains, mediaSources, audios, document: scope.window.document, visibility(hidden) { scope.window.document.hidden = hidden; documentListeners.visibilitychange?.(); }, resolveAll, now(value) { Context.instance.currentTime = value; } };
}

test('保留公開 API 並提供 preload 與只停止音效的 stopEffects', () => {
  const { api } = setup();
  for (const name of ['preload', 'unlock', 'setScene', 'setMusic', 'setSfx', 'setMusicVolume', 'setSfxVolume', 'update', 'effect', 'stopEffects', 'stopAll']) assert.equal(typeof api[name], 'function');
});

test('preload 只建立串流與載入素材，不 unlock、resume 或播放 BGM', async () => {
  const audio = setup(); audio.api.preload(); await audio.resolveAll();
  assert.equal(audio.audios.length, 2);
  assert.equal(audio.audios[0].playCount, 0);
  assert.ok(audio.fetches.some(path => path.includes('impactMetal')));
  audio.api.effect('uiConfirm');
  assert.equal(audio.sources.length, 0);
});

test('BGM 以 HTMLAudioElement 串流並接入 Web Audio music bus', () => {
  const audio = setup(); audio.api.unlock();
  assert.equal(audio.audios.length, 2);
  assert.ok(audio.audios[0].src.endsWith('/assets/audio/reference/prologue_theme_cleyton_kauffman.ogg'));
  assert.equal(audio.mediaSources.length, 2);
  assert.ok(audio.fetches.every(path => !path.includes('bgm_')));
});

test('六場景各有不同串流曲目，重入同場景不重開，切換使用另一軌淡接', () => {
  const audio = setup(); audio.api.preload(); audio.api.setScene('title'); audio.api.unlock();
  const expected = ['prologue_theme', 'bgm_sci_fi_theme', 'bgm_is_it_a_battle', 'bgm_war_theme', 'bgm_victory', 'bgm_defeat'];
  for (const [index, scene] of ['title', 'prep', 'battle', 'boss', 'victory', 'defeat'].entries()) {
    audio.api.setScene(scene);
    assert.ok(audio.audios.some(item => item.src.includes(expected[index])));
  }
  const current = audio.audios.find(item => item.src.includes('bgm_defeat')), plays = current.playCount;
  audio.api.setScene('defeat');
  assert.equal(current.playCount, plays);
  assert.ok(audio.gains.slice(5, 7).some(gain => gain.gain.calls.some(call => call[0] === 'linear')));
});

test('瀏覽器把 src 解析為絕對 URL 時，每幀 setScene 加 update 不重啟或再次 crossfade', () => {
  const audio = setup(); audio.api.unlock(); audio.api.setScene('battle');
  const plays = audio.audios.map(item => item.playCount);
  const ramps = audio.gains.slice(5, 7).map(gain => (gain.gain.calls || []).filter(call => call[0] === 'linear').length);
  for (let frame = 0; frame < 120; frame++) {
    audio.api.setScene('battle');
    audio.api.update({ phase: 'playing', playing: true });
  }
  assert.deepEqual(audio.audios.map(item => item.playCount), plays);
  assert.deepEqual(audio.gains.slice(5, 7).map(gain => (gain.gain.calls || []).filter(call => call[0] === 'linear').length), ramps);
});

test('首手勢前切場景不播放，靜音與頁面隱藏保存位置，恢復後續播', () => {
  const audio = setup(); audio.api.setScene('prep');
  assert.equal(audio.audios.reduce((sum, item) => sum + item.playCount, 0), 0);
  audio.api.unlock();
  const current = audio.audios.find(item => !item.paused); current.currentTime = 9;
  audio.visibility(true); assert.equal(current.currentTime, 9); assert.equal(current.paused, true);
  audio.visibility(false); assert.equal(current.playCount, 2);
  audio.api.setMusic(false); assert.equal(current.currentTime, 9);
  audio.api.setMusic(true); assert.equal(current.playCount, 3);
});

test('暫停與靜音保存 HTMLAudioElement 位置，stopAll 才回到零', () => {
  const audio = setup(); audio.api.unlock(); audio.api.update({ phase: 'playing', playing: true });
  const music = audio.audios.find(item => item.src.includes('bgm_is_it_a_battle')); music.currentTime = 12.5;
  audio.api.update({ phase: 'paused', playing: false }); assert.equal(music.currentTime, 12.5);
  audio.api.update({ phase: 'playing', playing: true }); assert.equal(music.playCount, 2);
  audio.api.setMusic(false); audio.api.setMusic(true); assert.equal(music.currentTime, 12.5);
  audio.api.stopAll(); assert.equal(music.currentTime, 0);
});

test('ready、over、launching、playing、settling 都播放 BGM 且有不同 phase level', () => {
  const audio = setup(); audio.api.unlock();
  const levels = [];
  audio.api.update({ phase: 'ready' }); levels.push(audio.gains[2].gain.value);
  audio.api.update({ phase: 'over' }); levels.push(audio.gains[2].gain.value);
  audio.api.update({ phase: 'launching', playing: true }); assert.equal(audio.gains[2].gain.value, 0.62);
  levels.push(audio.gains[2].gain.value);
  audio.api.update({ phase: 'playing', playing: true }); assert.equal(audio.gains[2].gain.value, 1);
  levels.push(audio.gains[2].gain.value);
  audio.api.update({ phase: 'settling', playing: true }); assert.equal(audio.gains[2].gain.value, 0.72);
  levels.push(audio.gains[2].gain.value);
  assert.equal(new Set(levels).size, 5);
  assert.ok(audio.audios.reduce((sum, item) => sum + item.playCount, 0) >= 1);
});

test('unlock 前不播放，使用者 gesture unlock 後在開始頁 over 播放', () => {
  const audio = setup();
  audio.api.update({ phase: 'over' });
  assert.equal(audio.audios.reduce((sum, item) => sum + item.playCount, 0), 0);
  audio.api.unlock();
  assert.equal(audio.audios.reduce((sum, item) => sum + item.playCount, 0), 1);
});

test('UI hover 限流且選擇與確認用不同既有短素材，不觸發 BGM duck', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('uiHover'); audio.api.effect('uiHover');
  audio.now(1.09); audio.api.effect('uiHover');
  audio.now(2); audio.api.effect('uiSelect');
  audio.now(3); audio.api.effect('uiConfirm');
  assert.equal(audio.sources.length, 4);
  assert.ok(audio.sources[0].buffer.tag.includes('impactTin'));
  assert.ok(audio.sources[2].buffer.tag.includes('impactTin'));
  assert.ok(audio.sources[3].buffer.tag.includes('impactMetal'));
  assert.ok(audio.sources.every(source => source.duration / source.playbackRate.value < .14));
  assert.equal(audio.gains[4].gain.value, 1);
});

test('首次 uiConfirm 在 impact 解碼完成後補播一次，stopEffects 可取消', async () => {
  const first = setup(); first.api.preload(); first.api.unlock(); first.api.effect('uiConfirm');
  assert.equal(first.sources.length, 0);
  await first.resolveAll();
  assert.equal(first.sources.length, 1);
  assert.ok(first.sources[0].buffer.tag.includes('impactMetal'));

  const cancelled = setup(); cancelled.api.preload(); cancelled.api.unlock(); cancelled.api.effect('uiConfirm'); cancelled.api.stopEffects();
  await cancelled.resolveAll();
  assert.equal(cancelled.sources.length, 0);
});

test('stopEffects 只停止 SFX 並保留 BGM 位置與播放狀態', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  const music = audio.audios[0]; music.currentTime = 18;
  audio.api.effect('impact'); audio.api.stopEffects();
  assert.ok(audio.sources[0].stopped);
  assert.equal(music.paused, false);
  assert.equal(music.currentTime, 18);
});

test('音樂使用者音量只套用一次到 music bus', () => {
  const audio = setup(); audio.api.unlock(); audio.api.setMusicVolume(.4); audio.api.update({ phase: 'playing', playing: true });
  assert.equal(audio.gains[1].gain.value, .4); assert.equal(audio.gains[2].gain.value, 1);
});

test('素材解碼成功但不會把 BGM 整曲 decode', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll(); audio.api.effect('impact');
  assert.equal(audio.sources[0].buffer.tag, 'assets/audio/impactMetal_heavy_000.ogg');
});

test('主砲用實體砲火短尾音，普通砲擊仍用遠爆，僅 rail 或 sweep 使用雷射', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('mainShot', { machine: 'm4a3' }); audio.now(2); audio.api.effect('cannon'); audio.now(3); audio.api.effect('rail'); audio.now(4); audio.api.effect('cannon', { kind: 'sweep' });
  const played = audio.sources.map(source => source.buffer.tag);
  assert.ok(played.some(tag => tag.includes('cannon_fire_thimras'))); assert.ok(played.some(tag => tag.includes('explosion_muffled'))); assert.equal(played.filter(tag => tag.includes('cannon_doomsday')).length, 2);
});

test('實體主砲與 LMG 都以短片段開始，排程 stop 不會立刻視為結束', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('mainShot'); audio.now(2); audio.api.effect('shot');
  const cannon = audio.sources.find(source => source.buffer.tag.includes('cannon_fire_thimras'));
  const lmg = audio.sources.find(source => source.buffer.tag.includes('lmg_fire01_kuraiwolf'));
  assert.deepEqual([cannon.offset, cannon.duration], [0, 0.8]);
  assert.deepEqual([lmg.offset, lmg.duration], [0, 0.12]);
  assert.ok(cannon.scheduledStop > cannon.startWhen); assert.ok(lmg.scheduledStop > lmg.startWhen);
  assert.equal(cannon.stopped, undefined); assert.equal(lmg.stopped, undefined);
});

test('普通 LMG shot 仍受限流，聲源結束後可回收', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll(); audio.api.effect('shot'); audio.api.effect('shot');
  assert.equal(audio.sources.filter(source => source.buffer.tag.includes('lmg_fire')).length, 1);
  const lmg = audio.sources[0], gain = audio.gains.at(-1); lmg.onended();
  assert.ok(lmg.disconnects > 0); assert.ok(gain.disconnects > 0);
});

test('自然結束與 stopAll 都會 disconnect 聲源對應的 gain', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll(); audio.api.effect('impact');
  const source = audio.sources[0], gain = audio.gains.at(-1); source.onended();
  assert.ok(source.disconnects > 0); assert.ok(gain.disconnects > 0);
  audio.api.effect('shot'); audio.api.stopAll();
  assert.ok(audio.sources.at(-1).disconnects > 0);
});

test('最多保留 24 個 SFX，warning 會擠掉一般碰撞聲源', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  for (let index = 0; index < 24; index++) { audio.now(index + 1); audio.api.effect('impact'); }
  audio.now(30); audio.api.effect('warning');
  assert.equal(audio.sources.filter(source => source.started && !source.stopped).length, 23);
  assert.equal(audio.oscillators.filter(node => node.started && !node.stopped).length, 1);
  assert.ok(audio.sources.filter(source => source.stopped).length >= 1);
});

test('砲兵與獵兵預告以 priority 2 保留並將 BGM duck 到 .25', async () => {
  for (const type of ['mortarReady', 'chargerReady']) {
    const audio = setup(); audio.api.unlock(); await audio.resolveAll();
    for (let index = 0; index < 24; index++) { audio.now(index + 1); audio.api.effect('impact'); }
    audio.now(30); audio.api.effect(type);
    assert.equal(audio.sources.filter(source => source.started && !source.stopped).length, 24);
    assert.ok(audio.sources.some(source => source.stopped));
    assert.ok(audio.gains[4].gain.calls.some(call => call[0] === 'target' && call[1] === .25));
  }
});

test('裁切的 laser 與遠爆依來源時長排程淡出與停止', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('rail'); audio.now(2); audio.api.effect('cannon');
  const laser = audio.sources.find(source => source.buffer.tag.includes('doomsday'));
  const distant = audio.sources.find(source => source.buffer.tag.includes('explosion_muffled'));
  assert.deepEqual([laser.duration, distant.duration], [1.1, .95]);
  for (const source of [laser, distant]) {
    assert.ok(Math.abs(source.scheduledStop - source.startWhen - (source.duration / source.playbackRate.value + .02)) < 1e-9);
  }
  const gains = audio.gains.slice(-2);
  assert.ok(gains.every(gain => gain.gain.calls.some(call => call[0] === 'linear' && call[1] === .0001)));
  assert.ok(gains.every(gain => gain.gain.calls.some(call => call[0] === 'linear' && call[1] > 0)));
});

test('每個 sample 以 3ms attack 開始，bossDown 疊加機械裂解、遠爆與短設備雜訊', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('impact'); audio.now(2); audio.api.effect('bossDown');
  const impactGain = audio.gains[7], boss = audio.sources.find(source => source.buffer.tag && source.buffer.tag.includes('distant')), bossGain = audio.gains[9];
  assert.ok(impactGain.gain.calls.some(call => call[0] === 'linear' && call[2] === 1.003));
  assert.equal(boss.duration, 2.1);
  assert.ok(bossGain.gain.calls.some(call => call[0] === 'linear' && Math.abs(call[2] - 4.8) < 1e-9));
  assert.equal(audio.sources.filter(source => source.buffer.tag === undefined).length, 1);
});

test('eliteDown 使用短機械裂解、金屬撞擊與設備雜訊，warning 保持較高聲源優先權', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll(); audio.api.effect('eliteDown');
  assert.ok(audio.sources.some(source => source.buffer.tag && source.buffer.tag.includes('mechanical')));
  assert.ok(audio.sources.some(source => source.buffer.tag && source.buffer.tag.includes('impactMetal')));
  assert.equal(audio.sources.filter(source => source.buffer.tag === undefined).length, 1);
  for (let index = audio.sources.length; index < 24; index++) { audio.now(index + 2); audio.api.effect('impact'); }
  audio.now(40); audio.api.effect('warning');
  assert.equal(audio.oscillators.length, 1);
});

test('切片長度超過短 AudioBuffer 時，start、fade 與 stop 都使用可用來源長度', async () => {
  const audio = setup(.1); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('chargerReady');
  const source = audio.sources[0], gain = audio.gains.at(-1);
  assert.equal(source.duration, .1);
  assert.ok(gain.gain.calls.some(call => call[0] === 'linear' && call[1] === .0001 && call[2] === 1.08));
  assert.ok(Math.abs(source.scheduledStop - 1.1) < 1e-9);
});

test('短弱射擊 duck 不會在強預告期間覆蓋 .25，stopAll 會清除 duck 狀態', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('warning');
  audio.now(1.05); audio.api.effect('support');
  const duck = audio.gains[4].gain;
  assert.equal(duck.calls.filter(call => call[0] === 'target' && call[1] === .25).length, 1);
  assert.equal(duck.calls.some(call => call[0] === 'target' && call[1] === .58 && call[2] === 1.05), false);
  audio.api.stopAll();
  assert.equal(duck.value, 1);
  audio.now(2); audio.api.effect('support');
  assert.ok(duck.calls.some(call => call[0] === 'target' && call[1] === .58 && call[2] === 2));
});

test('普通 shot 不壓低 BGM', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll(); audio.api.effect('shot');
  assert.equal(audio.gains[4].gain.value, 1);
});

test('裁切素材依機型播放速率換算停止時間，慢速重砲不被提前切掉', async () => {
  for (const [machine,rate] of [['m4a3',.82],['m1a4',1.24]]) {
    const audio=setup();audio.api.unlock();await audio.resolveAll();audio.api.effect('mainShot',{machine});
    const source=audio.sources.find(s=>s.buffer.tag.includes('cannon_fire_thimras'));
    assert.ok(Math.abs(source.scheduledStop-source.startWhen-(.8/rate+.02))<1e-9);
  }
});

test('刀刃與架勢準備都使用短低調機械素材，且刀刃依機型改變揮擊速率', async () => {
  const audio = setup(); audio.api.unlock(); await audio.resolveAll();
  audio.api.effect('blade', { machine: 'm1a4' }); audio.now(2); audio.api.effect('braceReady');
  assert.equal(audio.sources.length, 3);
  const [slash, contact, ready] = audio.sources;
  assert.ok(slash.buffer.tag.includes('mecha_dash_whoosh'));
  assert.ok(contact.buffer.tag.includes('impactTin'));
  assert.ok(ready.buffer.tag.includes('impactMetal'));
  assert.equal(slash.playbackRate.value, 1.24);
  assert.ok(slash.duration / slash.playbackRate.value < .2);
  assert.ok(contact.duration / contact.playbackRate.value < .15);
  assert.ok(ready.duration / ready.playbackRate.value < .2);
  assert.ok(audio.gains.slice(-3).every(gain => gain.gain.value < .1));
  assert.ok(audio.sources.every(source => !source.buffer.tag.includes('cannon') && !source.buffer.tag.includes('explosion')));
});

test('brace 與 momentum 主砲各播放一次砲火，並加上低音量短尾質地', async () => {
  for (const boost of ['brace', 'momentum']) {
    const audio = setup(); audio.api.unlock(); await audio.resolveAll();
    audio.api.effect('mainShot', { machine: 'xm2', boost });
    assert.equal(audio.sources.filter(source => source.buffer.tag.includes('cannon_fire')).length, 1);
    assert.equal(audio.sources.length, 2);
    const tail = audio.sources.find(source => source.buffer.tag.includes('impactMetal'));
    assert.ok(tail);
    assert.ok(tail.duration / tail.playbackRate.value < .2);
    assert.ok(audio.gains.at(-1).gain.value < .1);
    assert.equal(audio.sources.some(source => source.buffer.tag.includes('impactTin')), false);
  }
});

test('補給強化事件確實播放既有金屬素材，滿值領取使用較輕回饋', async () => {
 const audio=setup();audio.api.unlock();await audio.resolveAll();
 audio.api.effect('upgrade');assert.equal(audio.sources.length,1);assert.ok(audio.sources[0].buffer.tag.includes('impactTin'));
 const normal=Math.max(...audio.gains.at(-1).gain.values);audio.now(2);audio.api.effect('upgrade',{empty:true});
 assert.equal(audio.sources.length,2);assert.ok(Math.max(...audio.gains.at(-1).gain.values)<normal);assert.equal(audio.oscillators.length,0);
});

test('Morpho三連砲與核心開啟使用現有短素材，靜音後不留聲源',async()=>{
 const a=setup();a.api.unlock();await a.resolveAll();
 a.api.effect('vulcan');assert.equal(a.sources.length,1);assert.ok(a.sources[0].buffer.tag.includes('lmg_fire01'));assert.equal(a.oscillators.length,0);
 a.now(2);a.api.effect('coreOpen');assert.equal(a.sources.length,2);assert.ok(a.sources[1].buffer.tag.includes('impactMetal'));assert.equal(a.oscillators.length,0);
 a.api.setSfx(false);assert.ok(a.sources.every(v=>v.stopped));a.api.effect('vulcan');assert.equal(a.sources.length,2);
});


test('支援砲擊與誘餌啟動使用不同既有素材，誘餌不播放爆炸',async()=>{
 const a=setup();a.api.unlock();await a.resolveAll();a.api.effect('decoy');assert.equal(a.sources.length,1);assert.ok(a.sources[0].buffer.tag.includes('impactTin'));assert.equal(a.oscillators.length,0);
 a.now(2);a.api.effect('support');assert.equal(a.sources.length,3);assert.ok(a.sources[1].buffer.tag.includes('cannon_fire'));assert.ok(a.sources[2].buffer.tag.includes('distant'));a.api.setSfx(false);assert.ok(a.sources.every(v=>v.stopped));
});

test('重戰車主副砲都使用砲火素材，以速率與尾音區分火力',async()=>{const a=setup();a.api.unlock();await a.resolveAll();a.api.effect('heavyCannon');assert.equal(a.sources.length,2);assert.ok(a.sources[0].buffer.tag.includes('cannon_fire'));assert.ok(a.sources[1].buffer.tag.includes('distant'));const heavyRate=a.sources[0].playbackRate.value;a.now(2);a.api.effect('sideCannon');assert.equal(a.sources.length,3);assert.ok(a.sources[2].buffer.tag.includes('cannon_fire'));assert.ok(a.sources[2].playbackRate.value>heavyRate);a.api.setSfx(false);assert.ok(a.sources.every(s=>s.stopped));});

test('獵兵預備、突進與剎停使用短實體素材，突進不播放砲擊或合成警報',async()=>{
 const a=setup();a.api.unlock();await a.resolveAll();
 for(const [i,type] of ['chargerReady','chargerDash','chargerBrake','chargerStagger'].entries()){a.now(i+1);a.api.effect(type);}
 assert.equal(a.sources.length,4);assert.ok(a.sources[1].buffer.tag.includes('mecha_dash_whoosh'));assert.ok(a.sources.every(v=>!v.buffer.tag.includes('cannon')&&!v.buffer.tag.includes('explosion')));assert.equal(a.oscillators.length,0);
 assert.ok(a.sources.every(v=>v.duration/v.playbackRate.value<.5));a.api.setSfx(false);assert.ok(a.sources.every(v=>v.stopped));a.api.effect('chargerDash');assert.equal(a.sources.length,4);
});


test('砲兵準備、離膛、落地與斷線使用分開短音且同事件限流',async()=>{
 const a=setup();a.api.unlock();await a.resolveAll();
 for(const [i,type] of ['mortarReady','mortarLaunch','mortarImpact','fireLinkBroken'].entries()){a.now(i+1);a.api.effect(type);a.api.effect(type);}
 assert.equal(a.sources.length,4);assert.ok(a.sources[0].buffer.tag.includes('impactMetal'));assert.ok(a.sources[1].buffer.tag.includes('cannon_fire'));assert.ok(a.sources[2].buffer.tag.includes('distant'));assert.ok(a.sources[3].buffer.tag.includes('impactTin'));assert.equal(a.oscillators.length,0);assert.ok(a.sources.every(v=>v.duration/v.playbackRate.value<.5));a.api.setSfx(false);assert.ok(a.sources.every(v=>v.stopped));
});


test('榴彈每次爆破使用一次短爆音，穿甲命中用短金屬音而非爆炸',async()=>{const a=setup();a.api.unlock();await a.resolveAll();a.api.effect('heBurst');a.api.effect('heBurst');a.now(2);a.api.effect('apImpact');assert.equal(a.sources.length,2);assert.ok(a.sources[0].buffer.tag.includes('mechanical'));assert.ok(a.sources[1].buffer.tag.includes('impactMetal'));assert.ok(a.sources.every(s=>s.duration/s.playbackRate.value<.3));assert.equal(a.oscillators.length,0);});


test('干擾進入與解除各播放短機械素材且同事件限流，靜音後不觸發',async()=>{const a=setup();a.api.unlock();await a.resolveAll();a.api.effect('jamEnter');a.api.effect('jamEnter');a.now(2);a.api.effect('jamClear');assert.equal(a.sources.length,2);assert.ok(a.sources[0].buffer.tag.includes('impactTin'));assert.ok(a.sources[1].buffer.tag.includes('impactMetal'));assert.ok(a.sources.every(v=>v.duration/v.playbackRate.value<.25));assert.equal(a.oscillators.length,0);a.api.setSfx(false);assert.ok(a.sources.every(v=>v.stopped));a.api.effect('jamEnter');assert.equal(a.sources.length,2);});

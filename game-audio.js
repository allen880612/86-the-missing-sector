(function () {
  'use strict';

  var context, master, musicBus, musicPhaseBus, sfxBus, duckBus;
  var musicElements = [], musicElementSources = [], musicGains = [], musicTrackIds = [], musicIndex = 0, musicFadeTimer = null;
  var scene = 'title', explicitScene = false, hiddenPaused = false;
  var unlocked = false, musicOn = true, sfxOn = true, phase = 'over', duckUntil = -Infinity, duckLevel = 1;
  var musicVolume = 0.58, sfxVolume = 0.85;
  var buffers = {}, active = [], lastEffect = {}, lastShot = -Infinity;
  var pendingConfirmTimer = null;
  var MAX_SFX = 24;
  var files = {
    music: {
      title: 'assets/audio/reference/prologue_theme_cleyton_kauffman.ogg',
      prep: 'assets/audio/bgm_sci_fi_theme_spring_spring.ogg',
      battle: 'assets/audio/bgm_space_battle_mintodog.ogg',
      boss: 'assets/audio/bgm_war_theme_spring_spring.ogg',
      victory: 'assets/audio/bgm_victory_spring_spring.ogg',
      defeat: 'assets/audio/bgm_defeat_no_hope_cleyton_kauffman.ogg'
    },
    laser: 'assets/audio/cannon_doomsday_laser_tad_short.wav',
    cannonFire: 'assets/audio/cannon_fire_thimras.ogg',
    lmg: 'assets/audio/lmg_fire01_kuraiwolf.mp3',
    mechanicalExplosion: 'assets/audio/explosion_mechanical_spring_spring.wav',
    distantExplosion: 'assets/audio/explosion_muffled_distant_nenadsimic.wav',
    impact: 'assets/audio/impactMetal_heavy_000.ogg',
    dashWhoosh: 'assets/audio/mecha_dash_whoosh_sword_sfx.wav',
    ricochet: 'assets/audio/impactTin_medium_000.ogg'
  };

  function now() { return context ? context.currentTime : 0; }
  function clamp(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
  function playable() { return phase === 'ready' || phase === 'over' || phase === 'launching' || phase === 'playing' || phase === 'settling'; }
  function wantsMusic() { return unlocked && musicOn && playable(); }
  function phaseLevel() { return phase === 'ready' ? 0.48 : phase === 'over' ? 0.56 : phase === 'launching' ? 0.62 : phase === 'settling' ? 0.72 : 1; }
  function priority(type) { return type === 'warning' || type === 'hurt' ? 3 : type === 'bossEnter' || type === 'bossDown' || type === 'eliteDown' || type === 'mortarReady' || type === 'chargerReady' ? 2 : 1; }

  function makeGain(value, destination) {
    var node = context.createGain();
    node.gain.value = value;
    node.connect(destination);
    return node;
  }

  function disconnect(nodes) {
    nodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
  }

  function removeVoice(voice) {
    var index = active.indexOf(voice);
    if (index < 0) return;
    active.splice(index, 1);
    disconnect(voice.nodes);
  }

  function stopVoice(voice) {
    try { voice.source.stop(); } catch (_) {}
    removeVoice(voice);
  }

  function reserveVoice(level) {
    if (active.length < MAX_SFX) return true;
    var candidate = active.find(function (voice) { return voice.priority < level; });
    if (!candidate) candidate = active.find(function (voice) { return voice.priority === level; });
    if (!candidate) return false;
    stopVoice(candidate);
    return true;
  }

  function track(source, nodes, level) {
    var voice = { source: source, nodes: nodes, priority: level };
    active.push(voice);
    source.onended = function () { removeVoice(voice); };
    return source;
  }

  function syncMusicLevel() {
    var level = phaseLevel();
    if (musicPhaseBus) {
      musicPhaseBus.gain.cancelScheduledValues(now());
      musicPhaseBus.gain.setTargetAtTime(level, now(), 0.08);
    } else if (musicElements[0]) {
      musicElements.forEach(function (element) { element.volume = musicVolume * level; });
    }
  }

  function initMusicElement() {
    if (musicElements.length || !window.document || !window.document.createElement) return;
    for (var index = 0; index < 2; index++) {
      var element = window.document.createElement('audio');
      element.preload = 'metadata';
      element.loop = true;
      if (index === 0) element.src = files.music[scene];
      musicElements.push(element);
      musicTrackIds.push(index === 0 ? scene : null);
      try {
        var source = context.createMediaElementSource(element);
        var gain = makeGain(index === 0 ? 1 : 0, musicPhaseBus);
        source.connect(gain);
        musicElementSources.push(source);
        musicGains.push(gain);
      } catch (_) {
        musicElementSources.push(null);
      }
    }
    if (window.document.addEventListener) window.document.addEventListener('visibilitychange', function () {
      if (window.document.hidden) {
        hiddenPaused = musicElements.some(function (item) { return !item.paused; });
        pauseMusic(false);
      } else if (hiddenPaused) {
        hiddenPaused = false;
        startMusic();
      }
    });
    syncMusicLevel();
  }

  function init() {
    if (context) return;
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
    master = makeGain(0.82, context.destination);
    musicBus = makeGain(musicVolume, master);
    musicPhaseBus = makeGain(1, musicBus);
    sfxBus = makeGain(sfxVolume, master);
    duckBus = makeGain(1, master);
    musicBus.disconnect();
    musicBus.connect(duckBus);
    initMusicElement();
    Object.keys(files).filter(function (key) { return key !== 'music'; }).forEach(function (key) { load(key, files[key]); });
  }

  function load(key, path) {
    if (typeof fetch !== 'function') return;
    fetch(path).then(function (response) {
      if (!response.ok) throw new Error('audio fetch failed');
      return response.arrayBuffer();
    }).then(function (data) {
      return context.decodeAudioData(data);
    }).then(function (buffer) {
      buffers[key] = buffer;
      if (key === 'impact' && pendingConfirmTimer !== null && unlocked && sfxOn) {
        clearTimeout(pendingConfirmTimer);
        pendingConfirmTimer = null;
        sample('uiConfirm', 'impact', 0.055, 1.35, 0, 0.12);
      }
    }).catch(function () {});
  }

  function startMusic() {
    var musicElement = musicElements[musicIndex];
    if (!musicElement || !wantsMusic() || (window.document && window.document.hidden) || !musicElement.paused) return;
    syncMusicLevel();
    var playing = musicElement.play();
    if (playing && typeof playing.catch === 'function') playing.catch(function () {});
  }

  function pauseMusic(reset) {
    musicElements.forEach(function (musicElement) {
      musicElement.pause();
      if (reset) try { musicElement.currentTime = 0; } catch (_) {}
    });
  }

  function setScene(next, internal) {
    if (!files.music[next]) return false;
    if (!internal) explicitScene = true;
    init();
    if (scene === next && musicElements[musicIndex] && musicTrackIds[musicIndex] === next) {
      startMusic();
      return true;
    }
    scene = next;
    if (!musicElements.length) return true;
    var oldIndex = musicIndex, nextIndex = oldIndex ? 0 : 1;
    var oldMusic = musicElements[oldIndex], nextMusic = musicElements[nextIndex];
    if (musicFadeTimer !== null) clearTimeout(musicFadeTimer);
    nextMusic.pause();
    try { nextMusic.currentTime = 0; } catch (_) {}
    nextMusic.src = files.music[next];
    musicTrackIds[nextIndex] = next;
    musicIndex = nextIndex;
    if (musicGains.length === 2) {
      var time = now();
      musicGains[oldIndex].gain.cancelScheduledValues(time);
      musicGains[nextIndex].gain.cancelScheduledValues(time);
      musicGains[oldIndex].gain.setValueAtTime(1, time);
      musicGains[nextIndex].gain.setValueAtTime(0.0001, time);
      musicGains[oldIndex].gain.linearRampToValueAtTime(0.0001, time + 0.65);
      musicGains[nextIndex].gain.linearRampToValueAtTime(1, time + 0.65);
    }
    startMusic();
    musicFadeTimer = setTimeout(function () {
      oldMusic.pause();
      try { oldMusic.currentTime = 0; } catch (_) {}
      musicFadeTimer = null;
    }, 700);
    return true;
  }

  function tone(type, frequency, duration, waveform, volume, endFrequency) {
    if (!context || !sfxOn || !reserveVoice(priority(type))) return;
    var start = now();
    var oscillator = context.createOscillator();
    var voiceGain = makeGain(0.0001, sfxBus);
    oscillator.type = waveform || 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.linearRampToValueAtTime(volume, start + 0.01);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(voiceGain);
    track(oscillator, [oscillator, voiceGain], priority(type));
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  function staticBurst(type, duration, volume) {
    if (!context || !sfxOn || !reserveVoice(priority(type))) return;
    var start = now(), length = Math.max(1, Math.floor(context.sampleRate * duration));
    var buffer = context.createBuffer(1, length, context.sampleRate);
    var data = buffer.getChannelData(0);
    for (var index = 0; index < length; index++) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    var source = context.createBufferSource();
    var filter = context.createBiquadFilter();
    var voiceGain = makeGain(volume, sfxBus);
    filter.type = 'bandpass'; filter.frequency.value = 1450; filter.Q.value = 0.7;
    source.buffer = buffer;
    source.connect(filter); filter.connect(voiceGain);
    track(source, [source, filter, voiceGain], priority(type));
    source.start(start); source.stop(start + duration);
  }

  function sample(type, key, volume, rate, offset, duration) {
    if (!context || !sfxOn || !buffers[key] || !reserveVoice(priority(type))) return false;
    var start = now();
    var source = context.createBufferSource();
    var voiceGain = makeGain(0.0001, sfxBus);
    source.buffer = buffers[key];
    source.playbackRate.value = rate || 1;
    var available = Math.max(0, source.buffer.duration - (offset || 0));
    duration = duration === undefined ? available : Math.min(duration, available);
    var playSeconds = duration / source.playbackRate.value;
    voiceGain.gain.setValueAtTime(0.0001, start);
    voiceGain.gain.linearRampToValueAtTime(volume, start + 0.003);
    voiceGain.gain.setValueAtTime(volume, start + Math.max(0.003, playSeconds - 0.04));
    voiceGain.gain.linearRampToValueAtTime(0.0001, start + playSeconds);
    source.connect(voiceGain);
    track(source, [source, voiceGain], priority(type));
    source.start(start, offset || 0, duration);
    source.stop(start + playSeconds + 0.02);
    return true;
  }

  function duck(seconds, level) {
    if (!duckBus) return;
    level = level === undefined ? 0.58 : level;
    var time = now();
    if (time >= duckUntil) duckLevel = 1;
    if (time < duckUntil && level > duckLevel) return;
    duckLevel = Math.min(duckLevel, level);
    duckUntil = Math.max(duckUntil, time + seconds);
    duckBus.gain.cancelScheduledValues(time);
    duckBus.gain.setTargetAtTime(duckLevel, time, 0.015);
    duckBus.gain.setTargetAtTime(1, duckUntil, 0.12);
  }

  function machineRate(machine) {
    var name = String(machine || '').toLowerCase();
    if (name === 'm1a4' || name.indexOf('57') >= 0) return 1.24;
    if (name === 'xm2' || name.indexOf('88') >= 0) return 1;
    return 0.82;
  }

  function effect(type, detail) {
    if (!context || !unlocked || !sfxOn) return;
    detail = detail || {};
    var time = now();
    var intensity = Math.max(0.5, Math.min(1.5, Number(detail.intensity) || 1));
    if (type === 'uiConfirm' && !buffers.impact) {
      if (pendingConfirmTimer !== null) return;
      pendingConfirmTimer = setTimeout(function () { pendingConfirmTimer = null; }, 200);
      return;
    }
    if (type === 'shot') {
      if (time - lastShot < 0.08) return;
      lastShot = time;
      sample(type, 'lmg', 0.12 * intensity, 1, 0, 0.12) || tone(type, 155, 0.055, 'square', 0.045, 72);
      return;
    }
    var cooldown = type === 'uiHover' ? 0.08 : type === 'mainShot' || type === 'cannon' ? 0.1 : type === 'kill' || type === 'partBreak' ? 0.08 : 0.03;
    if (lastEffect[type] !== undefined && time - lastEffect[type] < cooldown) return;
    lastEffect[type] = time;
    if (type === 'uiHover') { sample(type, 'ricochet', 0.025 * intensity, 1.8, 0, 0.08); return; }
    if (type === 'uiSelect') { sample(type, 'ricochet', 0.045 * intensity, 1.25, 0, 0.1); return; }
    if (type === 'uiConfirm') { sample(type, 'impact', 0.055 * intensity, 1.35, 0, 0.12); return; }
    if (type === 'mainShot') {
      sample(type, 'cannonFire', 0.17 * intensity, machineRate(detail.machine), 0, 0.8) || tone(type, 70, 0.24, 'sine', 0.14 * intensity, 35);
      if (detail.boost === 'brace' || detail.boost === 'momentum') sample(type, 'impact', 0.055 * intensity, 0.78, 0, 0.13);
      return;
    }
    if (type === 'blade') { sample(type, 'dashWhoosh', 0.065 * intensity, machineRate(detail.machine), 0, 0.16); sample(type, 'ricochet', 0.045 * intensity, 1.2, 0, 0.1); return; }
    if (type === 'braceReady') { sample(type, 'impact', 0.055 * intensity, 1.15, 0, 0.16); return; }
    if (type === 'cannon') {
      if (detail.kind === 'sweep' || detail.kind === 'rail') sample(type, 'laser', 0.18 * intensity, 0.82, 0, 1.1);
      else sample(type, 'distantExplosion', 0.14 * intensity, 1.15, 0, 0.95) || tone(type, 55, 0.3, 'sine', 0.12 * intensity, 28);
      return;
    }
    if (type === 'jamEnter') { sample(type, 'ricochet', 0.07, 0.7, 0, 0.14); return; }
    if (type === 'jamClear') { sample(type, 'impact', 0.065, 1.6, 0, 0.15); return; }
    if (type === 'heBurst') { sample(type, 'mechanicalExplosion', 0.085 * intensity, 1.25, 0, 0.3); return; }
    if (type === 'apImpact') { sample(type, 'impact', 0.12 * intensity, 1.25, 0, 0.13); return; }
    if (type === 'mortarReady') { duck(0.2, 0.25); sample(type, 'impact', 0.055 * intensity, 1.1, 0, 0.16); return; }
    if (type === 'mortarLaunch') { sample(type, 'cannonFire', 0.09 * intensity, 0.85, 0, 0.28); return; }
    if (type === 'mortarImpact') { sample(type, 'distantExplosion', 0.16 * intensity, 1.1, 0, 0.44); return; }
    if (type === 'fireLinkBroken') { sample(type, 'ricochet', 0.045 * intensity, 1.1, 0, 0.13); return; }
    if (type === 'heavyCannon') { duck(0.2); sample(type, 'cannonFire', 0.16 * intensity, 0.7, 0, 0.65); sample(type, 'distantExplosion', 0.08 * intensity, 0.9, 0, 0.95); return; }
    if (type === 'sideCannon') { sample(type, 'cannonFire', 0.12 * intensity, 1.45, 0, 0.35); return; }
    if (type === 'chargerReady') { duck(0.2, 0.25); sample(type, 'impact', 0.07 * intensity, 1.25, 0, 0.18); return; }
    if (type === 'chargerDash') { sample(type, 'dashWhoosh', 0.2 * intensity, 0.8, 0, 0.3); return; }
    if (type === 'chargerBrake') { sample(type, 'impact', 0.11 * intensity, 0.65, 0, 0.28); return; }
    if (type === 'chargerStagger') { sample(type, 'ricochet', 0.055 * intensity, 0.8, 0, 0.15); return; }
    if (type === 'decoy') { sample(type, 'ricochet', 0.065 * intensity, 0.9, 0, 0.16); return; }
    if (type === 'support') { duck(0.18); sample(type, 'cannonFire', 0.13 * intensity, 0.85, 0, 0.55); sample(type, 'distantExplosion', 0.1 * intensity, 1.1, 0, 0.95); return; }
    if (type === 'vulcan') { sample(type, 'lmg', 0.17 * intensity, 0.8, 0, 0.18); return; }
    if (type === 'coreOpen') { sample(type, 'impact', 0.065 * intensity, 0.7, 0, 0.25); return; }
    if (type === 'rail') { duck(0.22); sample(type, 'laser', 0.18 * intensity, 0.72, 0, 1.1) || tone(type, 42, 0.4, 'sine', 0.14 * intensity, 25); return; }
    if (type === 'eliteDown') { duck(0.18, 0.62); sample(type, 'mechanicalExplosion', 0.16 * intensity, 1.15, 0, 0.7); sample(type, 'impact', 0.09 * intensity, 0.72, 0, 0.2); staticBurst(type, 0.14, 0.035); return; }
    if (type === 'bossDown') { duck(0.55, 0.42); sample(type, 'mechanicalExplosion', 0.19 * intensity, 0.82, 0, 1.1); sample(type, 'distantExplosion', 0.22 * intensity, 0.75, 0, 2.1); staticBurst(type, 0.32, 0.05); return; }
    if (type === 'kill') { sample(type, 'mechanicalExplosion', 0.2 * intensity, 1); return; }
    if (type === 'impact') { sample(type, 'impact', 0.18 * intensity, 1) || tone(type, 78, 0.14, 'sine', 0.1 * intensity, 38); return; }
    if (type === 'upgrade') { sample(type, 'ricochet', detail.empty ? 0.035 : 0.09, 1.45, 0, 0.16); return; }
    if (type === 'partBreak') { sample(type, 'mechanicalExplosion', 0.12 * intensity, 1.2); return; }
    if (type === 'ricochet') { sample(type, 'ricochet', 0.12 * intensity, 1) || tone(type, 960, 0.06, 'square', 0.05, 1450); return; }
    if (type === 'warning') { duck(0.35, 0.25); tone(type, 740, 0.12, 'square', 0.07, 520); return; }
    if (type === 'hurt') { duck(0.16); tone(type, 105, 0.16, 'square', 0.1, 55); return; }
    if (type === 'enemycharge') { duck(0.2); tone(type, 52, 0.45, 'sawtooth', 0.07 * intensity, 180); return; }
    if (type === 'servo' || type === 'dodge') tone(type, type === 'servo' ? 95 : 240, 0.12, 'sawtooth', 0.03, type === 'servo' ? 62 : 760);
    else if (type === 'bossEnter') { duck(0.3); tone(type, 49, 0.55, 'sine', 0.13, 35); }
    else if (type === 'victory') { tone(type, 330, 0.16, 'sine', 0.06); tone(type, 495, 0.25, 'sine', 0.06); }
    else if (type === 'defeat') tone(type, 220, 0.35, 'triangle', 0.07, 110);
  }

  function stopEffects() {
    if (pendingConfirmTimer !== null) clearTimeout(pendingConfirmTimer);
    pendingConfirmTimer = null;
    active.slice().forEach(stopVoice);
    lastEffect = {};
    lastShot = -Infinity;
    duckUntil = -Infinity;
    duckLevel = 1;
    if (duckBus) {
      duckBus.gain.cancelScheduledValues(now());
      duckBus.gain.setValueAtTime(1, now());
    }
  }

  window.FrontlineAudio = {
    preload: init,
    unlock: function () { init(); if (!context) return; unlocked = true; context.resume(); if (wantsMusic()) startMusic(); },
    setScene: setScene,
    setMusic: function (enabled) { musicOn = enabled !== false; if (wantsMusic()) startMusic(); else pauseMusic(false); },
    setSfx: function (enabled) { sfxOn = enabled !== false; if (!sfxOn) stopEffects(); },
    setMusicVolume: function (value) { musicVolume = clamp(value); if (musicBus) musicBus.gain.value = musicVolume; syncMusicLevel(); },
    setSfxVolume: function (value) { sfxVolume = clamp(value); if (sfxBus) sfxBus.gain.value = sfxVolume; },
    update: function (state) {
      phase = (state && state.phase) || ((state && state.playing) ? 'playing' : 'over');
      if (!explicitScene) {
        if (phase === 'ready') setScene('prep', true);
        else if (phase === 'launching') setScene('battle', true);
        else if (phase === 'playing') setScene(state && state.boss ? 'boss' : 'battle', true);
        else if (phase === 'settling' || phase === 'over') setScene(state && state.won === false ? 'defeat' : state && state.won === true ? 'victory' : 'title', true);
      }
      syncMusicLevel(); if (wantsMusic()) startMusic(); else pauseMusic(false);
    },
    effect: effect,
    stopEffects: stopEffects,
    stopAll: function () { if (musicFadeTimer !== null) clearTimeout(musicFadeTimer); musicFadeTimer = null; pauseMusic(true); stopEffects(); }
  };
}());

(() => {
  const params = new URLSearchParams(location.search);
  window.FrontlineAudio?.preload?.();
  const defaults = { gameMode: 'frontline', machine: 'm1a4', encounter: 'mixed', ammo: 'standard', tactic: 'support', arenaBoss: 'dinosauria' };
  const titleScreen = document.getElementById('titleScreen');
  const overlay = document.getElementById('overlay');
  const radio = document.getElementById('combatRadio');
  let radioTimer;
  let radioPriority = 0;
  let radioShownAt = 0;
  let radioLastMessage = '';
  function uiSound(kind) {
    const audio = window.FrontlineAudio;
    if (typeof audio?.[kind] === 'function') audio[kind]();
    else audio?.effect(kind);
  }
  function refreshBriefing() {
    const endless = document.getElementById('gameMode').value === 'endless';
    document.body.classList.toggle('endless-mode', endless);
    const tacticInput = document.getElementById('tactic');
    if (endless && tacticInput.value !== 'support') {
      tacticInput.value = 'support';
      tacticInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.getElementById('titleControl').textContent = endless ? 'WASD／方向鍵四向移動 · 滑鼠瞄準 · 自動開砲 · 左鍵機型技能／右鍵躍進' : '左右移動 · 自動射擊 · 走位選補給';
    document.getElementById('footerControls').innerHTML = endless ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 四向移動 <em>滑鼠瞄準 · 自動開砲 · 左鍵機型技能／右鍵躍進</em>' : '<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> 左右移動 <em>或按住畫面拖曳</em>';
    document.getElementById('game').setAttribute('aria-label', endless ? '使用 WASD 或方向鍵四向移動，滑鼠瞄準、自動發射主砲，左鍵機型技能、右鍵躍進' : '使用 A、D、方向鍵或拖曳左右移動，自動射擊');
    document.getElementById('description').textContent = endless ? '配置機體與火力，守住四向戰場。' : '選擇你的機體，突破軍團戰線。';
    if (!overlay.hidden && !overlay.classList.contains('paused')) document.getElementById('hint').textContent = endless ? 'WASD／方向鍵四向移動 · 滑鼠瞄準 · 自動開砲 · 左鍵機型技能／右鍵躍進 · 四面接敵' : '向下捲動選擇遭遇與裝備 · 可直接出擊';
    const machine = document.getElementById('machine').value;
    document.querySelectorAll('[data-choice="machine"] small').forEach(label=>{if(label.closest('.card-metrics'))return;const id=label.closest('[data-choice]').dataset.value;label.textContent=(endless?{m1a4:'近距反擊',m4a3:'重砲超頻',xm2:'高速刃擊'}:{m1a4:'機動反擊',m4a3:'停穩重砲',xm2:'高速近擊'})[id];});
    const encounter = document.getElementById('encounter').value;
    document.getElementById('briefingMachine').textContent = (endless ? {
      m1a4: 'M1A4，左鍵近距反擊可清除周邊彈火；右鍵躍進180。保留反擊，替撤離打開缺口。',
      m4a3: 'M4A3，左鍵重砲超頻，3秒射速提升。先用躍進150找安全射角，再集中拆解重型目標。',
      xm2: 'XM2，右鍵躍進220切入、左鍵刃擊打斷近敵。耐久薄，斬擊後利用失衡窗口脫離。'
    } : {
      m1a4: 'M1A4，先避開射界；讓接近的敵機進入近擊範圍。',
      m4a3: 'M4A3，移到安全位置後停穩，讓重砲發揮火力。',
      xm2: 'XM2，保持橫移累積動能，再用強化砲擊反攻。'
    })[machine] || '';
    document.getElementById('briefingEnemy').textContent = endless ? '每四波敵軍升階。射爆地雷清路、先拆斥候減少協同砲擊；僚機火控受侵時，離開阻電群或呼叫支援。' : ({
      mixed: '先拆重戰車副砲；整備後注意電磁砲的安全缺口。',
      dinosauria: '側移拆除副砲；主砲發射後，抓住核心開放的時機。',
      morpho: '提早移進射界缺口；砲擊結束後對準核心。',
      pursuit: '等獵兵鎖定後換線；它撲空失衡時就是反擊機會。',
      'fire-support': '優先擊破斥候，切斷落點修正；離開干擾雲，恢復遠距鎖定。',
      mines: '提前射爆地雷，利用連鎖爆破清出路線。'
    })[encounter] || '';
    if (!endless) return;
    const firstBoss = document.getElementById('arenaBoss').value;
    const bosses = {
      dinosauria: { name: 'Dinosauria', role: '重戰車型', hp: 2200, attack: '重砲交叉射界', advice: '首敵是重戰車。先離開直線砲口與曲射落點，最後一輪落地後有 2 秒散熱窗口。' },
      phoenix: { name: 'Phönix', role: '高機動型', hp: 1600, attack: '側翼突進／鏈刃橫掃', advice: '首敵是 Phönix。直線突進向側面躲，扇形鏈刃繞背或躍出；第二階段突進後會追斬，等收刃再反擊。' },
      morpho: { name: 'Morpho', role: '電磁加速砲型', hp: 2600, attack: '電磁直射／交錯落點', advice: '首敵是電磁砲。先移出預鎖射線，再避開交錯落點；最後一發後有 2 秒反擊窗口。' }
    };
    const boss = bosses[firstBoss] || bosses.dinosauria;
    for (const image of document.querySelectorAll('[data-boss-preview]')) {
      const source = window.previewSource?.(image.dataset.bossPreview);
      if (source && !source.endsWith('official-phoenix.jpg')) image.src = source;
    }
    document.getElementById('briefingEnemy').textContent = boss.advice;
    document.getElementById('enemyModel').textContent = boss.name.toUpperCase();
    document.getElementById('enemyRole').textContent = '首個接敵 · ' + boss.role;
    const bossSource = window.previewSource?.(firstBoss);
    const preview = document.getElementById('enemyPreview');
    if (bossSource && !bossSource.endsWith('official-phoenix.jpg')) preview.src = bossSource;
    else preview.removeAttribute('src');
    preview.alt = boss.name + ' · ' + boss.role;
    document.getElementById('enemySecond').hidden = true;
    document.getElementById('enemyStats').innerHTML = `<div><span>初始耐久</span><strong>${boss.hp} HP</strong></div><div><span>攻擊特色</span><strong>${boss.attack}</strong></div><div><span>反擊窗口</span><strong>散熱／撲空 2 秒</strong></div>`;
    document.getElementById('encounterBrief').innerHTML = '<span class="skill-name">每四波升階</span><strong>第 5／9 波起，最多 2／3 個重型目標同場。</strong><small>半血或升階後連擊改變。Stier 會偏轉射界追擊，躲開後抓散熱窗口。</small>';
    document.getElementById('ammoBrief').innerHTML = {standard:'<strong>環向應變</strong><span>穩定處理各方向目標</span>',ap:'<strong>直線穿透</strong><span>對準同方向密集目標</span>',he:'<strong>爆風清場</strong><span>處理近身包圍</span>'}[document.getElementById('ammo').value];
    document.getElementById('tacticBrief').innerHTML = '<strong>區域支援 · 初始 2 次／18 秒回充</strong><span>指定落點 · 清場打斷</span>';
  }
  function clearRadio() {
    clearTimeout(radioTimer);
    radio.hidden = true;
    radioPriority = 0;
    delete radio.dataset.key;
    radioShownAt = 0;
    radioLastMessage = '';
  }
  function setDialogue(prefix, character, message) {
    const wrapper = document.querySelector(`.${prefix}-dialogue`);
    const text = document.getElementById(`${prefix}SpeakerText`);
    if (!wrapper || !text) return false;
    if (!message) {
      text.textContent = '';
      wrapper.hidden = true;
      return false;
    }
    const lena = character === 'lena';
    const portrait = document.getElementById(`${prefix}SpeakerPortrait`);
    const name = document.getElementById(`${prefix}SpeakerName`);
    portrait.src = `assets/characters/${lena ? 'lena' : 'shin'}-reference.png`;
    portrait.alt = lena ? '蕾娜' : '辛';
    name.textContent = portrait.alt;
    text.textContent = String(message);
    wrapper.hidden = false;
    return true;
  }
  function showTitle() {
    clearRadio();
    document.getElementById('configure').click();
    titleScreen.hidden = false;
    overlay.inert = true;
    document.querySelector('.actions').inert = true;
    document.body.classList.add('title-open');
    window.FrontlineAudio?.setScene?.('title');
    document.getElementById('enterGame').focus({ preventScroll: true });
  }
  window.FrontlineUI = {
    clearRadio,
    refreshBriefing,
    showTitle,
    phaseDialogue(character, message) {
      return setDialogue('phase', character, message);
    },
    reportDialogue(character, message) {
      return setDialogue('report', character, message);
    },
    radioMessage(character, message, type = 'status', options = {}) {
      if (!titleScreen.hidden || !overlay.hidden || !message) return false;
      const now = performance.now();
      const priority = options.priority ?? (type === 'warning' ? 4 : type === 'tactic' ? 2 : 1);
      if (!radio.hidden && (priority < radioPriority || priority === radioPriority && (options.key ? options.key === radio.dataset.key : String(message) === radioLastMessage || now - radioShownAt < 1100))) return false;
      radioPriority = priority;
      radioShownAt = now;
      radioLastMessage = String(message);
      const lena = character === 'lena';
      const portrait = document.getElementById('radioPortrait');
      portrait.src = `assets/characters/${lena ? 'lena' : 'shin'}-reference.png`;
      portrait.alt = lena ? '蕾娜' : '辛';
      document.getElementById('radioName').textContent = portrait.alt;
      document.getElementById('radioChannel').textContent = type === 'tactic' ? '戰術執行' : type === 'warning' ? '敵情通報' : '作戰通訊';
      document.getElementById('radioText').textContent = String(message);
      radio.dataset.type = ['status', 'tactic', 'warning'].includes(type) ? type : 'status';
      radio.dataset.character = lena ? 'lena' : 'shin';
      radio.dataset.key = options.key || '';
      radio.hidden = false;
      uiSound('uiSelect');
      if (!document.body.classList.contains('reduce-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        radio.getAnimations().forEach(animation => animation.cancel());
        radio.animate([{ opacity: .35, translate: lena ? '12px 0' : '-12px 0' }, { opacity: 1, translate: '0 0' }], { duration: 240, easing: 'ease-out' });
      }
      clearTimeout(radioTimer);
      if (!options.managed) radioTimer = setTimeout(clearRadio, (options.duration ?? (type === 'warning' ? 2.8 : 2.4)) * 1000);
      return true;
    }
  };
  const skipTitle = params.get('qa') === '1';
  titleScreen.hidden = skipTitle;
  overlay.inert = !skipTitle;
  document.querySelector('.actions').inert = !skipTitle;
  document.body.classList.toggle('title-open', !skipTitle);
  function enterGame() {
    window.FrontlineAudio?.unlock();
    window.FrontlineAudio?.setScene?.('prep');
    uiSound('uiConfirm');
    titleScreen.hidden = true;
    overlay.inert = false;
    document.querySelector('.actions').inert = false;
    document.body.classList.remove('title-open');
    refreshBriefing();
    document.querySelector('[data-choice="machine"].active')?.focus({ preventScroll: true });
  }
  document.getElementById('enterGame').addEventListener('click', enterGame);
  document.getElementById('returnTitle').addEventListener('click', showTitle);
  document.querySelectorAll('[data-choice]').forEach(card => {
    const id = card.dataset.choice;
    if(id==='encounter'){const models={pursuit:'grauwolf',mixed:'dinosauria','fire-support':'eintagsfliege',mines:'mine',dinosauria:'dinosauria',morpho:'morpho'};const img=document.createElement('img');img.src='art-direction/86-reference/images/official-'+models[card.dataset.value]+'.jpg';img.alt='';card.prepend(img);}

    const input = document.getElementById(id);
    if (!input) return;
    const value = params.get(id);
    if (value && document.querySelector(`[data-choice="${id}"][data-value="${CSS.escape(value)}"]`)) input.value = value;
    card.addEventListener('click', () => {
      uiSound('uiSelect');
      if (!document.body.classList.contains('reduce-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches) card.animate([{ transform: 'scale(.97)' }, { transform: 'scale(1)' }], { duration: 180, easing: 'ease-out' });
      input.value = card.dataset.value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      refreshBriefing();
    });
    input.addEventListener('change', () => {
      document.querySelectorAll(`[data-choice="${id}"]`).forEach(item => {item.classList.toggle('active', item.dataset.value === input.value);item.setAttribute('aria-pressed',String(item.dataset.value === input.value));});
      input.setAttribute('value', input.value);
    });
    input.dispatchEvent(new Event('change'));
  });
  Object.entries(defaults).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = value;
  });
  ['machine', 'encounter', 'ammo', 'tactic', 'arenaBoss'].forEach(id => document.getElementById(id).addEventListener('change', refreshBriefing));
  document.getElementById('gameMode').addEventListener('change', () => {
    if (document.getElementById('gameMode').value !== 'endless') window.loadoutPreview?.();
    refreshBriefing();
  });
  document.querySelectorAll('#titleScreen button, #loadout button, #start, #retry, #nextEncounter, #changeLoadout, #skipPhase, #returnTitle').forEach(button => {
    button.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch' && !button.disabled && (!titleScreen.hidden || !overlay.hidden && !overlay.classList.contains('paused') || !document.getElementById('debrief').hidden || !document.getElementById('transition').hidden)) uiSound('uiHover');
    });
  });
  document.getElementById('start').addEventListener('click', clearRadio);
  document.getElementById('skipPhase').addEventListener('click', () => uiSound('uiSelect'));
  document.getElementById('configure').addEventListener('click', clearRadio);
  refreshBriefing();
  setTimeout(refreshBriefing);
})();

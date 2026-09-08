(() => {
  const params = new URLSearchParams(location.search);
  window.FrontlineAudio?.preload?.();
  const defaults = { gameMode: 'frontline', machine: 'm1a4', encounter: 'mixed', ammo: 'standard', tactic: 'support' };
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
    document.getElementById('titleControl').textContent = endless ? 'WASD／方向鍵四向移動 · 滑鼠瞄準 · 自動開砲 · 左鍵超頻／右鍵躍進' : '左右移動 · 自動射擊 · 走位選補給';
    document.getElementById('footerControls').innerHTML = endless ? '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 四向移動 <em>滑鼠瞄準 · 自動開砲 · 左鍵超頻／右鍵躍進</em>' : '<kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> 左右移動 <em>或按住畫面拖曳</em>';
    document.getElementById('game').setAttribute('aria-label', endless ? '使用 WASD 或方向鍵四向移動，滑鼠瞄準、自動發射主砲，左鍵超頻、右鍵躍進' : '使用 A、D、方向鍵或拖曳左右移動，自動射擊');
    document.getElementById('description').textContent = endless ? '配置機體與火力，守住四向戰場。' : '選擇你的機體，突破軍團戰線。';
    if (!overlay.hidden && !overlay.classList.contains('paused')) document.getElementById('hint').textContent = endless ? 'WASD／方向鍵四向移動 · 滑鼠瞄準 · 自動開砲 · 左鍵超頻／右鍵躍進 · 四面接敵' : '向下捲動選擇遭遇與裝備 · 可直接出擊';
    const machine = document.getElementById('machine').value;
    document.querySelectorAll('[data-choice="machine"] small').forEach(label=>{if(label.closest('.card-metrics'))return;const id=label.closest('[data-choice]').dataset.value;label.textContent=(endless?{m1a4:'均衡火力',m4a3:'重砲裝甲',xm2:'高速連射'}:{m1a4:'機動反擊',m4a3:'停穩重砲',xm2:'高速近擊'})[id];});
    const encounter = document.getElementById('encounter').value;
    document.getElementById('briefingMachine').textContent = (endless ? {
      m1a4: 'M1A4，躍進180。僚機顧近身，主砲處理包圍較薄的一側；危急時僚機可攔截致命傷。',
      m4a3: 'M4A3，厚裝甲與重砲，躍進150。適合用掩體壓制敵人，提早離開曲射落點。',
      xm2: 'XM2，躍進220、連射快，但耐久薄。利用越障切換射角，別停在敵群中央。'
    } : {
      m1a4: 'M1A4，先避開射界；讓接近的敵機進入近擊範圍。',
      m4a3: 'M4A3，移到安全位置後停穩，讓重砲發揮火力。',
      xm2: 'XM2，保持橫移累積動能，再用強化砲擊反攻。'
    })[machine] || '';
    document.getElementById('briefingEnemy').textContent = endless ? '射爆地雷清路，擊落阻電群恢復僚機索敵；先拆斥候可減少協同砲擊。右鍵躍進跨越包圍，落地後仍須避開砲火。' : ({
      mixed: '先拆重戰車副砲；整備後注意電磁砲的安全缺口。',
      dinosauria: '側移拆除副砲；主砲發射後，抓住核心開放的時機。',
      morpho: '提早移進射界缺口；砲擊結束後對準核心。',
      pursuit: '等獵兵鎖定後換線；它撲空失衡時就是反擊機會。',
      'fire-support': '優先擊破斥候，切斷落點修正；離開干擾雲，恢復遠距鎖定。',
      mines: '提前射爆地雷，利用連鎖爆破清出路線。'
    })[encounter] || '';
    if (!endless) return;
    document.getElementById('enemyModel').textContent = 'DINOSAURIA / MORPHO';
    document.getElementById('enemyRole').textContent = '掩體交戰 · 重型火力 / Boss 交替';
    document.getElementById('enemyPreview').src = window.previewSource?.('dinosauria') || 'art-direction/86-reference/images/official-dinosauria.jpg';
    document.getElementById('enemyPreview').alt = 'Dinosauria 重戰車型 · 四向戰場 Boss';
    document.getElementById('enemySecond').hidden = false;
    document.getElementById('enemySecond').src = window.previewSource?.('morpho') || 'art-direction/86-reference/images/official-morpho.jpg';
    document.getElementById('enemySecond').alt = 'Morpho 電磁加速砲型 · 四向戰場 Boss';
    document.getElementById('enemyStats').innerHTML = '<div><span>斥候／砲兵</span><strong>資料鏈協同砲擊</strong></div><div><span>獵兵／戰車</span><strong>衝撞與直射</strong></div><div><span>阻電機群／地雷</span><strong>干擾與連鎖爆破</strong></div>';
    document.getElementById('encounterBrief').innerHTML = '<span class="skill-name">四向戰術</span><strong>觀察四面威脅，移動與砲口分開控制。</strong><small>Boss 交替出現；作戰持續到主機失能。</small>';
    document.getElementById('ammoBrief').innerHTML = {standard:'<strong>環向應變</strong><span>穩定處理各方向目標</span>',ap:'<strong>直線穿透</strong><span>對準同方向密集目標</span>',he:'<strong>爆風清場</strong><span>處理近身包圍</span>'}[document.getElementById('ammo').value];
    document.getElementById('tacticBrief').innerHTML = document.getElementById('tactic').value === 'decoy' ? '<strong>四向誘敵</strong><span>誘導 6 秒 · 結束時區域震盪</span>' : '<strong>區域砲擊</strong><span>延遲 0.65 秒 · 半徑 230 · 跨越掩體</span>';
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
      radio.dataset.key = options.key || '';
      radio.hidden = false;
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
  ['machine', 'encounter', 'ammo', 'tactic'].forEach(id => document.getElementById(id).addEventListener('change', refreshBriefing));
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

(() => {
  const params = new URLSearchParams(location.search);
  window.FrontlineAudio?.preload?.();
  const defaults = { gameMode: 'frontline', machine: 'm1a4', encounter: 'mixed', ammo: 'standard', tactic: 'support', arenaBoss: 'dinosauria', arenaMap: 'ruins' };
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
  const commandDialog = document.getElementById('commandDialog');
  const reducedMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dialogTimer, dialogOpener;
  function openCommand(title, content, opener) {
    dialogOpener = opener || document.activeElement;
    clearTimeout(dialogTimer);
    commandDialog.classList.remove('leaving');
    document.getElementById('commandDialogTitle').textContent = title;
    document.getElementById('commandDialogBody').replaceChildren(content);
    if (!commandDialog.open) commandDialog.showModal();
    window.dispatchEvent(new Event('command-dialog-open'));
    window.FrontlineAudio?.unlock();
    uiSound('uiConfirm');
  }
  function closeCommand() {
    uiSound('uiSelect');
    if (reducedMotion()) commandDialog.close();
    else { commandDialog.classList.add('leaving'); dialogTimer = setTimeout(() => { commandDialog.close(); commandDialog.classList.remove('leaving'); }, 180); }
  }
  commandDialog.querySelector('button').onclick = closeCommand;
  commandDialog.addEventListener('close', () => { if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true }); });
  commandDialog.addEventListener('cancel', event => { event.preventDefault(); closeCommand(); });
  const diagramArt = [
    '<path d="M100 116V23M35 78H165m-72-48 7-7 7 7m51 41 7 7-7 7"/><path class="unit" d="M91 65h18l8 17-17 12-17-12Z"/><path d="m109 69 33-31" stroke-dasharray="4 5"/><circle cx="150" cy="31" r="10"/>',
    '<path d="M20 110Q90 0 172 77m-9-11 9 11-14 1"/><path class="cover" d="M75 90h40v24H75Z"/><ellipse cx="170" cy="100" rx="16" ry="6"/><path class="unit" d="M160 64h17l8 14-16 8-15-8Z"/>',
    '<ellipse cx="100" cy="83" rx="70" ry="32"/><path d="M100 22v49m-8-9 8 9 8-9M76 91h10m31-19h10m-30 30h10"/><circle cx="100" cy="83" r="5"/>',
    '<path d="M28 88h144m-12-8 12 8-12 8M60 58V25m40 33V25m40 33V25"/><path class="unit" d="M90 72h20v26H90Zm-40 12h14v20H50Zm86 0h14v20h-14Z"/>',
    '<path d="M45 31h25v62H45Zm43 0h25v62H88Zm43 0h25v62h-25Z"/><path d="M40 111h123"/><circle cx="57" cy="109" r="5"/><circle cx="101" cy="109" r="5"/><circle cx="145" cy="109" r="5"/>',
    '<path d="M25 76h150m-10-8 10 8-10 8"/><circle cx="45" cy="76" r="17"/><circle cx="100" cy="76" r="17"/><circle cx="155" cy="76" r="17"/><path class="unit" d="m38 76 5 6 11-14"/>'
  ];
  document.querySelectorAll('.guide-open').forEach(button => button.onclick = () => {
    const endless = document.getElementById('gameMode').value === 'endless';
    const items = endless ? [['移動與自動射擊', 'WASD／方向鍵走位；游標瞄準，主砲自動開火。'], ['短躍進脫離包圍', '右鍵越過敵機與低掩體；高牆需繞行。小雷達顯示道路與補給。'], ['支援打開缺口', 'Space 指定游標落點，範圍壓制與打斷；18 秒回充。']] : [['帶領編隊換線', 'A／D、左右鍵或拖曳移動。保持射角，編隊自動開火。'], ['走位選擇補給', '靠向需要的補給路線，補充裝甲、僚機或火力。'], ['擊破作戰目標', '避開預警射界，等核心開放反擊；結算後推進下一場。']];
    const content = document.createElement('div');
    content.className = 'command-diagrams';
    items.forEach(([title, text], i) => {
      const card = document.createElement('section');
      card.innerHTML = `<svg viewBox="0 0 200 140" aria-hidden="true">${diagramArt[i + (endless ? 0 : 3)]}</svg><h3>${title}</h3><p>${text}</p>`;
      content.append(card);
    });
    if (endless) { const note = document.createElement('p'); note.className = 'command-footnote'; note.textContent = '1 主砲無限彈藥；回收彈箱後，2 機砲 120 發、3 穿甲重砲 18 發，Q 輪替。耗盡自動切回主砲。左鍵施展機型技能。'; content.append(note); }
    openCommand(endless ? '四向戰場 · 移動與反擊' : '戰線突破 · 帶隊推進', content, button);
  });
  document.querySelectorAll('.title-radio, .briefing-radio, .phase-dialogue, .report-dialogue').forEach((panel, index) => {
    panel.classList.add('command-radio');
    const close = document.createElement('button'); close.type = 'button'; close.className = 'command-radio-close'; close.textContent = '×'; close.setAttribute('aria-label', '收起通訊');
    const reopen = document.createElement('button'); reopen.type = 'button'; reopen.className = 'command-radio-reopen'; reopen.textContent = '開啟通訊'; reopen.hidden = true;
    const details = document.createElement('button'); details.type = 'button'; details.className = 'command-radio-details'; details.textContent = '通訊詳情';
    close.onclick = () => { panel.classList.add('radio-collapsed'); reopen.hidden = false; uiSound('uiSelect'); reopen.focus({ preventScroll: true }); };
    reopen.onclick = () => { panel.classList.remove('radio-collapsed'); reopen.hidden = true; uiSound('uiSelect'); close.focus({ preventScroll: true }); };
    details.onclick = () => { const copy = document.createElement('div'); copy.className = 'command-detail'; panel.querySelectorAll('p:not(.command-summary)').forEach(p => { const paragraph = document.createElement('p'); paragraph.textContent = p.textContent; copy.append(paragraph); }); openCommand('指揮頻道 · 通訊詳情', copy, details); };
    panel.append(close, details); panel.after(reopen);
    if (panel.classList.contains('briefing-radio')) { const summary = document.createElement('p'); summary.className = 'command-summary'; panel.querySelector('.briefing-copy').append(summary); }
  });
  function updateCommandSummary() {
    const summary = document.querySelector('.command-summary');
    const machine = document.getElementById('machine').value;
    summary.textContent = document.getElementById('gameMode').value === 'endless' ? ({m1a4:'保留反擊，替撤離打開缺口。',m4a3:'先找安全射角，再超頻集火。',xm2:'刃擊打斷後，利用躍進脫離。'})[machine] : ({m1a4:'先避開射界，再近距反擊。',m4a3:'移到安全位置後，停穩開砲。',xm2:'保持橫移，累積動能反攻。'})[machine];
  }
  function refreshBriefing() {
    updateCommandSummary();
    for (const card of document.querySelectorAll('[data-choice="arenaMap"]')) {
      const map = window.GameArenaCore?.maps?.[card.dataset.value];
      if (!map || card.dataset.mapped) continue;
      card.querySelector('svg').innerHTML = '<rect width="160" height="160" fill="#15232b"/>' + map.walls.map(([,x,y,w,h]) => `<rect x="${(x-w/2)/10}" y="${(y-h/2)/10}" width="${w/10}" height="${h/10}" fill="#88928a"/>`).join('') + map.covers.map(([,x,y,w,h]) => `<rect x="${(x-w/2)/10}" y="${(y-h/2)/10}" width="${w/10}" height="${h/10}" fill="#bdab80"/>`).join('') + '<circle cx="80" cy="80" r="3" fill="#d8f2e9"/>';
      card.dataset.mapped = 'true';
    }
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
      dinosauria: { name: 'Dinosauria', role: '重戰車型', attack: '重砲交叉射界', advice: '首敵是重戰車。先離開直線砲口與曲射落點，最後一輪落地後有 2 秒散熱窗口。' },
      phoenix: { name: 'Phönix', role: '高機動型', attack: '側翼突進／鏈刃橫掃', advice: '首敵是 Phönix。直線突進向側面躲，扇形鏈刃繞背或躍出；第二階段突進後會追斬，等收刃再反擊。' },
      morpho: { name: 'Morpho', role: '電磁加速砲型', attack: '電磁直射／交錯落點', advice: '首敵是電磁砲。先移出預鎖射線，再避開交錯落點；最後一發後有 2 秒反擊窗口。' }
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
    document.getElementById('enemyStats').innerHTML = `<div><span>攻擊特色</span><strong>${boss.attack}</strong></div><div><span>反擊窗口</span><strong>散熱／撲空 2 秒</strong></div>`;
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
  ['machine', 'encounter', 'ammo', 'tactic', 'arenaBoss', 'arenaMap'].forEach(id => document.getElementById(id).addEventListener('change', refreshBriefing));
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

'use strict';

function arenaPoint(x,y){return {x:W*(.07+x*.00086),y:H*(.08+y*.00084),scale:1};}
function arenaAim(event){const r=canvas.getBoundingClientRect();s.aimX=clamp(((event.clientX-r.left)/W-.07)/.00086,0,1000);s.aimY=clamp(((event.clientY-r.top)/H-.08)/.00084,0,1000);}
function arenaDirection(angle){return Math.atan2(Math.sin(angle)*H*.00084,Math.cos(angle)*W*.00086);}

function arenaLoadoutPreview(){
 const machine=$('machine').value,m=GameArenaCore.machines[machine],ammo=$('ammo').value,damage=m.damage*(ammo==='ap'?1.25:ammo==='he'?.85:1),interval=m.interval*(ammo==='ap'?1.25:1),n=v=>Number(v.toFixed(2));
 $('allyPreview').src=previewSource(machine);$('allyPreview').alt=m.name;$('allyModel').textContent=machine.toUpperCase();$('allyRole').textContent=m.name+' · 四向作戰';
 $('allyStats').innerHTML='<small class="stats-context">無限戰場 · 開局 LV.0</small>'+[['耐久',m.hp,'HP',m.hp/160],['移速',m.speed,'m/s',m.speed/360],['主砲直擊',n(damage),'／發',damage/55],['裝填',n(interval),'秒',.18/interval]].map(([label,value,unit,ratio])=>`<div class="dossier-stat"><span>${label==='移速'?'移動速度':label}</span><strong>${value}<small>${unit==='m/s'?'單位／秒':unit}</small></strong><i><em style="width:${clamp(ratio,0,1)*100}%"></em></i></div>`).join('');
 $('machineBrief').innerHTML='<span class="skill-name">主砲獨立瞄準</span><div class="skill-chain"><span>WASD 移動</span><b>＋</b><strong>滑鼠瞄準 · 自動開砲</strong></div><small>初始裝甲 25 · 僚機自主迎擊，危急時犧牲攔截。左鍵超頻／右鍵越障躍進／Space 指定位置支援。</small>';
 for(const card of document.querySelectorAll('[data-choice="machine"]')){const cm=GameArenaCore.machines[card.dataset.value];let metrics=card.querySelector('.card-metrics');if(!metrics){metrics=document.createElement('div');metrics.className='card-metrics';card.append(metrics);}metrics.innerHTML=`<span>${cm.hp}<small> HP</small></span><span>${n(cm.interval)}<small> 秒裝填</small></span>`;}
}

function processArenaEvents(){
 for(const e of s.events){
  if(e.type==='mainShot'){muzzle=.14;shotBoost=e.boost||'none';beep('mainShot',{boost:shotBoost});if(motion&&s.machine==='m4a3')shake=Math.max(shake,1.8);}
  else if(e.type==='shot')beep('shot');
  else if(e.type==='impact'){if(e.damage<=0)continue;if(e.shell&&!e.killed&&!hitResponses.some(fx=>fx.id===e.targetId&&fx.age<.09)){hitResponses.push({id:e.targetId,age:0,power:e.ammo==='ap'?1:.8});hitResponses=hitResponses.slice(-12);}metalImpact(e.x,e.y,e.armored);beep(e.ammo==='ap'?'apImpact':'impact',{intensity:.65});}
  else if(e.type==='kill'){const heavy=!['normal','swarm','mine'].includes(e.kind),duration=e.kind==='boss'?3:heavy?1.6:.55;wrecks.push({...e,id:e.sourceId,type:e.kind,recoil:0,walk:0,phase:0,life:duration,duration,burstStage:0});wrecks=wrecks.slice(-30);if(!heavy)blastEffect(e.x,e.y,42);metalImpact(e.x,e.y,false,heavy);}
  else if(e.type==='dashLand'){if(motion){chargerFx.push({arenaLanding:true,x:e.x,y:e.y,age:0});chargerFx=chargerFx.slice(-6);}}
  else if(e.type==='wingSacrifice'){const wing=C.formation({...s,count:e.countBefore}).at(-1);blastEffect(wing.x,wing.y,65,false,.5,true);beep('hurt');ring(s.x,s.y,'#c3e7f0');battleRadio('arena-wing-save','僚機攔截！趁現在躍進脫離。','warning','shin',{priority:5,duration:2.2});}
  else if(e.type==='bossDown'){beep('bossDown');toast('重型目標失能');if(motion)shake=5;}
  else if(e.type==='eliteDown'){beep('eliteDown');if(motion)shake=Math.max(shake,2.4);}
  else if(e.type==='coverImpact'){metalImpact(e.x,e.y,true,e.dead);if(e.dead){blastEffect(e.x,e.y,70,false,.55,true);beep('eliteDown');}else beep('impact',{intensity:.35});}
  else if(e.type==='decoyShock'){ring(e.x,e.y,'#bcece6',true);blastEffect(e.x,e.y,90,true,.4,true);beep('decoy');}
  else if(e.type==='supplyChoice'){battleRadio('arena-supply','補給抵達。靠近即可回收。','status','lena',{priority:1,duration:1.8});}
  else if(e.type==='shieldAbsorb'){ring(e.x,e.y,'#9bc6ee');floating('裝甲吸收 '+Math.ceil(e.amount),e.x,e.y,'#b9d7f3');beep('impact',{intensity:.3});}
  else if(e.type==='emp'){ring(e.x,e.y,'#e9c29c',true);blastEffect(e.x,e.y,e.radius,true,.45,true);beep('decoy');}
  else if(e.type==='hurt'&&e.amount>0){burst(e.x??s.x,e.y??s.y,'#b7d7e0',14);beep('hurt');if(motion){shake=4;flash=.14;}if(s.hp>0&&s.hp<s.maxHp*.35)battleRadio('arena-low-hp','耐久下降。先脫離包圍，回收修復補給。','warning','shin',{priority:4,valid:()=>s.hp>0&&s.hp<s.maxHp*.35});}
  else if(e.type==='bossEnter'){const boss=s.enemies.find(v=>v.type==='boss'&&!v.dead);eventNotice('HEAVY CONTACT',boss?.model==='morpho'?'電磁砲接敵':'重戰車接敵','保持移動 · 射界鎖定後離開',2);beep('bossEnter');}
  else if(e.type==='elite'){if(e.kind==='mine')battleRadio('arena-mine','自走地雷接近。提前擊爆，清出路線。','warning','shin',{priority:3,duration:2});else if(e.kind==='jammer')battleRadio('arena-jammer','阻電機群。僚機索敵受限，主砲擊落來源。','warning','shin',{priority:3,duration:2});else if(e.kind==='scout')battleRadio('arena-scout','斥候正在修正砲擊。先切斷資料鏈。','warning','shin',{priority:3,duration:2});else if(e.kind==='charger')battleRadio('arena-charger','獵兵接近。引它鎖定，再向側面閃開。','warning','shin',{priority:3,duration:1.8});}
  else if(e.type==='warning'||e.type==='attackCue'){if(e.kind==='charger')beep('chargerReady');else if(e.kind==='mortar'||e.kind==='mine')beep('mortarReady');else beep('warning');}
  else if(e.type==='mortarAim')beep('mortarReady');
  else if(e.type==='chargerWindup')beep('chargerReady');
  else if(e.type==='dash')beep('chargerDash');
  else if(e.type==='chargerBrake'||e.type==='stagger'){beep('chargerBrake');burst(e.x,e.y,'#b9b7ad',7);}
  else if(e.type==='blast'||e.type==='mineChain'||e.type==='mineDetonate'){blastEffect(e.x,e.y,e.radius||85,false,.45,true);beep('heBurst');}
  else if(e.type==='mortarImpact'||e.type==='cannon'){if(e.kind==='charge'){beep('chargerDash');continue;}if(e.x!==undefined)blastEffect(e.x,e.y,e.type==='mortarImpact'?(e.r||100):55,e.kind==='support',.5,true);beep(e.kind==='support'?'support':e.kind==='rail'?'rail':e.type==='mortarImpact'?'mortarImpact':'heavyCannon');if(motion)shake=Math.max(shake,2.8);}
  else if(e.type==='tactic'){if(e.kind==='support'){beep('uiConfirm');battleRadio('arena-support','支援砲擊已鎖定指定位置。','status','lena',{priority:2,duration:1.8});}else{ring(e.x,e.y,'#a9e5eb');beep('decoy');}}
  else if(e.type==='ability'){if(e.kind==='burst'){ring(s.x,s.y,'#efd7ab');beep('upgrade');}else if(e.kind==='dash'){beep('chargerDash');}}
  else if(e.type==='item'||e.type==='collect'){rewardFeedback(e);const kind=e.kind||e.item;floating(arenaItemName(kind),e.x??s.x,e.y??s.y,'#bcece6');ring(e.x??s.x,e.y??s.y,'#bcece6');beep('upgrade');}
  else if(e.type==='upgrade'){toast(`火控升級 · LV.${s.level}`);beep('upgrade');}
  else if(e.type==='blade'){metalImpact(e.target?.x??e.x,e.target?.y??e.y,false,true);beep('blade');}
  else if(e.type==='over')end();
 }
}

const arenaShadow=document.createElement('canvas');arenaShadow.width=arenaShadow.height=96;{const c=arenaShadow.getContext('2d'),g=c.createRadialGradient(48,53,1,48,53,48);g.addColorStop(0,'#000a');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,96,96);}
const arenaPoseCache=new Map();
arenaPoseCache.bytes=0;
arenaPoseCache.maxBytes=32*1024*1024;
arenaPoseCache.clear=function(){for(const frame of this.values()){frame.canvas.width=frame.canvas.height=1;}Map.prototype.clear.call(this);this.bytes=0;};

function arenaEnemyPose(index,resolution,pose){
 const key=index+':'+resolution+':'+pose,cached=arenaPoseCache.get(key);
 if(cached){arenaPoseCache.delete(key);arenaPoseCache.set(key,cached);return cached;}
 const img=sprites[index],rig=rigs[index],h=resolution,w=h*img.width/img.height,pad=h*.24,frame=document.createElement('canvas');
 frame.width=Math.ceil(w+pad*2);frame.height=Math.ceil(h+pad*2);const c=frame.getContext('2d'),dead=pose.startsWith('dead'),collapse=dead?Number(pose.slice(4))/3:0,phase=pose==='idle'||dead?0:Number(pose)*Math.PI/8;
 c.translate(frame.width/2,frame.height/2);if(dead)c.filter='saturate(.3) brightness(.6)';
 for(const part of rig){
  if(part.kind==='barrel'&&!dead)continue;
  const leg=['leg','thigh','shin'].includes(part.kind),stride=pose==='idle'||dead?0:Math.sin(phase+(part.order||0)*Math.PI*.8+(part.side<0?0:Math.PI));
  let texture=part.img;for(const level of part.levels)if(level.height>=resolution)texture=level;
  c.save();c.translate((part.px-.5)*w,(part.py-.5)*h+(leg?stride*h*.04-Math.max(0,stride)*h*.065+collapse*h*.035:collapse*h*.02));
  if(leg)c.rotate(stride*.16+collapse*.22*(part.side||1));
  c.drawImage(texture,-part.px*w,-part.py*h,w,h);c.restore();
 }
 const result={canvas:frame,width:frame.width/h,height:frame.height/h,bytes:frame.width*frame.height*4};
 while(arenaPoseCache.size&&arenaPoseCache.bytes+result.bytes>arenaPoseCache.maxBytes){const oldest=arenaPoseCache.keys().next().value;const removed=arenaPoseCache.get(oldest);arenaPoseCache.bytes-=removed.bytes;removed.canvas.width=removed.canvas.height=1;arenaPoseCache.delete(oldest);}
 if(result.bytes<=arenaPoseCache.maxBytes){arenaPoseCache.set(key,result);arenaPoseCache.bytes+=result.bytes;}
 return result;
}

function drawArenaUnit(entity,index,size,allied=false,dead=false){
 const p=point(entity.x,entity.y),img=sprites[index];if(!img)return;
 const rig=rigs[index],locked=entity.type==='charger'&&['windup','dash'].includes(entity.phase)?Math.atan2(entity.lockedY-entity.y,entity.lockedX-entity.x):entity.angle,heading=arenaDirection(locked??-Math.PI/2),bodyHeading=rig?.some(part=>part.kind==='barrel')?arenaDirection(entity.moveAngle??locked??-Math.PI/2):heading,h=size,w=h*img.width/img.height,walk=(entity.walk||0)*1.6,moving=!dead&&(entity.moving??(entity.speed>0&&!entity.charging&&!entity.stagger&&entity.phase!=='windup'));
 ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha*=dead?clamp(entity.life/.65,0,1):1;
 const jump=allied&&entity.main&&s.dash?Math.sin(Math.PI*clamp(s.dash.elapsed/s.dash.duration,0,1)):0,lift=motion?jump*h*.42:0;
 ctx.save();ctx.globalAlpha*=1-jump*.25;ctx.drawImage(arenaShadow,-h*(.5-jump*.06),-h*.275,h*(1-jump*.12),h*.55);ctx.restore();ctx.translate(0,-lift);
 const orientation=allied?Math.PI/2:-Math.PI/2;ctx.rotate(bodyHeading+orientation);
 if(rig&&!allied){
  const resolution=entity.type==='boss'?384:['artillery','charger'].includes(entity.type)?192:(devicePixelRatio||1)>1?128:96,pose=dead?'dead'+Math.min(3,Math.floor(clamp(1-entity.life/entity.duration,0,1)*4)):moving?String((Math.floor(walk/(Math.PI*2)*16)%16+16)%16):'idle',frame=arenaEnemyPose(index,resolution,pose);
  ctx.save();if(entity.flash>0&&!dead)ctx.filter='brightness(1.55)';ctx.drawImage(frame.canvas,-frame.width*h/2,-frame.height*h/2,frame.width*h,frame.height*h);ctx.restore();
  const reaction=!dead&&hitResponses.findLast(fx=>fx.id===entity.id),shot=!dead&&s.hazards.find(h=>h.source===entity.id&&h.geometry==='beam'&&h.kind!=='charge'&&h.fired&&h.life>0),hitKick=reaction?(reaction.age<.025?reaction.age/.025:Math.max(0,1-(reaction.age-.025)/.135)**2)*3*reaction.power:0,shotKick=shot?Math.min(10,h*.04)*clamp(shot.life/.24,0,1)**2:0;
  if(!dead)for(const part of rig){if(part.kind!=='barrel')continue;let texture=part.img;for(const level of part.levels)if(level.height>=h*Math.min(devicePixelRatio||1,2))texture=level;ctx.save();ctx.rotate(heading-bodyHeading);ctx.translate((part.px-.5)*w,(part.py-.5)*h-(motion?Math.max(hitKick,shotKick):0));if(!motion&&(reaction&&reaction.age<.08||shot))ctx.filter='brightness(1.25)';ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);ctx.restore();}
 }else if(rig){
  if(dead)ctx.filter='saturate(.3) brightness(.6)';else if(entity.flash>0)ctx.filter='brightness(1.55)';
  for(const part of rig){
   let texture=part.img;for(const level of part.levels)if(level.height>=h*Math.min(devicePixelRatio||1,2))texture=level;
   const stride=moving?Math.sin(walk+(part.order||0)*Math.PI*.8+(part.side<0?0:Math.PI)):0,leg=['leg','thigh','shin'].includes(part.kind),kick=part.kind==='barrel'?(entity.recoil||0)*h*.055:0;
   ctx.save();if(part.kind==='barrel')ctx.rotate(heading-bodyHeading);ctx.translate((part.px-.5)*w,(part.py-.5)*h+kick+(leg?stride*h*.04-Math.max(0,stride)*h*.065:0));if(leg)ctx.rotate(stride*.16);if(dead&&leg)ctx.rotate((1-entity.life/entity.duration)*.13*(part.side||1));ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);ctx.restore();
  }
 }else ctx.drawImage(img,-w/2,-h/2,w,h);
 ctx.restore();
 if(allied&&entity.main&&muzzle>0&&state==='playing'){
  const length=h*.55,tip={x:p.x+Math.cos(heading)*length,y:p.y-lift+Math.sin(heading)*length};ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(heading);ctx.globalCompositeOperation='screen';ctx.globalAlpha=muzzle/.14;const light=ctx.createRadialGradient(6,0,0,6,0,22);light.addColorStop(0,'#fff7df');light.addColorStop(.25,'#efd296cc');light.addColorStop(1,'#d4ae5b00');ctx.fillStyle=light;ctx.fillRect(-16,-22,44,44);line({x:0,y:0},{x:20,y:0},'#fff5dd',3);ctx.restore();
 }
}

function drawArenaObstacle(o){
 const p=point(o.x,o.y),w=o.w*W*.00086,h=o.h*H*.00084,x=p.x-w/2,y=p.y-h/2,cut=Math.min(9,w*.1,h*.2),health=clamp(o.hp/o.max,0,1);
 ctx.save();
 if(o.dead){
  ctx.fillStyle='#11151ba6';ctx.beginPath();ctx.ellipse(p.x,p.y,w*.62,h*.75,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<7;i++){const dx=Math.sin(i*7.3+o.x)*w*.43,dy=Math.cos(i*4.8+o.y)*h*.42;polygon([{x:p.x+dx-6,y:p.y+dy},{x:p.x+dx,y:p.y+dy-4},{x:p.x+dx+9,y:p.y+dy+3},{x:p.x+dx+3,y:p.y+dy+6}],i%2?'#494c49':'#363b3b');}
  ctx.restore();return;
 }
 ctx.shadowColor='#000c';ctx.shadowBlur=12;ctx.shadowOffsetY=7;
 polygon([{x:x+cut,y},{x:x+w-cut,y},{x:x+w,y:y+cut},{x:x+w,y:y+h-cut},{x:x+w-cut,y:y+h},{x:x+cut,y:y+h},{x,y:y+h-cut},{x,y:y+cut}],'#454d4c');ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 ctx.save();ctx.clip();if(road.complete&&road.naturalWidth){ctx.globalAlpha=.28;ctx.drawImage(road,road.width*.4,road.height*.55,road.width*.2,road.height*.12,x,y,w,h);}ctx.restore();
 const plate=ctx.createLinearGradient(x,y,x,y+h);plate.addColorStop(0,'#74817b99');plate.addColorStop(.4,'#424c49aa');plate.addColorStop(1,'#1b2626dd');
 polygon([{x:x+cut,y:y+3},{x:x+w-cut,y:y+3},{x:x+w-4,y:y+cut},{x:x+w-4,y:y+h-7},{x:x+4,y:y+h-7},{x:x+4,y:y+cut}],plate);
 line({x:x+cut,y:y+3},{x:x+w-cut,y:y+3},'#a6ada080',2);line({x:x+5,y:y+h-5},{x:x+w-5,y:y+h-5},'#0c171c',4);
 for(const side of [-1,1]){const rib=p.x+side*w*.29;line({x:rib,y:y+6},{x:rib,y:y+h-9},'#182527',5);line({x:rib-1,y:y+6},{x:rib-1,y:y+h-9},'#89928766',1);}
 for(let i=0;i<3;i++)line({x:p.x-9+i*7,y:y+h-8},{x:p.x-5+i*7,y:y+h-14},'#b9a77a99',3);
 if(health<.85){line({x:p.x-w*.2,y:y+4},{x:p.x-w*.08,y:p.y},'#12191b',2);line({x:p.x-w*.08,y:p.y},{x:p.x-w*.17,y:y+h-6},'#12191b',2);rounded(p.x-18,y-6,36,2,1,'#17232a');rounded(p.x-18,y-6,36*health,2,1,'#b6aa8e');}
 if(o.flash>0){ctx.globalAlpha=.3;rounded(x+3,y+3,w-6,h-6,cut,'#e4c5a1');}ctx.restore();
}

function arenaItemName(kind){return {shield:'裝甲補充',recruit:'僚機增援',emp:'區域壓制'}[kind]||itemNames[kind]||'補給';}
function drawArenaSupplies(){
 const effects={repair:'耐久 +30',shield:'裝甲 +35',recruit:'僚機 +1',charge:'戰術 +1',weapon:s.level>=8?'火力全開 5秒':'火控 +1',ap:'穿甲彈',he:'榴彈',overdrive:'急速 7 秒',emp:'區域壓制'};
 for(const box of s.crates){if(box.used)continue;const p=point(box.x,box.y),col=({repair:'#b8ddba',shield:'#9bc6ee',recruit:'#d5ddb6',charge:'#add6e5',weapon:'#ecdcae',ap:'#e0c39b',he:'#e7ac8b',overdrive:'#c5b5e2',emp:'#e8b8a6'}[box.kind]||'#c4d6de');
  ctx.save();ctx.globalAlpha=box.life<3?.75:1;ctx.fillStyle='#020b1277';ctx.beginPath();ctx.ellipse(p.x,p.y+5,18,6,0,0,Math.PI*2);ctx.fill();drawSupplyArt(box.kind,p.x,p.y-12,33);line({x:p.x-10,y:p.y+6},{x:p.x+10,y:p.y+6},col,2);label(effects[box.kind]||arenaItemName(box.kind),p.x,p.y+22,10,col,600);ctx.restore();
 }
}

function drawArenaDash(){
 const dash=s.dash;if(!dash||s.hp<=0)return;const p=point(s.x,s.y),from=point(dash.fromX,dash.fromY),dx=p.x-from.x,dy=p.y-from.y,length=Math.hypot(dx,dy);if(length<1)return;
 const nx=-dy/length,ny=dx/length,fade=clamp(dash.remaining/dash.duration,0,1),base=clamp(H*.115,46,79),tail={x:p.x-dx*Math.min(1,base*1.5/length),y:p.y-dy*Math.min(1,base*1.5/length)};
 ctx.save();ctx.globalAlpha=motion?.3+.3*fade:.4;const trail=ctx.createLinearGradient(tail.x,tail.y,p.x,p.y);trail.addColorStop(0,'#9fbec900');trail.addColorStop(1,'#bedbde');for(const side of [-1,1])line({x:tail.x+nx*base*.22*side,y:tail.y+ny*base*.22*side},{x:p.x+nx*base*.22*side,y:p.y+ny*base*.22*side},trail,3);
 const smoke=smokeArt.whitePuff14;if(smoke?.naturalWidth){ctx.globalAlpha=.18;ctx.drawImage(smoke,tail.x-base*.3,tail.y-base*.12,base*.6,base*.24);}ctx.restore();
}

function drawArenaEnemyState(e,size){
 const p=point(e.x,e.y),boss=e.type==='boss',open=e.exposed>0;let pending=null,firing=null;
 if(['jammer','swarm'].includes(e.type)){const radius=e.jamRadius||180;ctx.save();ctx.globalAlpha=.24;ctx.strokeStyle='#cbbfe3';ctx.lineWidth=1.2;ctx.setLineDash([9,16]);ctx.beginPath();ctx.ellipse(p.x,p.y,radius*W*.00086,radius*H*.00084,0,0,Math.PI*2);ctx.stroke();ctx.restore();return;}
 if(e.type==='mine'&&e.phase==='windup'){const r=97,progress=clamp(1-e.windup/.6,0,1);ctx.save();ctx.globalAlpha=.8;ctx.strokeStyle='#ecaa8f';ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(p.x,p.y,r*W*.00086,r*H*.00084,0,0,Math.PI*2);ctx.stroke();ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y,r*.82*W*.00086,r*.82*H*.00084,0,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();ctx.restore();return;}
 if(e.type==='scout')for(const h of s.hazards){if(h.linkedTo!==e.id||h.fired)continue;const source=s.enemies.find(n=>n.id===h.source&&!n.dead);if(source){ctx.save();ctx.globalAlpha=.5;ctx.setLineDash([3,7]);line(p,point(source.x,source.y),'#d8bf8e',1.5);ctx.restore();}}

 for(const h of s.hazards){if(h.source!==e.id)continue;if(!h.fired&&(!pending||h.delay<pending.delay))pending=h;else if(h.fired&&h.geometry==='beam'&&h.life>0&&(!firing||h.life>firing.life))firing=h;}
 const charging=!!pending,heading=pending?.geometry==='beam'?Math.atan2((pending.toY-pending.fromY)*H*.00084,(pending.toX-pending.fromX)*W*.00086):firing?.geometry==='beam'?Math.atan2((firing.toY-firing.fromY)*H*.00084,(firing.toX-firing.fromX)*W*.00086):arenaDirection(e.angle??0),progress=pending?clamp(1-pending.delay/pending.maxDelay,0,1):0;
 ctx.save();ctx.translate(p.x,p.y);ctx.rotate(heading);
 if(charging&&e.type!=='charger'){
  ctx.globalCompositeOperation='screen';const color=pending.kind==='rail'?'#c4dce9':'#ecd1a6',tip=size*.48,r=size*(.022+progress*.045),glow=ctx.createRadialGradient(tip,0,0,tip,0,r*2);glow.addColorStop(0,color);glow.addColorStop(.3,color+'aa');glow.addColorStop(1,color+'00');ctx.fillStyle=glow;ctx.globalAlpha=.35+progress*.5;ctx.fillRect(tip-r*2,-r*2,r*4,r*4);
  for(let i=0;i<4;i++){ctx.globalAlpha=progress>(i+1)/5?.7:.14;for(const side of [-1,1])line({x:size*(.05+i*.075),y:side*size*.027},{x:size*(.075+i*.075),y:side*size*.027},color,Math.max(1.5,size*.009));}
 }
 if(firing){
  const fade=clamp(firing.life/.24,0,1),tip=size*.48,length=size*.32*(motion?.55+fade*.45:1),width=size*.055;ctx.globalCompositeOperation='screen';ctx.globalAlpha=motion?fade:.7;
  const flame=ctx.createLinearGradient(tip,0,tip+length,0);flame.addColorStop(0,'#fff3d9');flame.addColorStop(.25,firing.kind==='rail'?'#b7d8eeaa':'#e3b47aaa');flame.addColorStop(1,'#d6bb9100');polygon([{x:tip,y:-width},{x:tip+length*.65,y:-width*.45},{x:tip+length,y:0},{x:tip+length*.65,y:width*.45},{x:tip,y:width}],flame);
 }
 ctx.globalCompositeOperation='source-over';
 if(open){
  const release=clamp(e.exposed/2,0,1),opening=motion?clamp((2-e.exposed)/.12,0,1):1,travel=motion?(1-release)*size*.12:0;ctx.globalAlpha=.75*opening;
  for(const side of [-1,1])for(let i=0;i<3;i++){const x=size*(-.12+i*.07),y=side*size*.10;line({x,y},{x:x-size*.045,y:y+side*size*.05},'#142125',5);line({x,y},{x:x-size*.045,y:y+side*size*.05},'#edcb99',2);}
  const steam=smokeArt.whitePuff03;if(steam?.naturalWidth){ctx.globalAlpha=.24*release*opening;for(const side of [-1,1])ctx.drawImage(steam,-size*.2-travel,side*size*.16-size*.09,size*.3+travel,size*.18);}
 }
 if(e.type==='charger'&&(e.phase==='dash'||pending&&e.phase==='windup')){
  const dust=smokeArt.whitePuff14;ctx.globalAlpha=e.phase==='dash'?.28:.12;if(dust?.naturalWidth)for(const side of [-1,1])ctx.drawImage(dust,-size*.62,side*size*.24-size*.09,size*.4,size*.18);
  if(e.phase==='windup'){ctx.globalAlpha=.4+progress*.4;for(const side of [-1,1])line({x:size*.17,y:side*size*.22},{x:size*.3,y:side*size*.13},'#dfb598',2);}
 }
 ctx.restore();
 if(open)label('散熱開放 · 傷害 ×1.6',p.x,p.y-size*.5-10,boss?11:10,'#e8d4b1',600);
 else if(e.phase==='stagger')label('重新定位',p.x,p.y-size*.5-10,10,'#b0b9b8',600);
}

function drawArenaHazard(hazard){
 if(hazard.kind==='charge'&&hazard.fired)return;
 const pending=!hazard.fired,progress=pending?clamp(1-hazard.delay/hazard.maxDelay,0,1):1,color=hazard.kind==='support'?'#a7d9d0':hazard.kind==='rail'?'#b6c9df':'#d6ac89';
 ctx.save();
 if(hazard.geometry==='beam'){
  const from=point(hazard.fromX,hazard.fromY),to=point(hazard.toX,hazard.toY),dx=hazard.toX-hazard.fromX,dy=hazard.toY-hazard.fromY,length=Math.hypot(dx,dy)||1,nx=-dy/length*hazard.width/2,ny=dx/length*hazard.width/2,edges=[point(hazard.fromX+nx,hazard.fromY+ny),point(hazard.toX+nx,hazard.toY+ny),point(hazard.toX-nx,hazard.toY-ny),point(hazard.fromX-nx,hazard.fromY-ny)];
  polygon(edges,color+(pending?'15':'35'));for(const side of [-1,1])line(point(hazard.fromX+nx*side,hazard.fromY+ny*side),point(hazard.toX+nx*side,hazard.toY+ny*side),color,pending?1.3:1.7);
  ctx.save();ctx.beginPath();edges.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  if(pending){
   if(hazard.kind==='charge'){
    for(let i=1;i<=4;i++){const f=i/5,x=hazard.fromX+dx*f,y=hazard.fromY+dy*f,back=18+(1-progress)*9;ctx.globalAlpha=progress>=f?.85:.28;line(point(x-dx/length*back+nx*.56,y-dy/length*back+ny*.56),point(x,y),color,2);line(point(x-dx/length*back-nx*.56,y-dy/length*back-ny*.56),point(x,y),color,2);}
   }else{
    ctx.globalAlpha=.25+progress*.4;const f=1-progress,x=hazard.fromX+dx*f,y=hazard.fromY+dy*f;line(point(x+nx*.85,y+ny*.85),point(x-nx*.85,y-ny*.85),color,3);ctx.setLineDash([3,10]);line(from,to,color,1);ctx.setLineDash([]);
   }
  }else{
   const fade=motion?clamp(hazard.life/.24,0,1):.7,screenWidth=Math.hypot(edges[0].x-edges[3].x,edges[0].y-edges[3].y),beam=ctx.createLinearGradient(from.x,from.y,to.x,to.y);beam.addColorStop(0,'#e5eff4');beam.addColorStop(.35,color);beam.addColorStop(1,color+'70');ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade*.65;line(from,to,beam,Math.max(3,screenWidth*.65));ctx.globalAlpha=fade;line(from,to,'#f7efdf',Math.max(1.5,screenWidth*.16));
  }ctx.restore();
 }else{
  const center=point(hazard.x,hazard.y),rx=hazard.r*W*.00086,ry=hazard.r*H*.00084;
  ctx.fillStyle=color+'10';ctx.beginPath();ctx.ellipse(center.x,center.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.stroke();
  if(pending){
   const inner=.08+.82*(1-progress);ctx.globalAlpha=.45;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(center.x,center.y,rx*inner,ry*inner,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.9;
   for(let i=0;i<4;i++){const angle=i*Math.PI/2;line({x:center.x+Math.cos(angle)*rx*.78,y:center.y+Math.sin(angle)*ry*.78},{x:center.x+Math.cos(angle)*rx*.94,y:center.y+Math.sin(angle)*ry*.94},color,2);}
   if(progress>.7){const height=motion?(1-progress)/.3*Math.min(100,ry*2):Math.min(22,ry*.5),tip={x:center.x,y:center.y-height};line({x:tip.x-4,y:tip.y-17},tip,color+'77',4);line({x:tip.x-1,y:tip.y-8},tip,'#f0d6ab',2.5);}
  }else{
   const fade=clamp(hazard.life/.3,0,1);ctx.globalAlpha=fade*.6;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(center.x,center.y,rx*(motion?1-fade*.55:.8),ry*(motion?1-fade*.55:.8),0,0,Math.PI*2);ctx.stroke();
  }
 }ctx.restore();
}

function drawArenaScene(){
 
 const a=point(55,90),b=point(945,940);ctx.save();ctx.strokeStyle='#91bdc126';ctx.setLineDash([6,14]);ctx.lineWidth=1;ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();
 for(const obstacle of s.obstacles||[])drawArenaObstacle(obstacle);
 for(const hazard of s.hazards)drawArenaHazard(hazard);
 drawArenaSupplies();
 const base=clamp(H*.115,46,79),objects=[...wrecks.map(e=>({entity:e,dead:true})),...s.enemies.filter(e=>!e.dead).map(entity=>({entity}))];
 for(const {entity:e,dead} of objects.sort((a,b)=>a.entity.y-b.entity.y)){const type=e.type||e.kind,visual=enemyVisual(type,e.model),size=base*(type==='boss'?(e.model==='morpho'?3.5:3.2):type==='artillery'?1.5:type==='charger'?1.35:type==='shield'?1.65:type==='scout'?.95:type==='mine'?.55:.62);if(['jammer','swarm'].includes(type))drawJammer(e,dead?1-e.life/e.duration:0);else drawArenaUnit(e,visual.index,size,false,dead);if(!dead&&type!=='normal')drawArenaEnemyState(e,size);if(!dead&&e.flash>0){const p=point(e.x,e.y);rounded(p.x-18,p.y-size*.6,36,2,1,'#172a34');rounded(p.x-18,p.y-size*.6,36*clamp(e.hp/e.max,0,1),2,1,'#dab99f');}}
 if(s.decoy){const p=point(s.decoy.x,s.decoy.y);ctx.save();ctx.globalAlpha=.65;ctx.setLineDash([4,4]);ctx.strokeStyle='#abd9df';ctx.beginPath();ctx.arc(p.x,p.y,18,0,Math.PI*2);ctx.stroke();ctx.restore();}
 drawArenaDash();
 for(const unit of (s.hp>0?C.formation(s):[{x:s.x,y:s.y,main:true,life:Math.max(0,phaseTime),duration:phaseDuration}])){let near=null,nearDistance=s.enemies.some(e=>!e.dead&&e.jamRadius&&Math.hypot(e.x-unit.x,e.y-unit.y)<=e.jamRadius)?110*110:280*280;if(!unit.main)for(const enemy of s.enemies){if(enemy.dead)continue;const distance=(enemy.x-unit.x)**2+(enemy.y-unit.y)**2;if(distance<nearDistance){near=enemy;nearDistance=distance;}}const unitAngle=near?Math.atan2(near.y-unit.y,near.x-unit.x):unit.angle??s.angle;const machineIndex=s.machine==='m4a3'?6:s.machine==='xm2'?7:0;drawArenaUnit({...unit,angle:unitAngle,moveAngle:unit.main?s.moveAngle:unitAngle,walk:s.walk,moving:s.moving,recoil:unit.main?muzzle/.14:0},machineIndex,base*(unit.main?1:.67),true,s.hp<=0);}
 for(const bullet of s.bullets){const p=point(bullet.x,bullet.y),tail=point(bullet.x-bullet.vx*.024,bullet.y-bullet.vy*.024);line(tail,p,bullet.enemy?'#e9a980':bullet.shell?'#f3e0b5':'#b8dce2',bullet.shell?2.6:1.2);}
 if(s.hp>0){const p=point(s.x,s.y);ctx.save();ctx.strokeStyle='#c0eeee';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();ctx.restore();rounded(p.x-26,p.y+base*.57,52,3,1,'#15242c');rounded(p.x-26,p.y+base*.57,52*clamp(s.hp/s.maxHp,0,1),3,1,s.hp<s.maxHp*.35?'#e8a38c':'#b6ddd1');if(s.shield>0)rounded(p.x-26,p.y+base*.57+5,52*clamp(s.shield/s.maxHp,0,1),2,1,'#9acced');}
}

function drawArenaReticle(){
 if(state!=='playing'||s.over)return;const aim=point(s.aimX,s.aimY),player=point(s.x,s.y);ctx.save();ctx.globalAlpha=.2;ctx.setLineDash([2,9]);line(player,aim,'#b7dedc',1);ctx.setLineDash([]);ctx.globalAlpha=.9;
 for(const axis of [0,Math.PI/2,Math.PI,Math.PI*1.5])line({x:aim.x+Math.cos(axis)*8,y:aim.y+Math.sin(axis)*8},{x:aim.x+Math.cos(axis)*14,y:aim.y+Math.sin(axis)*14},'#d6eeea',1.5);
 ctx.strokeStyle='#d6eeea';ctx.lineWidth=1;ctx.beginPath();ctx.arc(aim.x,aim.y,4,0,Math.PI*2);ctx.stroke();ctx.restore();
}

function drawArenaPlayerMarker(){
 if(!s.arena||s.hp<=0||!['playing','paused'].includes(state))return;
 const p=point(s.x,s.y),base=clamp(H*.115,46,79),w=base*.55,h=base*.39,len=base*.17;
 ctx.save();ctx.globalAlpha=.95;
 for(const [color,width] of [['#07141eee',5],['#c9fcf3',2]])for(const sx of [-1,1])for(const sy of [-1,1]){const x=p.x+sx*w,y=p.y+sy*h;line({x:x-sx*len,y},{x,y},color,width);line({x,y},{x,y:y-sy*len},color,width);}
 const angle=arenaDirection(s.angle),dx=Math.cos(angle),dy=Math.sin(angle),tip={x:p.x+dx*base*.72,y:p.y+dy*base*.72};polygon([{x:tip.x+dx*6,y:tip.y+dy*6},{x:tip.x-dx*4-dy*4,y:tip.y-dy*4+dx*4},{x:tip.x-dx*4+dy*4,y:tip.y-dy*4-dx*4}],'#d6fff5','#07141e');
 ctx.restore();
}
function drawArenaLanding(){
 const dust=smokeArt.whitePuff14;if(!motion||!dust?.naturalWidth)return;
 for(const fx of chargerFx){if(!fx.arenaLanding||fx.age>.18)continue;const p=point(fx.x,fx.y),f=fx.age/.18;ctx.save();ctx.globalAlpha=(1-f)*.23;for(const side of [-1,1])ctx.drawImage(dust,p.x+side*(18+f*14)-22,p.y-9,44,22);ctx.restore();}
}

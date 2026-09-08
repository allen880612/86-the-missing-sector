'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
let C=GameCore,audioActivated=false;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let W=900,H=800,state='ready',s=C.create(),previous=0,keys=new Set(),drag=false,sound=true,music=true,toastTimer,warningTimer;
let radioCooldown={},activeRadio=null,battleMusicScene='battle';
let fireLinkFx=[],ammoBursts=[],jamPulse=null,armorBreaks=[],hitResponses=[],chargerFx=[];
const smokeArt={};for(const name of ['blackSmoke05','blackSmoke15','whitePuff03','whitePuff14']){const image=new Image();image.src='assets/vfx/kenney-smoke/'+name+'.png';smokeArt[name]=image;}
let bladeFx=[],shotBoost='none',bracePulse=0;
let shellBursts=[],supportFx=[],railBursts=[],explosions=[],explosionFrames=[],effectsClock=0,lastExplosion=-1;
let phaseTime=0,phaseDuration=1.4,pausedFrom='playing',runConfig=null,runResult=null,eventTime=0;
let turretSprite=null,turretLevels=[],jammerLevels=[],supplySprites={},rewardFx=[],supplyGhosts=[],unitPreviews={};
let sprites=[],rigs=[],wrecks=[],traces=[],assetReady=false,shake=0,flash=0,muzzle=0,danger=0,particles=[],texts=[],rings=[],impacts=[],lastHud=0;
let motion=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand=(a,b)=>a+Math.random()*(b-a);
const weaponNames=['57mm 滑膛砲','強化裝藥','同軸機槍','穿甲彈芯','破片榴彈','快速裝填','砲架調校','複合彈藥','火力極限'];
const itemNames={weapon:'火控升級',emp:'支援砲擊',overdrive:'急速裝填',ap:'穿甲彈',he:'榴彈',charge:'戰術補充',shield:'裝甲整備',repair:'主機修復',recruit:'僚機回收'};
const itemDetails={ap:'直擊 ×1.4／裝填變慢',he:'爆區擴大／重甲減傷',charge:'攜帶戰術 +1 · 上限 2',weapon:'提升主砲與機槍',emp:'全域壓制／中斷蓄力',overdrive:'射速提升 · 7 秒',shield:'裝甲 +35',repair:'耐久 +30',recruit:'僚機 +1 · 編隊上限 4'};
for(let i=0;i<32;i++){const frame=new Image();frame.onload=()=>{const layer=document.createElement('canvas');layer.width=frame.naturalWidth;layer.height=frame.naturalHeight;const c=layer.getContext('2d');c.drawImage(frame,0,0);const pixels=c.getImageData(0,0,layer.width,layer.height),data=pixels.data;for(let p=0;p<data.length;p+=4){const brightness=Math.max(data[p],data[p+1],data[p+2]);if(brightness){data[p]=data[p]*255/brightness;data[p+1]=data[p+1]*255/brightness;data[p+2]=data[p+2]*255/brightness;}data[p+3]=data[p+3]*brightness/255;}c.putImageData(pixels,0,0);frame.blendLayer=layer;};frame.src='assets/vfx/lava-blast/'+String(60+i*2).padStart(6,'0')+'.png';explosionFrames.push(frame);}
const uiIcons={},itemIcons={ap:'target',he:'bomb',charge:'zap',weapon:'crosshair',shield:'shield',repair:'wrench',recruit:'users',emp:'radar',overdrive:'chevrons-up'};
for(const name of new Set(Object.values(itemIcons))){fetch('assets/ui/icons/'+name+'.svg').then(r=>{if(!r.ok)throw new Error(r.status);return r.text();}).then(svg=>{const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.replaceAll('currentColor','#c8dce4'));uiIcons[name]=img;}).catch(()=>{});}
const road=new Image();road.src='assets/ruined-road-86.png';
const atlas=new Image();
atlas.onload=()=>{
 try{
  const layer=document.createElement('canvas');layer.width=atlas.width;layer.height=atlas.height;
  const l=layer.getContext('2d',{willReadFrequently:true});l.drawImage(atlas,0,0);
  const pixels=l.getImageData(0,0,layer.width,layer.height),data=pixels.data;
  for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2],excess=g-Math.max(r,b);if(g>90&&excess>35){data[i+3]=Math.round(255*(1-clamp((excess-35)/65,0,1)));data[i+1]=Math.min(g,Math.max(r,b)+22);}}
  l.putImageData(pixels,0,0);
  for(let index=0;index<6;index++){
   const cw=layer.width/3,ch=layer.height/2,x0=index%3*cw,y0=Math.floor(index/3)*ch;
   let minX=cw,minY=ch,maxX=0,maxY=0,component=0,largest=0,largestSize=0;
   const membership=new Int32Array(cw*ch),queue=new Int32Array(cw*ch);
   for(let seed=0;seed<cw*ch;seed++){
    if(membership[seed]||data[((Math.floor(seed/cw)+y0)*layer.width+seed%cw+x0)*4+3]<=30)continue;
    component++;let head=0,tail=1;queue[0]=seed;membership[seed]=component;
    while(head<tail){const cell=queue[head++],x=cell%cw,y=Math.floor(cell/cw);
     for(const next of [x>0?cell-1:-1,x<cw-1?cell+1:-1,y>0?cell-cw:-1,y<ch-1?cell+cw:-1]){
      if(next<0||membership[next]||data[((Math.floor(next/cw)+y0)*layer.width+next%cw+x0)*4+3]<=30)continue;
      membership[next]=component;queue[tail++]=next;
     }
    }
    if(tail>largestSize){largestSize=tail;largest=component;}
   }
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
    if(membership[y*cw+x]===largest){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    else data[((y+y0)*layer.width+x+x0)*4+3]=0;
   }
   l.putImageData(pixels,0,0,x0,y0,cw,ch);
   const item=document.createElement('canvas');item.width=maxX-minX+3;item.height=maxY-minY+3;
   item.getContext('2d').drawImage(layer,x0+minX,y0+minY,maxX-minX+1,maxY-minY+1,1,1,maxX-minX+1,maxY-minY+1);sprites.push(item);
  }
  rigs=sprites.map((img,index)=>makeRig(img,index));assetReady=true;$('start').disabled=false;$('assetstatus').textContent='作戰裝備就緒';updateUnitPreviews();loadProductionAtlas();loadSpecialists();loadSpecialists('assets/legion-v34.png',2,13);
 }catch{$('assetstatus').textContent='機型素材讀取失敗，請重新整理後再試';}
};
atlas.onerror=()=>{$('assetstatus').textContent='素材載入失敗，重新整理可再試';};
atlas.src=window.UNIT_ATLAS||'assets/units-86.png';
function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
new ResizeObserver(resize).observe(canvas);
function point(x,y){if(s.arena)return arenaPoint(x,y);const scale=.48+.52*y/1000;return {x:W/2+(x-500)*W*.00077*scale,y:H*(.10+y*.00080),scale};}
function polygon(points,color,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function line(a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
function label(str,x,y,size,color='#fff',weight=700){ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, "PingFang TC", sans-serif`;ctx.textAlign='center';ctx.fillText(str,x,y);}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function refreshBattleRadio(){if(activeRadio&&(s.time>=activeRadio.until||activeRadio.valid&&!activeRadio.valid())){window.FrontlineUI?.clearRadio();activeRadio=null;}}
function battleRadio(key,message,type='status',character='shin',options={}){
 if(state!=='playing'||s.over)return false;refreshBattleRadio();if(options.valid&&!options.valid()||(radioCooldown[key]??-Infinity)+8>s.time)return false;
 const duration=options.duration??2.4;if(!window.FrontlineUI?.radioMessage(character,message,type,{...options,key,managed:true,duration}))return false;
 radioCooldown[key]=s.time;activeRadio={until:s.time+duration,valid:options.valid};return true;
}
function coreRadio(boss){
 if(s.arena)return;
 if(state!=='playing'||s.over||!boss||boss.dead||boss.exposed<=0)return;
 const threats=s.hazards.filter(h=>h.source===boss.id&&(!h.fired||h.lethal&&h.life>0));
 if(threats.length){battleRadio('remaining-'+boss.id+'-'+boss.attackCount+'-'+boss.nodes.join('-'),threats.some(h=>h.kind==='sweep')?'電磁射界仍在。留在安全缺口。':'仍有射線鎖定。先移出射界。','warning','shin',{priority:5,duration:2.4,valid:()=>!boss.dead&&threats.some(h=>s.hazards.includes(h)&&(!h.fired||h.lethal&&h.life>0))});return;}
 battleRadio('core-'+boss.id+'-'+boss.attackCount+'-'+boss.nodes.filter(hp=>hp>0).length,'核心已開放。對準主體，集中砲火。','status','shin',{priority:3,duration:Math.min(2.4,boss.exposed),valid:()=>!boss.dead&&s.enemies.includes(boss)&&boss.exposed>0});
}
function beep(kind,detail={}){window.FrontlineAudio?.effect(kind==='hit'?'hurt':kind,{machine:s.machine,...detail});}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2100);}
function warning(message){$('warning').textContent=message;$('warning').classList.add('show');clearTimeout(warningTimer);warningTimer=setTimeout(()=>$('warning').classList.remove('show'),2300);}
function blastEffect(x,y,size=70,heavy=false,duration=heavy?1.35:size<=50?.45:.72,priority=false){if(!explosionFrames[0]?.complete)return;if(!heavy&&!priority&&effectsClock-lastExplosion<.06)return;lastExplosion=effectsClock;explosions.push({x,y,size,age:0,duration,heavy});if(explosions.length>16)explosions.shift();}
function burst(x,y,color,amount=12,large=false){for(let i=0;i<amount;i++)particles.push({x,y,vx:rand(-140,140)*(large?2:1),vy:rand(-180,90),life:rand(.2,.75),max:.75,color,r:rand(1.5,large?7:4),spark:i%3===0});if(particles.length>500)particles.splice(0,particles.length-500);}
function metalImpact(x,y,armored=false,broken=false){
 const life=broken?.22:armored?.11:.085;impacts.push({x,y,life,max:life,style:broken?'fracture':armored?'ricochet':'contact',color:armored?'#c1d9e4':'#ffe0a6'});
 const count=broken?9:armored?5:6;
 for(let i=0;i<count;i++){const angle=armored?-.7+rand(-.35,.35):rand(-Math.PI,Math.PI),speed=rand(broken?130:70,broken?340:230),duration=broken?rand(.3,.6):rand(.10,.19);particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:duration,max:duration,color:armored?'#c2d7e2':broken&&i%2?'#74868e':'#efd1a0',r:broken?rand(3,7):2,spark:!broken||i%2===0,shard:broken&&i%2===1,rotation:angle,spin:rand(-7,7)});}
}
function ring(x,y,color,large=false){rings.push({x,y,color,life:large?.7:.38,max:large?.7:.38,size:large?160:60});}
function floating(str,x,y,color){texts.push({str,x,y,color,life:1});}
function processEvents(previousCrates=[]){
 if(s.arena){processArenaEvents();return;}
 const itemEvents=s.events.filter(e=>e.type==='item'),firedRails=new Set();
 for(const e of s.events){
  if(e.type==='shot'){beep('shot');}
  else if(e.type==='mainShot'){muzzle=.14;shotBoost=e.boost||'none';beep('mainShot',{boost:shotBoost});if(s.machine==='m4a3'&&motion)shake=Math.max(shake,shotBoost==='brace'?2.4:1.3);}
  else if(e.type==='braceReady'){bracePulse=.3;beep('braceReady');}
  else if(e.type==='kill'){const heavy=!['normal','swarm','mine'].includes(e.kind),duration=e.kind==='boss'?3:heavy?1.6:.55;wrecks.push({...e,id:e.sourceId,type:e.kind,recoil:0,walk:0,phase:0,life:duration,duration,burstStage:0});if(wrecks.length>40)wrecks.shift();if(!heavy)blastEffect(e.x,e.y,48);burst(e.x,e.y,heavy?'#d5bd99':'#a9bfd0',heavy?12:6,heavy);if(heavy)metalImpact(e.x,e.y,false,true);}
  else if(e.type==='recruit'&&!itemEvents.some(item=>item.kind==='recruit')){burst(e.x,e.y,'#83e9ff',20);ring(e.x,e.y,'#7cecff');floating(e.amount?`+${e.amount}`:'編隊已滿',e.x,e.y-45,'#a4f5ff');toast(e.amount?`僚機歸隊 · 編隊 ${s.count} 機`:'編隊已滿');beep('upgrade');}
  else if(e.type==='upgrade'&&!itemEvents.some(item=>item.kind==='weapon')){toast(`火力 LV.${e.level} · ${weaponNames[Math.min(e.level,8)]}`);burst(e.x,e.y,'#ffe6a1',28);ring(e.x,e.y,'#ffdba1');beep('upgrade');}
  else if(e.type==='item'){rewardFeedback(e);for(const box of previousCrates)if(e.group!==undefined&&box.group===e.group&&box.x!==e.x)supplyGhosts.push({...box,life:.25});ring(e.x,e.y,e.kind==='emp'?'#e9c29c':'#b7ded8');if(e.kind==='emp'){ring(500,500,'#e7c3a2',true);for(const y of [250,400,550])burst(500,y,'#d5ad80',16,true);flash=.18;shake=5;}beep('upgrade',{empty:e.before&&['repair','shield','charge','recruit','ap','he'].includes(e.kind)&&Object.keys(e.before).every(k=>e.before[k]===e.after[k])});}
  else if(e.type==='hurt'){if(s.hp>0&&s.hp<s.maxHp*.35)battleRadio('low-hp','耐久不足。先避開火線，尋找修復補給。','warning','shin',{priority:4,valid:()=>s.hp>0&&s.hp<s.maxHp*.35});shake=motion?5:0;flash=motion?.24:0;burst(e.x,e.y,'#78d9ff',20);floating(e.loss?'僚機失能 −1':e.amount?`−${e.amount}`:'裝甲吸收',e.x,e.y-30,'#ffb99f');if(e.loss){const lost=e.wing||{x:s.x+55,y:820};blastEffect(lost.x,lost.y,65,false,.7,true);battleRadio('wing-lost','一架僚機失能。主機繼續作戰，尋找僚機補充。','warning','shin',{priority:4,duration:2.4});}beep('hit');}
  else if(e.type==='warning'){if(!s.events.some(event=>event.type==='chargerWindup'||event.type==='mortarAim'))beep('warning');}
  else if(e.type==='jamChange'){jamPulse={...e,age:0};beep(e.active?'jamEnter':'jamClear');}
  else if(e.type==='mortarAim'){const shots=s.hazards.filter(h=>h.source===e.sourceId&&h.volley===e.volley&&h.kind==='mortar');battleRadio('mortar-'+e.sourceId+'-'+e.volley,'砲兵已標定。離開落點。','warning','shin',{priority:4,duration:2.8,valid:()=>shots.some(h=>s.hazards.includes(h)&&!h.fired)});beep('mortarReady');}
  else if(e.type==='mortarLaunch'){beep('mortarLaunch');}
  else if(e.type==='mortarImpact'){blastEffect(e.x,e.y,115,false,.6);metalImpact(e.x,e.y,false,true);beep('mortarImpact');if(motion)shake=Math.max(shake,2.3);}
  else if(e.type==='fireLinkBroken'){if(!s.events.some(event=>event.type==='tactic'&&event.kind==='support'))fireLinkFx.push(...e.cancelled.map(h=>({...h,age:0})));beep('fireLinkBroken');}
  else if(e.type==='objective'){eventNotice('OBJECTIVE UPDATED',e.model==='dinosauria'?'下一目標：重戰車':'下一目標：電磁加速砲',`整備補給 · ${e.eta||30}秒後接敵`,2.8);}
  else if(e.type==='bossEnter'){const boss=s.enemies.find(n=>n.type==='boss');eventNotice('HEAVY CONTACT',boss?.model==='morpho'?'電磁加速砲型接近':'重戰車型接近',boss?.model==='morpho'?'致命射界 · 尋找缺口':'兩側副砲 · 可破壞');ring(500,340,'#d6af89',true);shake=motion?3:0;beep('bossEnter');}
  else if(e.type==='elite'){if(e.kind==='charger')eventNotice('ELITE CONTACT','獵兵接近','鎖定後突進',1.5);ring(e.x,Math.max(30,e.y),'#93afca');}
  else if(e.type==='interrupt'&&!s.events.some(other=>other.type==='partBreak'&&other.x===e.x&&other.y===e.y)){burst(e.x,e.y,'#e7c9a0',18,true);ring(e.x,e.y,'#d5ae83');beep('interrupt');}
  else if(e.type==='impact'){if(e.damage===0)continue;if(e.shell&&!e.killed&&!hitResponses.some(fx=>fx.id===e.targetId&&fx.age<.09)){hitResponses.push({id:e.targetId,age:0,power:e.boost&&e.boost!=='none'?1:.65});hitResponses=hitResponses.slice(-12);}const origin=hitOrigin(e);beep(e.ammo==='ap'?'apImpact':e.armored?'ricochet':'impact',{intensity:.6});metalImpact(origin.x,origin.y,e.armored);if(e.ammo==='ap'&&e.penetrating){const fx=impacts[impacts.length-1];fx.style='pierce';fx.life=fx.max=.16;}if(e.boost&&e.boost!=='none'){const fx=impacts[impacts.length-1];fx.color=e.boost==='momentum'?'#c1f0ed':'#ffe0ac';fx.life=fx.max=.14;}}
  else if(e.type==='partBreak'){const boss=s.enemies.find(n=>n.id===e.sourceId);coreRadio(boss);const origin=hitOrigin({...e,part:true,model:boss?.model});if(boss&&!armorBreaks.some(fx=>fx.sourceId===e.sourceId&&fx.index===e.index&&fx.age<.2)){armorBreaks.push({...origin,index:e.index,sourceId:e.sourceId,model:boss.model,age:0});armorBreaks=armorBreaks.slice(-6);}blastEffect(origin.x,origin.y,65,false,.38,true);beep('partBreak');metalImpact(origin.x,origin.y,false,true);shake=motion?3.5:0;}
  else if(e.type==='ramHit'){impacts.push({x:e.x,y:e.y,life:.25,max:.25,large:true,color:'#ffd4a5'});if(e.model!=='grauwolf')beep('cannon',{kind:e.kind});}
  else if(e.type==='stagger'){if(e.model==='grauwolf'){if(e.duration>0)beep('chargerStagger');}else{ring(e.x,e.y,'#b6f0ed');burst(e.x,e.y,'#b5ced6',8);beep('dodge');}}
  else if(e.type==='chargerWindup'){const source=s.enemies.find(n=>n.id===e.sourceId);battleRadio('charger-'+e.sourceId+'-'+s.time,'獵兵鎖定了。橫移，等它撲空再反擊。','warning','shin',{priority:4,duration:2.4,valid:()=>source&&!source.dead&&s.enemies.includes(source)&&(source.charging>0||source.dashing>0)});beep('chargerReady');}
  else if(e.type==='chargerBrake'){const source=s.enemies.find(n=>n.id===e.sourceId);chargerFx.push({x:e.x,y:e.y,age:0,angle:source?chargerHeading(source):0,hit:e.hit});chargerFx=chargerFx.slice(-6);if(e.hit)metalImpact(e.x,e.y,false,true);else{const p=point(e.x,e.y),h=enemyVisual('charger').size*p.scale,angle=source?chargerHeading(source):0;for(const side of [-1,1]){const dx=side*h*.28,screenX=p.x+Math.cos(angle)*dx,y=e.y+Math.sin(angle)*dx/(H*.0008),x=500+(screenX-W/2)/(W*.00077*point(500,y).scale);for(let i=0;i<3;i++)particles.push({x,y,vx:side*(35+i*18),vy:-80-i*22,life:.12+i*.025,max:.17,color:i===0?'#e6d4a7':'#b7b5a2',r:1.2,spark:true});}}beep('chargerBrake');}
  else if(e.type==='eliteDown'){beep('eliteDown');if(motion)shake=Math.max(shake,2.8);}
  else if(e.type==='bossDown'){toast('重型目標失能');shake=motion?5:0;flash=motion?.08:0;beep('bossDown');}
  else if(e.type==='bossRecovery'){coreRadio(s.enemies.find(n=>n.id===e.sourceId));beep('coreOpen');}
  else if(e.type==='partsRepaired'){const boss=s.enemies.find(n=>n.id===e.sourceId);if(boss){for(const side of [0,1]){const p=bossPort(boss,side);ring(p.x,p.y,'#a6dcec');burst(p.x,p.y,'#a6dcec',6);}beep('coreOpen');}}
  else if(e.type==='cannon'){
   const source=s.enemies.find(n=>n.id===e.sourceId);
   if(e.model==='morpho'&&['sweep','rail'].includes(e.kind)){
    const key=e.sourceId+':'+e.volley;if(firedRails.has(key))continue;firedRails.add(key);
    const origin=source?bossPort(source):{x:e.fromX,y:e.fromY};railBursts.push({...origin,age:0,sourceId:e.sourceId,focused:e.kind==='rail',ranges:s.hazards.filter(h=>h.source===e.sourceId&&h.kind===e.kind&&h.volley===e.volley).map(h=>({x:h.x,width:h.width}))});
    shake=motion?5:0;beep('rail');
   }else if(e.model==='dinosauria'&&source){
    const gun=dinoGun(source,e.partIndex),origin={x:500+(gun.muzzle.x-W/2)/(W*.00077*point(500,gun.worldY).scale),y:gun.worldY};
    shellBursts.push({...origin,targetX:e.x,width:e.width||260,age:0,partIndex:e.partIndex});shellBursts=shellBursts.slice(-8);metalImpact(e.x,805,false,true);shake=motion?(e.kind==='heavy'?5:2):0;beep(e.kind==='heavy'?'heavyCannon':'sideCannon');
   }else{
    const part=e.fromX<source?.x?0:1,origin=source?.model==='morpho'?bossPort(source,part):{x:e.fromX,y:e.fromY+24};
    if(e.fromX!==undefined)traces.push({x:e.x,y:e.y,fromX:origin.x,fromY:origin.y,life:.22});
    if(e.model==='morpho'){blastEffect(origin.x,origin.y,35,false,.16);burst(e.x,805,'#cdb592',8);beep('vulcan');}else{shake=motion?4:0;burst(e.x,850,'#ffaa78',28,true);beep(['rail'].includes(e.kind)?'rail':'cannon',{kind:e.kind});}
   }
  }
  else if(e.type==='blast'){if(e.radius){const contact=hitOrigin(e.directTarget),size=Math.max(48,2*e.radius*W*.00077*.65);blastEffect(contact.x,contact.y,size,false,e.ammo==='he'?.45:.3,true);ammoBursts.push({...e,contact,age:0,hits:e.hits.map(hit=>({...hit,contact:hitOrigin(hit)}))});ammoBursts=ammoBursts.slice(-10);for(const hit of e.hits.slice(0,10))if(!hit.killed){const p=hitOrigin(hit);metalImpact(p.x,p.y,false);}if(e.ammo==='he')beep('heBurst');}else{blastEffect(e.x,e.y,75);burst(e.x,e.y,'#d0bd9b',5);}}
  else if(e.type==='dash'){burst(e.x,e.y,'#a8b4c0',8);beep(e.model==='grauwolf'?'chargerDash':'dash');}
  else if(e.type==='blade'&&e.target){const contact=hitOrigin(e.target);bladeFx.push({...e,contact,age:0});bladeFx=bladeFx.slice(-3);metalImpact(contact.x,contact.y,false,e.killed);beep('blade');}
  else if(e.type==='attackCue'&&['main','rail','focused'].includes(e.kind)){
   const boss=s.enemies.find(n=>!n.dead&&n.type==='boss'&&n.model===(e.kind==='main'?'dinosauria':'morpho'));
   if(boss){const shots=s.hazards.filter(h=>h.source===boss.id&&h.volley===boss.attackCount&&h.kind===({main:'heavy',rail:'sweep',focused:'rail'}[e.kind]));battleRadio('boss-'+boss.id+'-'+boss.attackCount,e.kind==='rail'?'電磁射界鎖定。進入藍色安全缺口。':e.kind==='main'?'主砲已鎖定。先橫移，留意後續射線。':'主砲轉為直射。移出預鎖線。','warning','shin',{priority:5,duration:2.8,valid:()=>!boss.dead&&shots.some(h=>s.hazards.includes(h)&&(!h.fired||h.lethal&&h.life>0))});}
  }
  else if(e.type==='tactic'){
   battleRadio('tactic-'+s.time,e.kind==='support'?'支援砲擊抵達。壓制你前方的敵機。':'誘餌已部署。利用它引開鎖定。','tactic',e.kind==='support'?'lena':'shin');
   if(e.kind==='support'){supportFx.push({...e,age:0,hits:e.hits.map(hit=>({...hit,...hitOrigin(hit)}))});supportFx=supportFx.slice(-2);if(e.hits.length)shake=Math.max(shake,4);}
   beep(e.kind);
  }
  
  else if(e.type==='over'||e.type==='victory'||e.type==='won'||e.type==='win')end();
 }
}
function clearNotices(){radioCooldown={};activeRadio=null;window.FrontlineUI?.clearRadio();chargerFx=[];armorBreaks=[];hitResponses=[];jamPulse=null;fireLinkFx=[];ammoBursts=[];bladeFx=[];bracePulse=0;shotBoost='none';for(const el of document.querySelectorAll('[data-reward]')){delete el.dataset.reward;el.classList.remove('reward-pulse');}rewardFx=[];supplyGhosts=[];eventTime=0;$('eventNotice').hidden=true;clearTimeout(toastTimer);clearTimeout(warningTimer);$('toast').classList.remove('show');$('warning').classList.remove('show');}
function start(retry=false){
 if(!assetReady)return;window.FrontlineAudio?.stopEffects?.();window.FrontlineAudio?.unlock();beep('uiConfirm');window.manualTime=false;
 if(!retry&&!/^\d{1,6}$/.test(params.get('seed')||''))$('seed').value=1+Math.floor(Math.random()*999999);
 if(!retry||!runConfig)runConfig={machine:$('machine').value,encounter:$('encounter').value,ammo:$('ammo').value,tactic:$('tactic').value,bossModel:$('arenaBoss')?.value||'dinosauria',mode:$('gameMode')?.value==='endless'?'endless':'frontline',seed:Number($('seed').value)||42};
 C=runConfig.mode==='endless'?GameArenaCore:GameCore;let seed=runConfig.seed;s=C.setup(C.create(()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}),runConfig);runResult=null;state='launching';phaseTime=phaseDuration=2.6;keys.clear();drag=false;shellBursts=[];supportFx=[];railBursts=[];particles=[];texts=[];rings=[];impacts=[];explosions=[];effectsClock=0;lastExplosion=-1;wrecks=[];traces=[];shake=0;flash=0;danger=0;clearNotices();window.FrontlineUI?.phaseDialogue?.('lena','各機，準備出擊。我會支援你們。');
 $('overlay').hidden=true;$('debrief').hidden=true;$('pause').disabled=false;$('pause').innerHTML='暫停 <kbd>P</kbd>';$('pause').setAttribute('aria-label','暫停遊戲');
 $('transition').hidden=false;$('transition').className='sortie-transition launching';$('phaseLabel').textContent='SPEARHEAD / 出擊準備';$('phaseTitle').textContent=C.machines[s.machine].name;$('phaseDetail').textContent={pursuit:'誘導獵兵突進 · 閃開後反擊 · 後續重戰車',mixed:'突破軍團戰線 · 重戰車與軌道砲',dinosauria:'擊破重戰車 · 側移拆除副砲',morpho:'擊破電磁加速砲 · 避開致命射界',mines:'清理地雷 · 利用連鎖爆破','fire-support':'壓制火力支援 · 擊破斥候與砲兵'}[s.encounter];$('skipPhase').textContent='立即出擊';$('phaseProgress').style.width='0%';$('phaseMachine').src=previewSource(s.machine);$('phaseMachine').alt=C.machines[s.machine].name;const targetModel={arena:'dinosauria',pursuit:'grauwolf',mixed:'dinosauria',dinosauria:'dinosauria',morpho:'morpho',mines:'mine','fire-support':'scorpion'}[s.encounter];$('phaseEnemy').src=previewSource(targetModel);$('phaseEnemy').alt={grauwolf:'Grauwolf',dinosauria:'Dinosauria',morpho:'Morpho',mine:'自走地雷',scorpion:'Skorpion'}[targetModel];$('phaseEnemyName').textContent=$('phaseEnemy').alt;if(s.arena){$('phaseEnemy').src=previewSource(runConfig.bossModel);$('phaseEnemy').alt=runConfig.bossModel;$('phaseDetail').textContent='四面接敵 · WASD 移動 · 自動主砲 · 左鍵超頻／右鍵躍進';$('phaseEnemyName').textContent='軍團包圍網';$('tip').textContent='靠近補給即可回收';}else $('tip').textContent='走位選補給';canvas.style.cursor=s.arena?'crosshair':'';canvas.focus();hud();
}
function configure(){arenaPoseCache.clear();C=GameCore;state='ready';window.FrontlineAudio?.stopEffects?.();beep('uiSelect');keys.clear();drag=false;shellBursts=[];supportFx=[];railBursts=[];shake=0;particles=[];rings=[];impacts=[];texts=[];wrecks=[];explosions=[];traces=[];flash=0;muzzle=0;danger=0;clearNotices();$('transition').hidden=true;$('debrief').hidden=true;$('overlay').hidden=false;$('overlay').className='overlay';$('loadout').hidden=false;$('result').hidden=true;$('title').innerHTML='出擊<span>整備</span>';$('description').textContent='選擇你的機體，突破軍團戰線。';$('start').innerHTML='開始作戰 <span>→</span>';$('start').disabled=!assetReady;$('pause').disabled=true;$('assetstatus').hidden=false;$('hint').textContent='左右移動 · 自動砲擊 · 走位選補給';loadoutPreview();window.FrontlineUI?.refreshBriefing();preview();hud();}
$('configure').onclick=configure;
function previewSource(model){return unitPreviews[model]||'art-direction/86-reference/images/official-'+model+'.jpg';}
function updateUnitPreviews(){
 const models={grauwolf:4,m1a4:0,m4a3:6,xm2:7,dinosauria:8,morpho:9,ameise:2,eintagsfliege:11,mine:12,scorpion:10,phoenix:13,stier:14};
 for(const [model,index] of Object.entries(models)){if(unitPreviews[model]||!sprites[index])continue;const source=sprites[index],scale=Math.min(560/source.width,440/source.height),w=source.width*scale,h=source.height*scale,thumb=document.createElement('canvas');thumb.width=640;thumb.height=480;const c=thumb.getContext('2d');c.imageSmoothingQuality='high';const levels=spriteLevels(source),texture=levels.filter(img=>img.height>=h).at(-1)||source;c.drawImage(texture,320-w/2,240-h/2,w,h);unitPreviews[model]=thumb.toDataURL();}
 for(const card of document.querySelectorAll('[data-choice="machine"],[data-choice="encounter"]')){const model=card.dataset.choice==='machine'?card.dataset.value:({pursuit:'grauwolf',mixed:'dinosauria','fire-support':'eintagsfliege',mines:'mine',dinosauria:'dinosauria',morpho:'morpho'})[card.dataset.value],img=card.querySelector('img');if(img&&unitPreviews[model]){img.src=unitPreviews[model];img.alt=model+'戰鬥素材預覽';}}
 loadoutPreview();window.FrontlineUI?.refreshBriefing();
}
function loadoutPreview(){
 if($('gameMode').value==='endless'&&window.GameArenaCore){arenaLoadoutPreview();return;}
 const C=GameCore;
 const machine=$('machine').value,encounter=$('encounter').value;
 const allies={m1a4:['M1A4','破壞神 · 機動反擊'],m4a3:['M4A3','破壞之杖 · 停穩重砲'],xm2:['XM2','女武神 · 高速近擊']};
 const enemies={pursuit:['grauwolf','GRAUWOLF','獵兵突襲 → 重戰車','dinosauria'],mixed:['dinosauria','DINOSAURIA / MORPHO','重戰車 → 電磁加速砲','morpho'], 'fire-support':['eintagsfliege','EINTAGSFLIEGE / AMEISE','干擾與斥候協同 · 後方砲兵','ameise'],mines:['mine','SELF-PROPELLED MINE','自走地雷 · 接近引爆'],dinosauria:['dinosauria','DINOSAURIA','重戰車型 · 裝甲與重砲'],morpho:['morpho','MORPHO','電磁加速砲型 · 致命射界']};
 const ally=allies[machine],enemy=enemies[encounter];
 $('routeDinoImage').src=previewSource('dinosauria');$('routeMorphoImage').src=previewSource('morpho');$('allyPreview').src=previewSource(machine);$('allyPreview').alt=ally.join(' · ')+(unitPreviews[machine]?'戰鬥素材預覽':'設定參考');$('allyModel').textContent=ally[0];$('allyRole').textContent=ally[1];
 $('enemyPreview').src=previewSource(enemy[0]);$('enemyPreview').alt=enemy[0]+(unitPreviews[enemy[0]]?'戰鬥素材預覽':'設定參考');$('enemyModel').textContent=enemy[1];$('enemyRole').textContent=enemy[2];
 const ammo=$('ammo').value,config=C.setup(C.create(()=>.5),{machine,encounter,ammo}),m=C.machines[machine],w=C.weapon(config.level),factor=ammo==='ap'?1.4:ammo==='he'?.8:1,damage=w.damage*m.damage*factor,interval=w.interval*m.interval*(ammo==='ap'?1.25:1),n=v=>Number(v.toFixed(2)).toString();
 const stats=[['耐久',m.hp,'HP',m.hp/160,'主機初始耐久'],['全幅橫移',n(780/m.speed),'秒',m.speed/880,'從最左移動到最右，時間越短越靈活'],['主砲直擊',n(damage),'／發',m.damage/1.65,'單發基礎傷害，不含技能、破片、僚機及目標護甲'],['裝填',n(interval),'秒',1/m.interval,'主砲兩輪之間的時間，越短越快']];
 $('allyStats').innerHTML=`<small class="stats-context">開局 LV.${config.level} · 主機基礎值</small>`+stats.map(([label,value,unit,ratio,title],i)=>`<div class="dossier-stat" title="${title}"><span>${label}</span><strong data-stat="${i}">${value}<small>${unit}</small></strong><i><em style="width:${ratio*100}%"></em></i></div>`).join('');
 const skill={m1a4:['近身反擊','敵機靠近','自動斬擊 '+(45+config.level*5),'每 2.4 秒可觸發 · 對一般敵機'],m4a3:['穩定砲架','停止移動 0.45 秒','主砲 ×1.7 ＋ 穿甲','強化直擊 '+n(damage*1.7)+'／發 · 移動解除'],xm2:['動能砲擊','橫移累積 90 動能','一輪砲擊 ×1.8','強化直擊 '+n(damage*1.8)+'／發 · 發射後消耗'] }[machine];
 $('machineBrief').innerHTML=`<span class="skill-name">${skill[0]}</span><div class="skill-chain"><span>${skill[1]}</span><b aria-hidden="true">→</b><strong>${skill[2]}</strong></div><small>${skill[3]}</small>${machine==='xm2'?'<small class="secondary-skill">近擊 '+(110+config.level*8)+' · 每 1.25 秒 · 對一般敵機</small>':''}`;
 const enemyData={pursuit:[[['耐久',Math.ceil(config.enemies.find(e=>e.type==='charger')?.max||212.5)+' HP'],['預備','1 秒'],['撞擊','35']],['誘導反擊','鎖定後側移 → 趁失衡反擊','撲空後受傷 ×1.8；誘餌延長失衡至2.4秒。後續突破重戰車。']],mixed:[[['重戰車','2,600 HP'],['軌道砲','3,200 HP'],['整備轉場','18 秒']],['連續突破','拆砲突破 → 整備追擊 → 軌道砲','擊破重戰車後選修復或戰術補充，應付獵兵追擊，18秒後再接戰。']],dinosauria:[[['本體','2,600 HP'],['側砲','190 × 2'],['主砲預警','1.3 秒']],['拆砲反制','站在側面 → 火線瞄準砲座','主砲後兩翼追射；拆掉一側留下空間。雙砲全拆核心持續開放、敵方主砲更強。']],morpho:[[['本體','3,200 HP'],['側砲','150 × 2'],['封鎖預警','1.9 秒']],['致命射界','進入缺口 → 避開主砲','封鎖後核心開放 2.2 秒；拆件打斷三連射，雙側全毀改為單線主砲。']],mines:[[['單體','25 HP'],['連鎖傷害','85'],['爆破半徑','150']],['連鎖引爆','提前擊破 → 引爆附近地雷','別讓引信在機體旁啟動；榴彈適合密集目標。']],'fire-support':[[['干擾機','90 HP'],['砲兵','150 HP'],['殘留砲區','2.2 秒']],['瓦解支援','先擊破斥候／干擾 → 再壓制砲兵','側移離開干擾或直射擊破蜂群，可恢復遠距瞄準；擊破斥候可取消未離膛的第二發。']]}[encounter];
 $('enemyStats').innerHTML=enemyData[0].map(([label,value])=>`<div><span>${label}</span><strong>${value}</strong></div>`).join('');
 $('encounterBrief').innerHTML=`<span class="skill-name">${enemyData[1][0]}</span><strong>${enemyData[1][1]}</strong><small>${enemyData[1][2]}</small>`;
 $('ammoBrief').innerHTML={standard:`<strong>穿透 ${w.pierce} 目標</strong><span>主機每發至多一次破片爆破</span>`,ap:'<strong>直擊 ×1.4 · 穿透 4</strong><span>裝填時間 +25% · 無範圍爆破</span>',he:'<strong>爆破半徑 165</strong><span>直擊 ×0.8 · 清群優先</span>'}[ammo];
 $('tacticBrief').innerHTML=$('tactic').value==='decoy'?'<strong>誘導鎖定 4 秒</strong><span>放置後離開 · 無法吸引全域封鎖</span>':$('encounter').value==='morpho'?'<strong>本體 160 · 核心開放 500</strong><span>對準主機施放 · 側砲以主砲拆除</span>':'<strong>區域砲擊 · 重戰車拆砲</strong><span>對準目標再施放 · 初始 1 次／上限 2</span>';
 for(const card of document.querySelectorAll('[data-choice="machine"]')){const cm=C.machines[card.dataset.value];let metrics=card.querySelector('.card-metrics');if(!metrics){metrics=document.createElement('div');metrics.className='card-metrics';card.append(metrics);}metrics.innerHTML=`<span>${cm.hp}<small> HP</small></span><span>${n(780/cm.speed)}<small> 秒橫移</small></span>`;}
 $('enemySecond').hidden=!enemy[3];if(enemy[3]){$('enemySecond').src=previewSource(enemy[3]);$('enemySecond').alt=enemy[3]+(unitPreviews[enemy[3]]?'戰鬥素材預覽':'設定參考');}
}
for(const id of ['machine','encounter','ammo','tactic','gameMode'])$(id).addEventListener('change',()=>{loadoutPreview();window.FrontlineUI?.refreshBriefing();});
function useTactic(){if(state!=='playing')return;s.events=[];if(C.useTactic(s)){processEvents();hud();}}
$('tactical').onclick=useTactic;
function pause(){
 if(!['launching','playing','paused'].includes(state))return;beep('uiSelect');
 if(state==='paused'){state=pausedFrom;$('overlay').hidden=true;$('transition').hidden=state!=='launching';canvas.focus();}
 else{pausedFrom=state;state='paused';keys.clear();drag=false;shake=0;flash=0;$('transition').hidden=true;$('overlay').hidden=false;$('loadout').hidden=true;$('overlay').className='overlay paused';$('title').innerHTML='作戰<span>暫停</span>';$('description').textContent='戰線與計時已暫停。';$('start').innerHTML='繼續作戰 <span>→</span>';$('hint').textContent='按 P 或點擊按鈕繼續';$('result').hidden=true;$('assetstatus').hidden=true;}
 $('pause').innerHTML=state==='paused'?'繼續 <kbd>P</kbd>':'暫停 <kbd>P</kbd>';$('pause').setAttribute('aria-label',state==='paused'?'繼續遊戲':'暫停遊戲');
}
function end(){
 if(runResult)return;runResult=C.result(s);if(!runResult)return;state='settling';phaseTime=phaseDuration=3.2;keys.clear();drag=false;s.crates=[];s.gates=[];s.bullets=[];texts=[];clearNotices();$('overlay').hidden=true;$('pause').disabled=true;window.FrontlineUI?.phaseDialogue?.('shin',s.won?'目標沉默。回收隊形，準備撤離。':'主機失能。作戰紀錄已送回指揮部。');
 $('transition').hidden=false;$('transition').className='sortie-transition settling '+(s.won?'victory':'defeat');$('phaseLabel').textContent=s.won?'MISSION COMPLETE':'SIGNAL LOST';$('phaseTitle').textContent=s.won?'戰線突破':'主機訊號中斷';$('phaseDetail').textContent=s.won?'戰果確認中':'作戰紀錄已保存';$('skipPhase').textContent='查看戰報';$('phaseProgress').style.width='0%';if(!s.won){blastEffect(s.x,s.arena?s.y:792,120,true);burst(s.x,s.arena?s.y:792,'#d2b293',28,true);ring(s.x,s.arena?s.y:792,'#edbd8f',true);}beep(s.won?'victory':'defeat');
}
function showResult(){
 if(!runResult)return;state='over';$('transition').hidden=true;$('debrief').hidden=false;$('debrief').className='debrief '+(runResult.won?'victory':'defeat');
 const r=runResult,model=C.machines[r.machine].name;$('reportMachine').src=previewSource(r.machine);$('reportMachine').alt=model;$('reportModel').textContent=model;$('reportTitle').textContent=r.won?'戰線突破':'作戰中止';$('reportSummary').textContent=r.won?'目標已排除。小隊完成本次作戰。':'主機失去戰鬥能力。調整路線與裝備，再次出擊。';
 $('reportStats').innerHTML=[['作戰時間',formatTime(r.time)],['確認擊破',r.kills],['武裝打斷',r.interrupts],['承受傷害',r.damage]].map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('');
 $('reportCode').textContent=r.won?'MISSION COMPLETE / 作戰紀錄':'SIGNAL LOST / 作戰紀錄';$('reportObjective').textContent={arena:'無限戰線',pursuit:'獵兵追擊 → 重戰車',mixed:'重戰車 → 電磁加速砲',dinosauria:'Dinosauria · 重戰車',morpho:'Morpho · 電磁加速砲',mines:'地雷連鎖','fire-support':'火力支援壓制'}[r.encounter];$('reportEnemy').src=previewSource({pursuit:r.won?'dinosauria':'grauwolf',mixed:r.bossKills===0?'dinosauria':'morpho',dinosauria:'dinosauria',morpho:'morpho',mines:'mine','fire-support':'scorpion',arena:s.enemies.find(e=>e.type==='boss'&&!e.dead)?.model||runConfig?.bossModel||'dinosauria'}[r.encounter]);$('reportEnemy').alt=$('reportObjective').textContent;$('reportObjectiveState').textContent=r.encounter==='mixed'?`${r.bossKills} / 2 擊破`:r.won?'已完成':'未完成';$('reportResources').innerHTML=[['頭目擊破',r.bossKills],['補給取得',r.items],['戰術使用',r.tactics],...(r.mode==='endless'?[['僚機攔截',r.sacrifices||0]]:[])].map(([label,value])=>`<span>${label} <b>${value}</b></span>`).join('');
 const cause=r.lastDamage,causes={ram:['衝撞','等敵機鎖定後橫移，讓獵兵撲空。'],contact:['敵機突破','優先清理接近主機的敵機。'],sweep:['電磁加速砲封鎖','提早進入射界間的缺口。'],rail:[cause?.lethal?'致命主砲':'預鎖主砲','砲口鎖定後橫移，讓主機中心離開射界。'],heavy:['重型主砲','砲口鎖定後換線，利用後座窗口反擊。'],secondary:['副砲齊射','站到側面，拆除對應砲座。'],vulcan:['火神砲掃射','鎖定後換線，保留戰術支援。'],mortar:['砲擊爆區','離開落點後別立即折返；優先擊破斥候。'],mine:['自走地雷引爆','提前射爆地雷，利用連鎖清場。']};
 const sourceName={dinosauria:'Dinosauria',morpho:'Morpho',phoenix:'Phönix',stier:'Stier',gunner:'Ameise 掃射班',grauwolf:'Grauwolf',charger:'Grauwolf',artillery:'Skorpion',mine:'自走地雷',shield:'Löwe',normal:'Ameise',scout:'Ameise',boss:'Löwe',swarm:'Ameise'}[cause?.model]||'';
 if(r.mode==='endless'){causes.mortar=['砲擊爆區','離開落點；掩體擋不住曲射，優先壓制砲兵。'];causes.secondary=['副砲齊射','移出預告射線，或借掩體阻擋直射。'];causes.rail=['電磁主砲','射界鎖定後離開光帶，利用散熱窗口反擊。'];}const info=causes[cause?.kind]||['敵方火力','觀察射界與敵機預備動作，再選擇反擊時機。'];$('reportCause').hidden=r.won;$('reportCause').innerHTML=`<span>致命來源</span><strong>${sourceName?sourceName+' · ':''}${info[0]}</strong><p>${info[1]}</p>`;
 $('retry').textContent=r.mode==='endless'?'重新挑戰':'重試這一場';$('reportFootnote').textContent=r.mode==='endless'?'重新挑戰沿用出擊配置，恢復初始耐久與補給；場內強化重新取得。':'下一場保留出擊機體、初始彈藥與戰術；場內強化重新取得。重試保留本場敵軍安排，敵人仍會依走位反應。';
 const next={mixed:'pursuit',pursuit:'fire-support','fire-support':'mines',mines:'dinosauria',dinosauria:'morpho',morpho:'mixed',arena:'mixed'}[r.encounter];
 const nextInfo={pursuit:['grauwolf','獵兵追擊','誘導突進，閃開後近距反擊'],'fire-support':['scorpion','火力支援壓制','切斷斥候指引，突入干擾區清除砲兵'],mines:['mine','地雷連鎖','引爆密集地雷，以爆破清出路線'],dinosauria:['dinosauria','重戰車突破','側移拆除副砲，抓住主砲後座窗口'],morpho:['morpho','電磁加速砲','穿過封鎖缺口，趁核心暴露反攻'],mixed:['dinosauria','雙重戰線','重戰車後整備，再迎擊電磁加速砲']}[next];
 $('nextEncounter').dataset.encounter=next;$('nextEnemy').src=previewSource(nextInfo[0]);$('nextName').textContent=nextInfo[1];$('nextCounter').textContent=nextInfo[2];
 $('reportLoadout').textContent=`${model} · LV.${r.level} / ${{ap:'穿甲彈',he:'榴彈',standard:'通用彈'}[r.ammo]} / ${r.tactic==='decoy'?'誘餌':'支援砲擊'}`;if(r.mode==='endless'){$('reportObjective').textContent='無限戰線';$('reportObjectiveState').textContent='第 '+r.wave+' 波';$('nextEncounter').hidden=true;}else $('nextEncounter').hidden=false;window.FrontlineUI?.reportDialogue?.('lena',r.won?'收到。作戰完成，你們辛苦了。':'紀錄已收到。重新整備，我們再找一條路。');$('reportTitle').focus();hud();
}
function completePhase(){if(state==='launching'){state='playing';battleRadio('sortie',s.arena?'四面接敵。保持移動，主砲交給你指向。':'前方接敵。保持機動，跟上我的步調。');$('transition').hidden=true;canvas.focus();}else if(state==='settling')showResult();}
function eventNotice(code,title,detail,duration=2.2){if(window.FrontlineUI?.radioMessage){battleRadio(code,title+'。'+detail+'。',code==='OBJECTIVE UPDATED'?'status':'warning',code==='OBJECTIVE UPDATED'?'lena':'shin',{priority:code==='ELITE CONTACT'?2:3,duration});return;}if(eventTime>0&&!['HEAVY CONTACT','OBJECTIVE UPDATED'].includes(code))return;$('eventNotice').classList.toggle('compact',code==='ELITE CONTACT');$('eventCode').textContent=code;$('eventTitle').textContent=title;$('eventDetail').textContent=detail;$('eventNotice').hidden=false;eventTime=duration;}
$('skipPhase').onclick=completePhase;$('retry').onclick=()=>start(true);$('changeLoadout').onclick=configure;
$('nextEncounter').onclick=()=>{if(state!=='over'||!runConfig||runConfig.mode==='endless')return;const seed=(runConfig.seed+1+Math.floor(Math.random()*999998)-1)%999999+1;runConfig={...runConfig,encounter:$('nextEncounter').dataset.encounter,seed};$('seed').value=seed;$('encounter').value=runConfig.encounter;$('encounter').dispatchEvent(new Event('change',{bubbles:true}));start(true);};
$('start').onclick=()=>state==='paused'?pause():start();$('pause').onclick=pause;
function activateAudio(){if(audioActivated)return;audioActivated=true;window.FrontlineAudio?.unlock();window.FrontlineAudio?.setMusic(music);window.FrontlineAudio?.setSfx(sound);$('music').textContent=`音樂 ${music?'開':'關'}`;}
$('music').textContent='音樂 啟用';
document.addEventListener('click',activateAudio);
$('sound').onclick=()=>{activateAudio();sound=!sound;window.FrontlineAudio?.setSfx(sound);$('sound').textContent=`音效 ${sound?'開':'關'}`;$('sound').setAttribute('aria-pressed',String(sound));};
$('music').onclick=()=>{if(!audioActivated){activateAudio();return;}music=!music;window.FrontlineAudio?.setMusic(music);$('music').textContent=`音樂 ${music?'開':'關'}`;$('music').setAttribute('aria-pressed',String(music));};
$('musicVolume').oninput=e=>{activateAudio();window.FrontlineAudio?.setMusicVolume(Number(e.target.value)/100);};
$('sfxVolume').oninput=e=>{activateAudio();window.FrontlineAudio?.setSfxVolume(Number(e.target.value)/100);};
function motionLabel(){document.body.classList.toggle('reduce-motion',!motion);$('motion').textContent=`震動 ${motion?'開':'關'}`;$('motion').setAttribute('aria-label',motion?'減少畫面震動':'開啟畫面震動');}
$('motion').onclick=()=>{motion=!motion;motionLabel();};motionLabel();
window.addEventListener('keydown',e=>{if(state==='ready'||state==='over'||state==='settling')return;if(['INPUT','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'){if(e.target.tagName==='BUTTON')return;e.preventDefault();if(!e.repeat)useTactic();return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','A','d','D','w','W','s','S','p','P'].includes(e.key)){e.preventDefault();keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='p'&&!e.repeat)pause();}});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(['a','d','arrowleft','arrowright'].includes(e.key.toLowerCase()))s.target=s.x;});
window.addEventListener('blur',()=>{keys.clear();if(['launching','playing'].includes(state))pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&['launching','playing'].includes(state))pause();});
function steer(e){if(s.arena){arenaAim(e);return;}const r=canvas.getBoundingClientRect(),scale=.48+.52*.8;s.target=clamp(500+(e.clientX-r.left-W/2)/(W*.00077*scale),110,890);}
function arenaAbility(kind){
 if(!s.arena||state!=='playing')return;
 s.events=[];
 const used=C.useAbility(s,kind,{moveX:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),moveY:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup')),aimX:s.aimX,aimY:s.aimY});
 if(used){processEvents();hud();}else beep('uiHover');
}
$('arenaBurst').onclick=()=>arenaAbility('burst');$('arenaDash').onclick=()=>arenaAbility('dash');
canvas.addEventListener('contextmenu',e=>{if(s.arena)e.preventDefault();});
canvas.addEventListener('pointerdown',e=>{if(!['launching','playing'].includes(state))return;if(s.arena){e.preventDefault();steer(e);if(e.button===0)arenaAbility('burst');else if(e.button===2)arenaAbility('dash');return;}if(e.button!==0)return;drag=true;canvas.setPointerCapture(e.pointerId);steer(e);});canvas.addEventListener('pointermove',e=>{if(drag||s.arena&&state==='playing')steer(e);});canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);canvas.addEventListener('lostpointercapture',()=>drag=false);
function prism(x,y,width,depth,height,color){
 const a=point(x,y),b=point(x+width,y),c=point(x+width,y+depth),d=point(x,y+depth),h=height*a.scale;
 polygon([a,b,c,d],color);
 polygon([{x:a.x,y:a.y-h},{x:b.x,y:b.y-h},b,a],'#1a3046');
 polygon([{x:b.x,y:b.y-h},{x:c.x,y:c.y-h},c,b],'#0d192c');
 polygon([{x:a.x,y:a.y-h},{x:b.x,y:b.y-h},{x:c.x,y:c.y-h},{x:d.x,y:d.y-h}],'#2a4255','#395367');
 return {a,b,c,d,h};
}
function drawRoad(){
 if(road.complete&&road.naturalWidth){
  const drift=(s.scroll*.025)%H;
  for(let i=0;i<32;i++){
   const y=i*H/32,world=(y/H-.1)/.0008,l=point(0,world).x,r=point(1000,world).x,sy=((y+H-drift)%(H*2))/(H*2)*road.height,sh=road.height/64;
   ctx.drawImage(road,0,sy,road.width*.32,sh,0,y,l,H/32+1);
   ctx.drawImage(road,road.width*.32,sy,road.width*.36,sh,l,y,r-l,H/32+1);
   ctx.drawImage(road,road.width*.68,sy,road.width*.32,sh,r,y,W-r,H/32+1);
  }
  ctx.fillStyle='#07152533';ctx.fillRect(0,0,W,H);
  const fog=ctx.createLinearGradient(0,0,0,H*.45);fog.addColorStop(0,'#142b47bb');fog.addColorStop(1,'#142b4700');ctx.fillStyle=fog;ctx.fillRect(0,0,W,H*.45);
  return;
 }
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#101d32');bg.addColorStop(.5,'#071324');bg.addColorStop(1,'#07101d');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W/2,H*.16,0,W/2,H*.16,W*.65);glow.addColorStop(0,danger>.4?'#783d4655':'#326d9444');glow.addColorStop(1,'#07101d00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 for(let side=0;side<2;side++)for(let i=0;i<17;i++){
  const y=((i*98+s.scroll*.32)%1510)-250,x=side?1090+(i%3)*95:-340+(i%3)*100;
  const block=prism(x,y,60+(i%3)*35,95,25+(i%5)*15,'#101e2d');
  if(i%2===0){const a=block.a,b=block.b;line({x:a.x,y:a.y-block.h+7},{x:b.x,y:b.y-block.h+7},danger>.4?'#8d519bab':'#3a89b6aa',1.5);}
 }
 polygon([point(-45,-150),point(1045,-150),point(1045,1150),point(-45,1150)],'#07121d');
 polygon([point(0,-150),point(1000,-150),point(1000,1150),point(0,1150)],'#1e3245');
 for(let i=0;i<17;i++){
  const y=((i*92+s.scroll)%1450)-240;
  polygon([point(15,y),point(985,y),point(985,y+88),point(15,y+88)],i%2?'#283745':'#253441');
  line(point(25,y+88),point(975,y+88),'#0f2435',2);
  for(const x of [165,500,835]){const p=point(x,y+15);ctx.fillStyle='#43617666';ctx.fillRect(p.x-1,p.y,2,2);}
  for(const x of [330,670]){line(point(x,y+15),point(x,y+55),'#55748744',Math.max(1,2*point(x,y).scale));}
  if(i%4===0){line(point(180,y+9),point(270,y+38),'#101b25',2);line(point(270,y+38),point(240,y+70),'#101b25',1);line(point(270,y+38),point(345,y+59),'#101b25',1);}
  if(i%3===0){polygon([point(465,y+40),point(500,y+13),point(535,y+40),point(523,y+40),point(500,y+25),point(477,y+40)],'#9dc0cb13');}
 }
 const accent=danger>.4?'#d88680':'#67899b';
 for(let side=0;side<2;side++){
  const x=side?1000:0;line(point(x,-100),point(x,1100),'#030b15',10);line(point(x,-100),point(x,1100),accent,2);
  for(let i=0;i<16;i++){
   const y=((i*92+s.scroll)%1472)-200;
   const p=prism(side?1005:-36,y,30,63,12,'#15283b');
   line({x:p.a.x,y:p.a.y-p.h},{x:p.d.x,y:p.d.y-p.h},accent,2.1);
   if(i%3===0){const a=point(side?1060:-65,y),b=point(side?1060:-65,y+45);line(a,b,danger>.4?'#c77f76':'#577689',3);}
  }
 }
 if(danger>0){ctx.fillStyle=`rgba(134,41,182,${danger*.045})`;ctx.fillRect(0,0,W,H);}
}
function loadProductionAtlas(){
 const image=new Image();image.onload=()=>{
  const source=document.createElement('canvas');source.width=image.width;source.height=image.height;const c=source.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const pixels=c.getImageData(0,0,source.width,source.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4){const excess=d[i+1]-Math.max(d[i],d[i+2]);if(d[i+1]>90&&excess>30){d[i+3]=Math.round(255*(1-clamp((excess-30)/65,0,1)));d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2])+10);}}c.putImageData(pixels,0,0);
  const half=Math.floor(image.width/2),split=Math.round(image.height*582/1254);
  for(let k=0;k<4;k++){const x=k%2*half,y=k<2?0:split,w=half,h=k<2?split:image.height-split;let left=w,top=h,right=0,bottom=0;
   for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(d[((y+yy)*image.width+x+xx)*4+3]>30){left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);}
   if(right<=left||bottom<=top)continue;const sprite=document.createElement('canvas');sprite.width=right-left+3;sprite.height=bottom-top+3;sprite.getContext('2d').drawImage(source,x+left,y+top,right-left+1,bottom-top+1,1,1,right-left+1,bottom-top+1);sprites[k+6]=sprite;rigs[k+6]=makeRig(sprite,k+6);
  }
  updateUnitPreviews();
 };image.src='assets/mecha-86-production.png';
}
const turretImage=new Image();turretImage.onload=()=>{
 const layer=document.createElement('canvas');layer.width=560;layer.height=755;const c=layer.getContext('2d',{willReadFrequently:true});c.drawImage(turretImage,350,250,560,755,0,0,560,755);const pixels=c.getImageData(0,0,560,755),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const excess=d[i+1]-Math.max(d[i],d[i+2]);if(d[i+1]>90&&excess>30){d[i+3]=Math.round(255*(1-clamp((excess-30)/65,0,1)));d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2])+10);}}c.putImageData(pixels,0,0);turretSprite=layer;turretLevels=spriteLevels(layer);
};turretImage.src='assets/dinosauria-turret.png';
function loadSpecialists(src='assets/legion-specialists.png',columns=3,offset=10){
 const image=new Image();image.onload=()=>{
  const layer=document.createElement('canvas');layer.width=image.width;layer.height=image.height;const c=layer.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);const pixels=c.getImageData(0,0,image.width,image.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4){const excess=d[i+1]-Math.max(d[i],d[i+2]);if(d[i+1]>90&&excess>30){d[i+3]=Math.round(255*(1-clamp((excess-30)/65,0,1)));d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2])+10);}}c.putImageData(pixels,0,0);
  const width=Math.floor(image.width/columns);for(let k=0;k<columns;k++){let left=width,right=0,top=image.height,bottom=0;for(let y=0;y<image.height;y++)for(let x=0;x<width;x++)if(d[(y*image.width+k*width+x)*4+3]>30){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<=left||bottom<=top)continue;const sprite=document.createElement('canvas');sprite.width=right-left+3;sprite.height=bottom-top+3;sprite.getContext('2d').drawImage(layer,k*width+left,top,right-left+1,bottom-top+1,1,1,right-left+1,bottom-top+1);sprites[offset+k]=sprite;rigs[offset+k]=makeRig(sprite,offset+k);if(offset===10&&k===1)jammerLevels=spriteLevels(sprite);}
  updateUnitPreviews();
 };image.src=src;
}
function spriteLevels(source){
 const levels=[source];while(source.height>96){const smaller=document.createElement('canvas');smaller.width=Math.ceil(source.width/2);smaller.height=Math.ceil(source.height/2);const c=smaller.getContext('2d');c.imageSmoothingQuality='high';c.drawImage(source,0,0,smaller.width,smaller.height);levels.push(smaller);source=smaller;}return levels;
}
const supplyImage=new Image();supplyImage.onload=()=>{
 const layer=document.createElement('canvas');layer.width=supplyImage.width;layer.height=supplyImage.height;const c=layer.getContext('2d',{willReadFrequently:true});c.drawImage(supplyImage,0,0);const pixels=c.getImageData(0,0,layer.width,layer.height),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const excess=d[i+1]-Math.max(d[i],d[i+2]);if(d[i+1]>90&&excess>30){d[i+3]=Math.round(255*(1-clamp((excess-30)/65,0,1)));d[i+1]=Math.min(d[i+1],Math.max(d[i],d[i+2])+10);}}c.putImageData(pixels,0,0);
 const cw=Math.floor(layer.width/2),ch=Math.floor(layer.height/3);
 for(const [i,kind] of ['ap','he','charge','shield','repair','weapon'].entries()){
  const x0=i%2*cw,y0=Math.floor(i/2)*ch;let left=cw,top=ch,right=0,bottom=0;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(d[((y0+y)*layer.width+x0+x)*4+3]>30){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<=left||bottom<=top)continue;const sprite=document.createElement('canvas');sprite.width=right-left+3;sprite.height=bottom-top+3;sprite.getContext('2d').drawImage(layer,x0+left,y0+top,right-left+1,bottom-top+1,1,1,right-left+1,bottom-top+1);supplySprites[kind]=spriteLevels(sprite);
 }
};supplyImage.src='assets/supply-modules.png';
function drawSupplyArt(kind,x,y,size){
 const levels=supplySprites[kind]||(['emp','overdrive'].includes(kind)?supplySprites.charge:null),source=levels?.filter(img=>img.width>=size*Math.min(devicePixelRatio||1,2)).at(-1)||levels?.[0];
 if(source){const h=size*source.height/source.width;ctx.drawImage(source,x-size/2,y-h/2,size,h);if(['emp','overdrive'].includes(kind)){const icon=uiIcons[itemIcons[kind]];if(icon?.naturalWidth){rounded(x+size*.12,y-size*.4,size*.45,size*.45,2,kind==='emp'?'#574536':'#39354d');ctx.drawImage(icon,x+size*.17,y-size*.35,size*.35,size*.35);}}}
 else if(kind==='recruit'&&sprites[0]){const img=sprites[0],h=size*img.height/img.width;ctx.drawImage(img,x-size/2,y-h/2,size,h);}
 else{const img=uiIcons[itemIcons[kind]];if(img?.naturalWidth)ctx.drawImage(img,x-size*.3,y-size*.3,size*.6,size*.6);}
}
function supplyPreview(box){
 const n=(value,max)=>Math.max(0,Math.min(value,max));
 if(box.kind==='repair'){const gain=n(30,s.maxHp-s.hp);return [gain?'耐久 +'+Math.ceil(gain):'耐久已滿','修復主機',!gain];}
 if(box.kind==='shield'){const gain=n(box.drop?20:35,s.maxHp-s.shield);return [gain?'裝甲 +'+Math.ceil(gain):'裝甲已滿','吸收一般傷害',!gain];}
 if(box.kind==='charge'){const gain=n(1,2-s.charges);return [gain?'戰術 +1':'戰術已滿',`${s.charges} / 2 次`,!gain];}
 if(box.kind==='recruit'){const gain=n(1,s.maxCount-s.count);return [gain?'僚機 +1':'編隊已滿',`${s.count} / ${s.maxCount} 機`,!gain];}
 if(box.kind==='weapon')return s.level<8?['LV.'+s.level+' → '+(s.level+1),'主砲／機槍強化',false]:['急速裝填 6s','火控已滿級',false];
 if(box.kind==='ap')return [s.ammo==='ap'?'已裝備':'直擊 ×1.4','慢裝填 · 無爆區',s.ammo==='ap'];
 if(box.kind==='he')return [s.ammo==='he'?'已裝備':'爆破範圍 165','直擊 ×0.8',s.ammo==='he'];
 return [box.kind==='emp'?'壓制火力 140':'急速裝填 7s',box.kind==='emp'?'中斷敵方蓄力':'提高射速',false];
}
function rewardFeedback(e){
 const a=e.after,b=e.before;if(!a||!b)return;
 let id='weaponlevel',message=s.arena?arenaItemName(e.kind):itemNames[e.kind];
 if(e.kind==='repair'){id='shield';message=a.hp>b.hp?'耐久 +'+Math.ceil(a.hp-b.hp):'耐久已滿';}
 else if(e.kind==='shield'){id='shield';message=a.shield>b.shield?'裝甲 +'+Math.ceil(a.shield-b.shield):'裝甲已滿';}
 else if(e.kind==='charge'){id='tactical';message=a.charges>b.charges?'戰術 +1':'戰術已滿';}
 else if(e.kind==='recruit'){id='count';message=a.count>b.count?'僚機 +'+(a.count-b.count):'編隊已滿';}
 else if(e.kind==='weapon')message=a.level>b.level?'火控 LV.'+a.level:s.arena?'火力全開 '+Math.ceil(a.overdrive)+'s':'急速裝填 '+Math.ceil(a.overdrive)+'s';
 else if(e.kind==='overdrive')message='急速裝填 '+Math.ceil(a.overdrive)+'s';
 else if(['ap','he'].includes(e.kind))message=(a.ammo===b.ammo?'已裝備 ':'已換裝 ')+itemNames[e.kind];
 const target=$(id);target.dataset.reward=message;target.classList.remove('reward-pulse');void target.offsetWidth;target.classList.add('reward-pulse');
 rewardFx.push({kind:e.kind,x:e.x,y:e.y,id,age:0});if(rewardFx.length>6)rewardFx.shift();
}
function makeRig(img,index){
 const pieces=[];
 function part(points,px,py,kind,side=0,order=0){
  const layer=document.createElement('canvas');layer.width=img.width;layer.height=img.height;
  const c=layer.getContext('2d');c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*img.width,y*img.height):c.moveTo(x*img.width,y*img.height));c.closePath();c.clip();c.drawImage(img,0,0);
  pieces.push({img:layer,levels:null,px,py,kind,side,order});
 }
 const allied=index<2||index===6||index===7,edge=index===12?.44:index>=6?.32:index<2?.36:index===2?.35:.32,rows=index===12?1:index===13||index===14?2:index===10?2:index===8?4:index===7||index===9?3:allied||index===4?2:3,start=index===12?.60:index>=6?.25:index<2?.22:.32;
 for(let row=0;row<rows;row++)for(const side of [-1,1]){
  const top=start+(1-start)*row/rows,bottom=start+(1-start)*(row+1)/rows,l=side<0?0:1-edge,r=side<0?edge:1;
  part([[l,top],[r,top],[r,bottom],[l,bottom]],side<0?edge:1-edge,top+.06,'leg',side,row);
 }
 part([[0,0],[1,0],[1,start],[1-edge,start],[1-edge,1],[edge,1],[edge,start],[0,start]],.5,.55,'body');
 if(allied){
  const body=pieces[pieces.length-1];body.img.getContext('2d').clearRect(img.width*.43,0,img.width*.15,img.height*.37);
  part([[.43,0],[.58,0],[.58,.37],[.43,.37]],.5,.37,'barrel');
 }else if(index===8||index===9||index===10||index===14){const body=pieces[pieces.length-1];body.img.getContext('2d').clearRect(img.width*.44,img.height*.57,img.width*.12,img.height*.43);part([[.44,.57],[.56,.57],[.56,1],[.44,1]],.5,.57,'barrel');}
 for(const piece of pieces)piece.levels=spriteLevels(piece.img);
 return pieces;
}
function drawSprite(index,x,y,height,phase=0,hit=0,entity=null,death=0){
 const allied=index<2||index===6||index===7,p=point(x,y),h=height*p.scale,rig=rigs[index],img=sprites[index];
 const walk=entity?(entity.walk||0)+(entity.phase||0): s.walk+phase,stopped=death>0||allied&&s.machine==='m4a3'&&s.brace>=.45||entity&&(entity.charging>0||entity.stagger>0||entity.type==='boss'&&entity.y>=450&&entity.ram<=0||['shield','scout','artillery'].includes(entity.type)&&entity.y>=280);
 const gait=stopped?0:Math.sin(walk),recoil=entity?entity.recoil:clamp(muzzle/.11,0,1);
 const rail=index===10?s.hazards.find(h=>h.source===entity?.id&&h.kind==='mortar'&&!h.launched&&!h.fired):[8,9].includes(index)?s.hazards.find(h=>h.source===entity?.id&&(index===8?h.kind==='heavy':['sweep','rail'].includes(h.kind))&&!h.fired):null,bracing=rail?clamp(1-rail.delay/rail.maxDelay,0,1):0;
 const main=allied&&Math.abs(x-s.x)<1&&Math.abs(y-792)<3,blade=main?bladeFx[bladeFx.length-1]:null,stroke=blade?Math.sin(Math.PI*clamp(blade.age/.26,0,1)):0,plant=allied&&s.machine==='m4a3'?clamp(s.brace/.45,0,1):0;
 const charge=entity?.charging>0?clamp((1-entity.charging)/.84,0,1):0,stagger=entity?.type==='charger'&&(entity.stagger>0||entity.retreat);
 ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha*=1-death;
 if(index===9){ctx.save();ctx.translate(0,-h*.2);ctx.scale(1,.3);const shadow=ctx.createRadialGradient(0,0,h*.08,0,0,h*.42);shadow.addColorStop(0,'#02091099');shadow.addColorStop(1,'#02091000');ctx.fillStyle=shadow;ctx.fillRect(-h*.42,-h*.42,h*.84,h*.84);ctx.restore();}else{ctx.save();ctx.translate(1,h*.04);ctx.scale(1,.26);const shadow=ctx.createRadialGradient(0,0,h*.07,0,0,h*.42);shadow.addColorStop(0,'#02091088');shadow.addColorStop(.5,'#02091055');shadow.addColorStop(1,'#02091000');ctx.fillStyle=shadow;ctx.fillRect(-h*.42,-h*.42,h*.84,h*.84);ctx.restore();}
 if(rig&&img){
  const w=h*img.width/img.height*(index<2&&s.machine==='m4a3'?1.4:1),tilt=allied?clamp(s.velocity/720,-1,1)*-.08:entity?.type==='charger'?chargerHeading(entity):0;
  if(index<2&&s.machine==='m4a3')ctx.filter='sepia(.45) saturate(.65)';if(index<2&&s.machine==='xm2')ctx.filter='brightness(1.7) saturate(.4)';ctx.rotate(tilt);const reaction=entity&&hitResponses.find(fx=>fx.id===entity.id),kick=reaction&&motion?Math.sin(reaction.age/.22*Math.PI*2)*Math.exp(-reaction.age*15)*reaction.power:0;ctx.translate(entity?.type==='boss'?0:kick*.65,Math.abs(gait)*-h*.012+charge*h*.04-(entity?.type==='boss'?0:kick*Math.min(4,h*.035)));
  for(const part of rig){
   let texture=part.img;for(const level of part.levels)if(level.height>=h*Math.min(devicePixelRatio||1,2))texture=level;
   const wave=Math.sin(walk+part.order*Math.PI*.8+(part.side<0?0:Math.PI)),stride=stopped?0:wave;
   let angle=0,dx=0,dy=0;
   if(part.kind==='leg'){angle=stride*.10*part.side+charge*.16*part.side+bracing*.07*part.side;dy=-Math.max(0,stride)*h*.04;dx=bracing*part.side*h*.025;if(index===4){const settle=entity?.stagger?clamp(entity.stagger/(entity.staggerDuration||1.5),0,1):entity?.retreat?1:0;angle=part.order===1?(-charge*.4+(entity?.dashing?.38:0)+settle*.32)*part.side:charge*.2*part.side+stride*.06;dx=(charge*.01+settle*.01)*part.side*h;dy=settle*h*.035+(entity?.dashing?(part.order===1?.02:-.01)*h:0);}}
   if(allied&&part.kind==='leg'){angle+=plant*.09*part.side;dx+=plant*part.side*h*.026;if(main&&part.order===0){angle+=stroke*.5*part.side;dy-=stroke*h*.045;}}
   if(part.kind==='thigh'){angle=stride*.22;dy=stride*h*.03;}
   if(part.kind==='shin'){angle=stride*.28;dx=stride*h*.012;dy=stride*h*.055;}
   if(part.kind==='body'){if(index===4){const recover=entity?.stagger?clamp(entity.stagger/(entity.staggerDuration||1.5),0,1):entity?.retreat?1:0;angle=recover*.07;dx=recover*h*.025;}dy=recoil*h*(allied?.018:-.022)+bracing*h*.013+(stagger?h*.035:0)+plant*h*.018-stroke*h*.012;if(entity?.type==='boss'){dx+=kick*.65;dy-=kick*Math.min(4,h*.035);}}
   if(part.kind==='barrel'){dy=recoil*h*(index===9?.085:allied&&shotBoost==='brace'?.08:.055)*(allied?1:-1)+bracing*h*.013;if(index===8){const gun=dinoGun(entity);angle=gun.angle;const travel=-gun.recoil+bracing*h*.013;dx=-Math.sin(angle)*travel;dy=Math.cos(angle)*travel;}}
   if(death){dx+=part.side*death*h*.75;dy+=death*h*(part.kind==='body'?.4:.15);angle+=death*(part.side||1)*1.8;}
   const px=(part.px-.5)*w,py=(part.py-.8)*h;
   ctx.save();ctx.translate(px+dx,py+dy);ctx.rotate(angle);ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);
   if(index===8&&part.kind==='body'&&bracing>.55){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=(bracing-.55)*.32;ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);ctx.restore();}
   if(main&&part.kind==='barrel'&&muzzle>0&&shotBoost==='momentum'){ctx.globalCompositeOperation='screen';ctx.globalAlpha*=muzzle/.14*.2;ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);}
   if(hit>0||index===4&&part.kind==='leg'&&part.order===1&&(charge>0||entity?.dashing)){ctx.globalCompositeOperation='screen';ctx.globalAlpha*=hit>0?.35:entity?.dashing?.3:charge*.18;ctx.drawImage(texture,-part.px*w,-part.py*h,w,h);}ctx.restore();
  }
 }else if(img){ctx.drawImage(img,-h*.4,-h*.8,h*.8,h);}
 ctx.restore();
}
function drawGate(g){
 const a=point(g.x-138,g.y),b=point(g.x+138,g.y),h=Math.max(27,70*a.scale),used=g.used,col=used?'#5095a05a':'#73e8ff';
 if(!used){const fill=ctx.createLinearGradient(0,a.y-h,0,a.y);fill.addColorStop(0,'#44bdeb42');fill.addColorStop(.5,'#39c5ff18');fill.addColorStop(1,'#65e8ff55');ctx.fillStyle=fill;ctx.fillRect(a.x,a.y-h,b.x-a.x,h);}
 for(let i=1;i<7;i++)line({x:a.x+(b.x-a.x)*i/7,y:a.y-h},{x:a.x+(b.x-a.x)*i/7,y:a.y},'#8bebff17');
 for(let i=1;i<4;i++)line({x:a.x,y:a.y-h*i/4},{x:b.x,y:a.y-h*i/4},'#8bebff17');
 for(const p of [a,b]){rounded(p.x-5,a.y-h-5,10,h+10,2,'#122137');line({x:p.x,y:p.y-h},{x:p.x,y:p.y},col,3);ctx.fillStyle=col;ctx.fillRect(p.x-3,p.y-h-1,6,5);}
 line({x:a.x,y:a.y-h},{x:b.x,y:b.y-h},col,1);line(a,b,col,2);
 const value=C.gateValue(g.base,g.hits,g.cap);label(`+${value}`,(a.x+b.x)/2,a.y-h*.34,Math.max(22,34*a.scale),used?'#74a5b280':'#c6f8ff',900);
 if(!used)label(value===(g.cap||6)?'增援已充滿':`射擊加人 · 上限 +${g.cap||6}`,(a.x+b.x)/2,a.y-h-11,Math.max(8,10*a.scale),'#b0e5f4');
}
function supplyCardLayout(box){
 const p=point(box.x,box.y),width=W<500?96:118,height=H<520?82:98,formation=C.formation(s),front=Math.min(...formation.map(unit=>{const q=point(unit.x,unit.y);return q.y-Math.max(65,W*.105)*(unit.main?1:.82)*q.scale*.8;})),boss=$('bossbar'),ceiling=boss.hidden?18:boss.offsetTop+boss.offsetHeight+12;
 const side=box.x<500?-1:1,x=W>700&&H<620?(side<0?width/2+24:W-width/2-24):clamp(W/2+side*Math.max(Math.abs(p.x-W/2),width/2+5),width/2+8,W-width/2-8),top=Math.max(ceiling,front-14-height);
 return {x,top,width,height,front,world:p};
}
function drawCrate(box,ghost=false,info=false){
 const p=point(box.x,box.y),near=box.y>=420&&!box.drop,selected=!ghost&&Math.abs(s.x-box.x)<80&&(box.readable||box.drop),[benefit,detail,full]=supplyPreview(box),col=full?'#94a7b0':selected?'#d2f1ed':'#91b5ca';
 if(info&&!near)return;ctx.save();ctx.globalAlpha=(ghost?box.life/.25:1)*(box.readable||box.drop?1:.62);
 if(info){const card=supplyCardLayout(box),{x,top,width,height}=card,size=height<90?25:34;
  line({x,y:top+height},{x:p.x,y:p.y-16},selected?'#9fd0c6aa':'#59778688',1);
  rounded(x-width/2,top,width,height,4,selected?'#172f3df5':'#0b1824f0');ctx.strokeStyle=selected?'#b8dfdd':'#527080';ctx.lineWidth=selected?1.5:1;ctx.stroke();line({x:x-width/2+10,y:top+1},{x:x+width/2-10,y:top+1},col,2);
  label(itemNames[box.kind]||'補給',x,top+15,11,col,600);drawSupplyArt(box.kind,x,top+19+size/2,size);label(benefit,x,top+height-22,W<500?13:15,full?'#a2b4bc':'#ecf4f5',800);label(detail,x,top+height-7,10,'#9fb5c3',500);
 }else{
  const size=near?30:Math.max(28,43*p.scale);ctx.fillStyle='#020a1266';ctx.beginPath();ctx.ellipse(p.x,p.y-8,size*.48,6,0,0,7);ctx.fill();drawSupplyArt(box.kind,p.x,p.y-22,size);
  if(box.drop)label(benefit,p.x,p.y+3,11,col,600);else if(!near)label(itemNames[box.kind]||'補給',p.x,p.y+1,11,col,600);
  const q=point(box.x,815),half=80*W*.00077*q.scale;
  if(!ghost){line({x:q.x-half,y:q.y+10},{x:q.x+half,y:q.y+10},selected?'#d7eee8':'#8aadb966',selected?3:1);for(const dx of [-half,half])line({x:q.x+dx,y:q.y+6},{x:q.x+dx,y:q.y+13},col,1);}
  if(selected&&near)polygon([{x:p.x-4,y:p.y+3},{x:p.x+4,y:p.y+3},{x:p.x,y:p.y+8}],col);
 }
 ctx.restore();
}
function drawRewards(){
 const arena=canvas.getBoundingClientRect();
 for(const fx of rewardFx){if(fx.age>.65)continue;const p=point(fx.x,fx.y-45),r=$(fx.id).getBoundingClientRect(),f=clamp(fx.age/.65,0,1),ease=1-(1-f)**3;
  ctx.save();ctx.globalAlpha=1-f;const x=motion?p.x+(r.x+r.width/2-arena.x-p.x)*ease:p.x,y=motion?p.y+(r.y+r.height/2-arena.y-p.y)*ease:p.y;drawSupplyArt(fx.kind,x,y,46*(1-f*.55));ctx.restore();
 }
}
function bossPort(e,part){
 const h=enemyVisual('boss',e.model).size*point(e.x,e.y).scale;
 const rail=s.hazards.find(v=>v.source===e.id&&['sweep','rail'].includes(v.kind)&&!v.fired),brace=rail?clamp(1-rail.delay/rail.maxDelay,0,1):0,y=e.y+(Number.isInteger(part)?-h*.2:h*(.2-(e.recoil||0)*.085+brace*.013))/(H*.0008);return {x:Number.isInteger(part)?e.x+(part?105:-105):500+(point(e.x,e.y).x-W/2)/(W*.00077*point(500,y).scale),y};
}
function chargerHeading(e){
 if(!(e.charging>0)&&!e.dashing&&!e.retreat&&!e.stagger)return 0;
 const from=point(e.dashing||e.retreat||e.stagger?e.dashFromX??e.x:e.x,e.dashing||e.retreat||e.stagger?e.dashFromY??e.y:e.y),target=point(e.chargeX,795),turn=e.charging>0?clamp((1-e.charging)*3,0,1):e.stagger?clamp(e.stagger/(e.staggerDuration||1.5),0,1):1;
 return -Math.atan2(target.x-from.x,target.y-from.y)*turn;
}
function drawChargerWarning(e){
 if(e.dead||!(e.charging>0)&&!e.dashing)return;const a=point(e.x,e.y),b=point(e.chargeX,805),r=(e.r+65)*W*.00077*b.scale,progress=e.dashing?1:clamp(1-e.charging,0,1);
 ctx.save();ctx.globalAlpha=e.dashing?.85:.6;ctx.setLineDash(e.dashing?[]:[3,6]);line(a,b,e.dashing?'#f6d8ac':'#d6b590',1.2);ctx.setLineDash([]);ctx.strokeStyle='#eec299';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(b.x,b.y,r,9,0,0,Math.PI*2);ctx.stroke();
 line({x:b.x-r,y:b.y},{x:b.x-r+2*r*progress,y:b.y},'#f3d3ad',2);for(const side of [-1,1])line({x:b.x+side*r,y:b.y-6},{x:b.x+side*r,y:b.y+6},'#f3d3ad',1);
 if(Number.isFinite(e.chargeDecoyX)){ctx.setLineDash([2,6]);line(a,point(e.chargeDecoyX,770),'#a8e4e5',1);}
 ctx.restore();
}
function drawChargerGround(){
 for(const fx of chargerFx){const p=point(fx.x,fx.y),h=enemyVisual('charger').size*p.scale,fade=clamp(1-fx.age/.75,0,1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(fx.angle);ctx.globalAlpha=fade;
  for(const side of [-1,1]){const x=side*h*.28;line({x,y:-23},{x:x+side*3,y:3},'#080f16',3);line({x:x+1,y:-18},{x:x+side*3+1,y:2},'#a1acac',.7);}
  const puff=smokeArt.whitePuff03;if(fx.age>.06&&puff?.complete&&puff.naturalWidth){const spread=motion?clamp((fx.age-.06)/.24,0,1):.6;ctx.globalAlpha=fade*.24;for(const side of [-1,1]){const width=28+spread*26;ctx.drawImage(puff,side*(h*.23+spread*10)-width/2,-11-spread*9,width,18+spread*12);}}
  ctx.restore();
 }
}
function drawChargerSystems(e){
 const p=point(e.x,e.y),h=enemyVisual('charger').size*p.scale;
 ctx.save();
 if(e.dashing){const duration=Math.max(.01,e.dashDuration),tail=point(e.x-(e.chargeX-e.dashFromX)/duration*.07,e.y-(795-e.dashFromY)/duration*.07);ctx.globalAlpha=.65;for(const side of [-1,1])line({x:tail.x+side*h*.27,y:tail.y-h*.1},{x:p.x+side*h*.27,y:p.y},'#c6d7df',Math.max(1,h*.018));}
 if(e.stagger>0){const r=Math.max(19,h*.4),y=p.y-h*.45,f=clamp(e.stagger/(e.staggerDuration||1.5),0,1);ctx.strokeStyle='#eac58d';ctx.lineWidth=1.5;for(const side of [-1,1]){line({x:p.x+side*r,y:y-5},{x:p.x+side*r,y:y+5},'#eac58d',1.5);line({x:p.x+side*r,y:y-5},{x:p.x+side*(r-4),y:y-5},'#eac58d',1.5);}line({x:p.x-r,y:p.y+12},{x:p.x-r+2*r*f,y:p.y+12},'#eac58d',2);}
 ctx.restore();
}
function bossTurretSize(model){return Math.max(model==='morpho'?40:38,W*.042);}
function dinoGun(e,part){
 const p=point(e.x,e.y),h=enemyVisual('boss','dinosauria').size*p.scale,side=Number.isInteger(part),size=bossTurretSize('dinosauria'),pending=s.hazards.find(v=>v.source===e.id&&(side?v.partIndex===part:v.kind==='heavy'));
 const charging=pending&&!pending.fired?clamp(1-pending.delay/pending.maxDelay,0,1):0;
 const pivot=side?{x:point(e.x+(part?105:-105),e.y).x,y:p.y-size*.5+8}:{x:p.x,y:p.y-h*.23};
 const aim=point(pending?.x??(side?(part?795:205):e.x),805),turn=pending?(pending.fired?clamp(pending.life/.3,0,1):clamp(charging*4,0,1)):0,angle=-Math.atan2(aim.x-pivot.x,aim.y-pivot.y)*turn;
 const recoil=pending?.fired?clamp(pending.life/.3,0,1)*(side?6:h*.055):0,length=side?size*.5-recoil:h*.43-recoil+charging*h*.013;
 const muzzle={x:pivot.x-Math.sin(angle)*length,y:pivot.y+Math.cos(angle)*length};return {pivot,muzzle,angle,recoil,charge:charging,worldY:(muzzle.y/H-.1)/.0008};
}
function drawDinoSystems(e){
 const p=point(e.x,e.y),h=enemyVisual('boss','dinosauria').size*p.scale;
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const part of [undefined,0,1]){if(Number.isInteger(part)&&e.nodes[part]<=0)continue;const gun=dinoGun(e,part);if(gun.charge<=0)continue;const q=gun.muzzle,r=Math.max(7,h*(Number.isInteger(part)?.045:.07))*(.45+gun.charge),glow=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r);glow.addColorStop(0,`rgba(245,214,164,${gun.charge*.6})`);glow.addColorStop(.3,'#d9954833');glow.addColorStop(1,'#c47b2900');ctx.fillStyle=glow;ctx.fillRect(q.x-r,q.y-r,r*2,r*2);}
 if(e.exposed>0){const y=p.y-h*.26,w=Math.max(26,h*.17),f=e.nodes.every(n=>n<=0)?1:clamp(e.exposed/1.5,0,1);ctx.globalCompositeOperation='source-over';const glow=ctx.createRadialGradient(p.x,y,0,p.x,y,w);glow.addColorStop(0,'#ffdb9b88');glow.addColorStop(1,'#e8a24c00');ctx.fillStyle=glow;ctx.fillRect(p.x-w,y-w,w*2,w*2);for(const side of [-1,1]){const x=p.x+side*w*.6;line({x,y:y-7},{x,y:y+7},'#171e27',5);line({x,y:y-7},{x,y:y+7},'#ffe0a4',2);line({x,y:y-7},{x:x-side*6,y:y-7},'#ffe0a4',2);}line({x:p.x-w/2,y:y+13},{x:p.x+w/2,y:y+13},'#342b25',4);line({x:p.x-w/2,y:y+13},{x:p.x-w/2+w*f,y:y+13},'#f3d19a',2);}
 ctx.restore();
}
function drawShellBursts(){
 for(const fx of shellBursts){const f=clamp(1-fx.age/.8,0,1),source=point(fx.x,fx.y),target=point(fx.targetX,805),side=Number.isInteger(fx.partIndex),r=Math.max(side?18:28,W*(side?.03:.045)),frame=explosionFrames[Math.min(31,Math.max(0,Math.floor((fx.age-.035)/.4*32)))];ctx.save();ctx.globalCompositeOperation='screen';
  if(fx.age<.14){const k=1-fx.age/.14,tail={x:source.x+(target.x-source.x)*.6,y:source.y+(target.y-source.y)*.6};line(tail,target,`rgba(240,190,112,${k*.3})`,side?7:11);line(tail,target,`rgba(255,242,211,${k})`,side?1.5:2.4);}
  if(fx.age>=.035&&fx.age<.435&&frame?.naturalWidth){ctx.globalAlpha=Math.min(1,(fx.age-.035)/.045)*(.435-fx.age)/.4*.85;ctx.drawImage(frame,target.x-r,target.y-r*.65,r*2,r*1.35);}
  if(fx.age<.16){const power=1-fx.age/.16,length=r*(side?.95:1.25),width=r*.19;ctx.save();ctx.globalAlpha=power;ctx.translate(source.x,source.y);ctx.rotate(-Math.atan2(target.x-source.x,target.y-source.y));const flame=ctx.createLinearGradient(0,-3,0,length);flame.addColorStop(0,'#fff8e9');flame.addColorStop(.2,'#ffe2a9dd');flame.addColorStop(1,'#ef9f3800');polygon([{x:-width,y:-2},{x:width,y:-2},{x:width*.55,y:length*.45},{x:0,y:length},{x:-width*.55,y:length*.45}],flame);line({x:0,y:-2},{x:0,y:length*.55},'#fff4d8',Math.max(1,width*.3));ctx.restore();}
  ctx.globalCompositeOperation='source-over';if(fx.age>.09&&smokeArt.whitePuff14.naturalWidth){const rise=clamp((fx.age-.09)/.55,0,1),size=r*(1.2+rise*2);ctx.globalAlpha=(1-rise)*.32;ctx.drawImage(smokeArt.whitePuff14,target.x-size/2,target.y-size*.15,size,size*.3);}ctx.globalAlpha=f*.22;const shock=1-f;ctx.strokeStyle='#c5a580';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(target.x,target.y,Math.max(1,r*(.5+shock*1.5)),Math.max(1,r*(.12+shock*.25)),0,0,7);ctx.stroke();ctx.restore();
 }
}
function drawArmorBreaks(){
 for(const fx of armorBreaks){const p=point(fx.x,fx.y),side=fx.index?1:-1,t=fx.age,flight=clamp((t-.055)/.42,0,1),ease=1-(1-flight)**2,size=bossTurretSize(fx.model),fade=clamp((1.35-t)/.35,0,1);ctx.save();
  if(t>.04&&turretSprite){const dx=motion?side*ease*Math.max(19,W*.027):side*8,dy=motion?flight*flight*27-Math.sin(flight*Math.PI)*17:13;ctx.globalAlpha=fade;ctx.translate(p.x+dx,p.y+dy);ctx.rotate(motion?side*ease*.8:side*.45);ctx.filter='brightness(.58) saturate(.45)';const cut=turretSprite.height*.4,tw=size*560/755;ctx.drawImage(turretSprite,0,cut,turretSprite.width,turretSprite.height-cut,-tw/2,-size*.3,tw,size*.6);ctx.filter='none';}
  ctx.restore();ctx.save();
  if(t<.16){ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-t/.16)*.5;const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,size*.8);glow.addColorStop(0,'#fff2ce');glow.addColorStop(.2,'#ffca7777');glow.addColorStop(1,'#d9801700');ctx.fillStyle=glow;ctx.fillRect(p.x-size,p.y-size,size*2,size*2);ctx.globalCompositeOperation='source-over';}
  for(let i=0;i<3;i++){const age=t-i*.105;if(age<0)continue;const life=clamp(age/1.05,0,1),cloud=smokeArt[i===1?'blackSmoke15':'blackSmoke05'],w=size*(.45+life*1.1);if(cloud.naturalWidth){ctx.globalAlpha=Math.sin(life*Math.PI)*.47*fade;const lift=motion?life*size*.7:0;ctx.drawImage(cloud,p.x-w/2+side*life*9,p.y-w*.55-lift,w,w*.92);}}
  if(t>.2&&t<.65&&smokeArt.whitePuff03.naturalWidth){ctx.globalAlpha=Math.sin((t-.2)/.45*Math.PI)*.23;const w=size*1.3;ctx.drawImage(smokeArt.whitePuff03,p.x+side*22-w/2,p.y+15,w,w*.28);}
  ctx.restore();
 }
}
function drawMorphoSystems(e){
 const p=point(e.x,e.y),h=enemyVisual('boss','morpho').size*p.scale,rail=s.hazards.find(h=>h.source===e.id&&['sweep','rail'].includes(h.kind)&&!h.fired),port=bossPort(e),m=point(port.x,port.y),charge=rail?clamp(1-rail.delay/rail.maxDelay,0,1):0;
 ctx.save();ctx.globalCompositeOperation='screen';
 if(rail){
  for(let i=0;i<7;i++){const y=p.y-h*.52+i*h*.095,lit=charge>i/8,a=lit?.45+.35*Math.sin(s.time*19-i):.09;ctx.fillStyle=`rgba(140,211,238,${a})`;for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(p.x+side*h*.034,y,2+charge*2,h*.021,0,0,7);ctx.fill();}}
  const r=Math.max(14,h*.13)*(.3+charge),glow=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,r);glow.addColorStop(0,'#e8faff');glow.addColorStop(.15,'#a8e0fbbb');glow.addColorStop(.5,'#55a1df44');glow.addColorStop(1,'#477ac000');ctx.globalAlpha=.25+charge*.65;ctx.fillStyle=glow;ctx.fillRect(m.x-r,m.y-r,r*2,r*2);
 }
 if(e.exposed>0){const y=p.y-h*.32,r=Math.max(12,h*.1),glow=ctx.createRadialGradient(p.x,y,0,p.x,y,r);glow.addColorStop(0,'#fff1c9dd');glow.addColorStop(.3,'#e9aa6566');glow.addColorStop(1,'#d47e2700');ctx.globalAlpha=.7;ctx.fillStyle=glow;ctx.fillRect(p.x-r,y-r,r*2,r*2);ctx.globalCompositeOperation='source-over';ctx.strokeStyle='#ecd5a7';ctx.lineWidth=1.5;for(const side of [-1,1]){line({x:p.x+side*r,y:y-5},{x:p.x+side*r,y:y+5},'#ecd5a7',1.5);line({x:p.x+side*r,y:y-5},{x:p.x+side*(r-4),y:y-5},'#ecd5a7',1.5);}line({x:p.x-r,y:y+r},{x:p.x-r+2*r*clamp(e.exposed/2.2,0,1),y:y+r},'#eac18e',2);}
 ctx.restore();
}
function drawRailBursts(){
 for(const fx of railBursts){const fade=Math.max(0,1-fx.age/.45),head=point(fx.x,fx.y);ctx.save();
  for(const band of fx.ranges){const a=point(band.x-band.width/2,fx.y),b=point(band.x+band.width/2,fx.y),c=point(band.x+band.width/2,1050),d=point(band.x-band.width/2,1050);ctx.save();ctx.beginPath();[a,b,c,d].forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();if(!fx.focused)ctx.clip();ctx.globalCompositeOperation='screen';
   const count=Math.max(1,Math.ceil(band.width/220));
   for(let i=0;i<count;i++){const x=band.x-band.width/2+band.width*(i+.5)/count,aim=point(x,805),bottom=point(x,1050),extension=(bottom.y-head.y)/Math.max(1,aim.y-head.y),end=fx.focused?{x:head.x+(aim.x-head.x)*extension,y:bottom.y}:bottom,w=Math.max(6,W*.012)*fade;
    const beam=ctx.createLinearGradient(head.x,head.y,end.x,end.y);beam.addColorStop(0,`rgba(204,239,255,${fade*.9})`);beam.addColorStop(.5,`rgba(100,187,250,${fade*.65})`);beam.addColorStop(1,'#499ade00');ctx.strokeStyle=beam;ctx.lineWidth=w*2.6;ctx.beginPath();ctx.moveTo(head.x,head.y);ctx.lineTo(end.x,end.y);ctx.stroke();line(head,end,`rgba(147,218,255,${fade*.7})`,w);line(head,end,`rgba(241,250,255,${fade*.95})`,Math.max(1,w*.22));
    const frame=explosionFrames[Math.min(31,Math.floor((fx.age+.08+i*.035)/.5*32))];if(frame?.naturalWidth){const hit=point(x,fx.focused?805:855+i%2*65),size=Math.max(27,W*.048)*(1+i*.13);ctx.globalAlpha=fade*.38;ctx.drawImage(frame,hit.x-size/2,hit.y-size*.35,size,size*.5);ctx.globalAlpha=1;}
   }ctx.restore();
  }
  ctx.globalCompositeOperation='screen';const r=Math.max(18,W*.038)*fade,glow=ctx.createRadialGradient(head.x,head.y,0,head.x,head.y,Math.max(1,r));glow.addColorStop(0,'#ffffff');glow.addColorStop(.15,'#d8f3ffff');glow.addColorStop(.4,'#63b9f09a');glow.addColorStop(1,'#386bad00');ctx.fillStyle=glow;ctx.fillRect(head.x-r,head.y-r,r*2,r*2);line({x:head.x-r*1.7,y:head.y},{x:head.x+r*1.7,y:head.y},`rgba(184,224,255,${fade*.5})`,1);ctx.restore();
 }
}
function drawSupport(){
 for(const fx of supportFx){const f=clamp(1-fx.age/.7,0,1);ctx.save();
  if(fx.age<.24){const alpha=(1-fx.age/.24)*.12;polygon([point(fx.x-fx.width/2,80),point(fx.x+fx.width/2,80),point(fx.x+fx.width/2,940),point(fx.x-fx.width/2,940)],`rgba(163,211,224,${alpha})`);}
  for(const h of fx.cancelled){const p=point(h.x,805),r=Math.max(10,h.width*W*.00077*p.scale/2);ctx.globalAlpha=f*.7;line({x:p.x-r*f,y:p.y},{x:p.x+r*f,y:p.y},'#b8ece4',2);for(const side of [-1,1])line({x:p.x+side*r*f,y:p.y-5*f},{x:p.x+side*r*f,y:p.y+5*f},'#b8ece4',1);}
  ctx.globalCompositeOperation='screen';
  for(const hit of fx.hits){const p=point(hit.x,hit.y),size=Math.max(38,W*(hit.part?.075:.095))*p.scale;
   ctx.globalAlpha=f;
   if(fx.age<.18&&motion){const tail={x:p.x-W*.035,y:p.y-H*.22},fade=1-fx.age/.18;line(tail,p,`rgba(161,216,245,${fade*.35})`,6);line(tail,p,`rgba(236,250,255,${fade})`,1.8);}
   if(!hit.killed&&!hit.part){const frame=explosionFrames[Math.min(31,Math.floor((fx.age+.06)/.76*32))];if(frame?.naturalWidth){ctx.globalAlpha=f*.75;ctx.drawImage(frame,p.x-size/2,p.y-size*.6,size,size*.85);}}
   const r=Math.max(4,size*.24)*f;if(r>0){const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);glow.addColorStop(0,'#f3f9fbbb');glow.addColorStop(.3,'#abd8e855');glow.addColorStop(1,'#7bacce00');ctx.globalAlpha=f;ctx.fillStyle=glow;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);}
  }ctx.restore();
 }
}
function drawDecoy(){
 if(state!=='playing'||!s.decoy)return;const d=s.decoy,p=point(d.x,d.y),img=sprites[{m1a4:0,m4a3:6,xm2:7}[s.machine]||0];if(!img)return;
 const h=Math.max(65,W*.105)*p.scale,w=h*img.width/img.height,life=clamp(d.life/4,0,1);
 ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.42*Math.min(1,d.life*3);ctx.drawImage(img,p.x-w/2,p.y-h*.8,w,h);
 const glow=ctx.createLinearGradient(0,p.y-h*.75,0,p.y+6);glow.addColorStop(0,'#79d5ef00');glow.addColorStop(1,'#8bd9e72a');polygon([{x:p.x-w*.35,y:p.y-h*.7},{x:p.x+w*.35,y:p.y-h*.7},{x:p.x+9,y:p.y+5},{x:p.x-9,y:p.y+5}],glow);
 ctx.globalAlpha=.7;ctx.strokeStyle='#a9e5e8';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+5,Math.max(16,w*.48),6,0,-Math.PI/2,-Math.PI/2+Math.PI*2*life);ctx.stroke();
 if(motion){ctx.globalAlpha=.22;const y=p.y-h*.8+h*((effectsClock*.6)%1);line({x:p.x-w*.35,y},{x:p.x+w*.35,y},'#bcebf2',1);}
 ctx.restore();
}
function drawArtilleryFire(){
 if(s.over)return;
 for(const h of s.hazards){if(h.kind!=='mortar'||h.fired||h.launched)continue;const artillery=s.enemies.find(e=>e.id===h.source),scout=h.linkedTo?s.enemies.find(e=>e.id===h.linkedTo):null;if(!artillery)continue;
  const a=point(artillery.x,artillery.y),target=point(h.x,805),charge=clamp(1-h.delay/h.maxDelay,0,1);ctx.save();ctx.globalAlpha=.4;ctx.setLineDash([3,7]);
  if(scout){const b=point(scout.x,scout.y);line(a,b,'#aac3d1',1);line(b,target,'#dfb789',1);ctx.setLineDash([]);const t=(s.time*1.5)%1;ctx.fillStyle='#e3c496';ctx.beginPath();ctx.arc(b.x+(target.x-b.x)*t,b.y+(target.y-b.y)*t,2,0,7);ctx.fill();}
  ctx.setLineDash([]);const muzzleY=a.y+enemyVisual('artillery').size*a.scale*.2;ctx.globalAlpha=.3+charge*.4;line({x:a.x-4,y:muzzleY},{x:a.x+4,y:muzzleY},'#e7c59a',1.5);ctx.restore();
 }
 for(const h of s.hazards){if(h.kind!=='mortar'||!h.launched||h.fired)continue;const fx={...h,duration:h.flightDuration,age:h.flightDuration-h.delay},a=point(fx.fromX,fx.fromY),b=point(fx.x,fx.y),f=clamp(fx.age/fx.duration,0,1),startY=a.y+enemyVisual('artillery').size*a.scale*.2,arc=Math.min(150,H*.16),at=t=>({x:a.x+(b.x-a.x)*t,y:startY+(b.y-startY)*t-Math.sin(t*Math.PI)*arc}),p=at(f),tail=at(Math.max(0,f-.11));
  ctx.save();ctx.globalCompositeOperation='screen';line(tail,p,'#e5ba7877',4);line(tail,p,'#fff1d0',1.6);ctx.fillStyle='#fff5db';ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,7);ctx.fill();if(fx.age<.09){ctx.globalAlpha=1-fx.age/.09;polygon([{x:a.x-3,y:startY},{x:a.x+3,y:startY},{x:a.x+5,y:startY+10},{x:a.x,y:startY+20},{x:a.x-5,y:startY+10}],'#ffe2ab');}ctx.restore();
 }
 for(const fx of fireLinkFx){const p=point(fx.x,805),f=1-fx.age/.4,rx=fx.width/2*W*.00077*p.scale;ctx.save();ctx.globalAlpha=f*.7;ctx.setLineDash([4,6]);ctx.strokeStyle='#bdd8d7';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,rx*f),Math.max(2,H*.027*f),0,0,7);ctx.stroke();ctx.setLineDash([]);line({x:p.x-5,y:p.y-5},{x:p.x+5,y:p.y+5},'#d7e5e2',1.5);line({x:p.x+5,y:p.y-5},{x:p.x-5,y:p.y+5},'#d7e5e2',1.5);ctx.restore();}
}
function drawHazards(outlines=false){
 if(s.over)return;
 const linkedDecoys=new Set();
 for(const h of s.hazards){
  if(outlines&&!h.fired&&Number.isFinite(h.decoyX)&&!linkedDecoys.has(h.source)){
   const source=s.enemies.find(e=>e.id===h.source);if(source){const origin=source.type==='boss'?bossPort(source,h.partIndex):source,a=point(origin.x,origin.y),b=point(h.decoyX,770);ctx.save();ctx.globalAlpha=.55;ctx.setLineDash([3,7]);line(a,b,'#b9e4e4',1);ctx.restore();linkedDecoys.add(h.source);}
  }
  if(h.model==='dinosauria'){
   const a=point(h.x-h.width/2,h.y),b=point(h.x+h.width/2,h.y),c=point(h.x+h.width/2,1050),d=point(h.x-h.width/2,1050),left=point(h.x-h.width/2,805),right=point(h.x+h.width/2,805),f=clamp(1-h.delay/h.maxDelay,0,1),side=h.kind==='secondary',color=h.fired?'#ffe2b1':side?'#d7b78b':'#eaa68b';
   if(!outlines){const gradient=ctx.createLinearGradient(0,a.y,0,c.y);gradient.addColorStop(0,'#aa714000');gradient.addColorStop(1,h.fired?'#e1aa5733':side?'#b49a5d12':'#b858361c');polygon([a,b,c,d],gradient);}
   ctx.save();ctx.setLineDash(side&&!h.fired?[4,6]:[]);line(a,d,color,h.fired?2:1);line(b,c,color,h.fired?2:1);ctx.setLineDash([]);line(left,right,color,1);if(!h.fired)line(left,{x:left.x+(right.x-left.x)*f,y:left.y},color,3);for(const p of [left,right])line({x:p.x,y:p.y-5},{x:p.x,y:p.y+5},color,1);ctx.restore();continue;
  }
  if(h.model==='morpho'){
   const a=point(h.x-h.width/2,h.y),b=point(h.x+h.width/2,h.y),c=point(h.x+h.width/2,1050),d=point(h.x-h.width/2,1050),f=clamp(1-h.delay/h.maxDelay,0,1),color=h.fired?'#d4ecfc':h.lethal?'#e58f82':'#dfbb88';
   if(!outlines){const shade=ctx.createLinearGradient(0,a.y,0,d.y);shade.addColorStop(0,'#15263900');shade.addColorStop(1,h.fired?'#669ddc18':h.lethal?'#ba4c351b':'#b47b3014');ctx.fillStyle=shade;ctx.beginPath();[a,b,c,d].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
   ctx.setLineDash(h.lethal?[]:[4,5]);line(a,d,color,h.fired?2:1.3);line(b,c,color,h.fired?2:1.3);ctx.setLineDash([]);
   const left=point(h.x-h.width/2,805),right=point(h.x+h.width/2,805);line(left,right,color,h.fired?3:1);
   if(!h.fired){line(left,{x:left.x+(right.x-left.x)*f,y:left.y},color,3);for(const x of [left.x,right.x])line({x,y:left.y-5},{x,y:left.y+5},color,1.3);}
   continue;
  }
  if(h.kind==='mortar'&&h.fired&&!outlines){const p=point(h.x,805),rx=h.width/2*W*.00077*p.scale,ry=Math.max(12,H*.027),fade=clamp(h.life/2.2,0,1);ctx.save();ctx.globalAlpha=fade;ctx.fillStyle='#15120fcc';ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,7);ctx.fill();for(let i=0;i<7;i++){const angle=i*2.4+s.time*.12,x=p.x+Math.cos(angle)*rx*.65,y=p.y+Math.sin(angle)*ry*.65;ctx.fillStyle=i%2?'#c38d5377':'#edb36a99';ctx.fillRect(x,y,2,1);}ctx.restore();}
  if(h.shape==='zone'){
   const p=point(h.x,805),rx=h.width/2*W*.00077*p.scale,ry=Math.max(12,H*.027);
   ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,7);if(!outlines){ctx.fillStyle=h.fired?'#d5863d22':'#f2be6522';ctx.fill();}ctx.strokeStyle=h.fired?'#eeb578':h.launched?'#fff0ce':'#d4b689';ctx.lineWidth=h.launched?2:1.5;ctx.stroke();
   if(!h.fired){ctx.beginPath();ctx.ellipse(p.x,p.y,rx*.72,ry*.72,0,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-h.delay/h.maxDelay,0,1));ctx.stroke();line({x:p.x-5,y:p.y},{x:p.x+5,y:p.y},'#ffe2ba',2);}continue;
  }
  if(h.linkedTo&&!h.fired&&!outlines){const scout=s.enemies.find(e=>e.id===h.source),tank=s.enemies.find(e=>e.id===h.linkedTo);if(scout&&tank){ctx.setLineDash([3,4]);line(point(scout.x,scout.y),point(tank.x,tank.y),'#e8bb8c',1.5);ctx.setLineDash([]);}}
  const a=point(h.x-h.width/2,h.y),b=point(h.x+h.width/2,h.y),c=point(h.x+h.width/2,1050),d=point(h.x-h.width/2,1050);
  if(!outlines)polygon([a,b,c,d],h.fired?'#ffb87b88':`rgba(244,87,46,${.09+.08*(1-h.delay/h.maxDelay)})`);
  ctx.setLineDash(h.lethal||h.fired?[]:[8,6]);line(a,d,h.fired?'#ffe0a2':h.lethal?'#ff675e':'#f29870',h.lethal?3:2);line(b,c,h.fired?'#ffe0a2':h.lethal?'#ff675e':'#f29870',h.lethal?3:2);ctx.setLineDash([]);
  for(let i=0;i<7;i++){const y=350+i*94;const mid=point(h.x,y);const l=point(h.x-34,y+22),r=point(h.x+34,y+22);line(l,mid,h.fired?'#ffedc6':'#fa906177',3);line(mid,r,h.fired?'#ffedc6':'#fa906177',3);}
  if(!h.fired){const p=point(h.x,805);ctx.strokeStyle=h.lethal?'#ff8778':'#efbd7e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,12,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-h.delay/h.maxDelay,0,1));ctx.stroke();}
  const shooter=s.enemies.find(e=>e.id===h.source);if(shooter&&!h.fired){const q=point(shooter.x,shooter.y),radius=(1-h.delay/h.maxDelay)*18+3;ctx.strokeStyle=h.lethal?'#ff786e':'#cfadff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y-5,radius,0,7);ctx.stroke();}
 }
 const morpho=s.enemies.find(e=>e.model==='morpho');
 if(morpho&&s.hazards.some(h=>h.kind==='sweep')){const left=point(morpho.gap-130,805),right=point(morpho.gap+130,805);for(const [p,side] of [[left,1],[right,-1]]){line({x:p.x,y:p.y-9},{x:p.x,y:p.y+7},'#bddce7',2);line({x:p.x,y:p.y+7},{x:p.x+side*12,y:p.y+7},'#bddce7',2);}}
 for(const e of s.enemies){if(e.fuse>0){const p=point(e.chargeX,805);ctx.strokeStyle='#ffd896';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,18,-Math.PI/2,-Math.PI/2+Math.PI*2*e.fuse/.85);ctx.stroke();}if(e.type==='charger')drawChargerWarning(e);}
}
function enemyVisual(type,model){
 const base=Math.max(36,W*.062);
 if(type==='boss'&&model==='phoenix')return {index:sprites[13]?13:4,size:Math.max(120,W*.17)};
 if(type==='stier')return {index:sprites[14]?14:10,size:Math.max(70,W*.12)};
 if(type==='boss')return {index:model==='dinosauria'&&sprites[8]?8:model==='morpho'&&sprites[9]?9:5,size:Math.max(model==='morpho'?228:model==='dinosauria'?207:175,W*(model==='morpho'?.32:.27))};
 if(type==='artillery')return {index:sprites[10]?10:3,size:Math.max(60,W*.13)};
 if(type==='jammer')return {index:11,size:Math.max(34,W*.07)};
 if(type==='mine')return {index:sprites[12]?12:2,size:Math.max(34,W*.043)};
 return {index:type==='shield'?3:type==='charger'?4:2,size:base*(type==='shield'?1.95:type==='charger'?1.55:type==='scout'?1.6:type==='swarm'?.8:1)};
}
function hitOrigin(e){
 if(e.part&&e.model==='morpho'){const boss=s.enemies.find(n=>n.model==='morpho');if(boss){const port=bossPort(boss,e.x<boss.x?0:1);return {x:e.x,y:port.y-12/(H*.0008)};}}
 const offset=e.part?bossTurretSize(e.model)*.4:enemyVisual(e.kind,e.model).size*point(e.x,e.y).scale*.3;
 return {x:e.x,y:e.y-offset/(H*.0008)};
}
function drawJammer(e,death=0){
 const p=point(e.x,e.y),size=enemyVisual('jammer').size*p.scale;
 for(let i=0;i<8;i++){const angle=i*2.4+s.time*.3,r=size*(.2+(i%3)*.22+death*.3),x=p.x+Math.cos(angle)*r,y=p.y+Math.sin(angle)*r*.45;
  if(sprites[11]){const img=sprites[11],w=Math.max(12,size*.32),h=w*img.height/img.width;ctx.save();ctx.globalAlpha*=1-death;ctx.translate(x,y+death*14);ctx.rotate(Math.sin(s.time*2+i)*.18+death*(i%2?1:-1));let texture=img;for(const level of jammerLevels)if(level.height>=h*Math.min(devicePixelRatio||1,2))texture=level;ctx.drawImage(texture,-w/2,-h/2,w,h);ctx.restore();}
  else polygon([{x:x-5,y},{x:x+5,y:y-3},{x:x+2,y:y+4}],'#b2c8d9');
 }
}
function drawWreck(e){
 const age=e.duration-e.life,death=clamp(age/(e.duration||.55),0,1);if(e.kind==='jammer'){drawJammer(e,death);return;}
 const visual=enemyVisual(e.kind,e.model);ctx.save();if(e.duration>1){ctx.globalAlpha=clamp(e.life/.65,0,1);ctx.filter='saturate(.35) brightness(.64)';}drawSprite(visual.index,e.x,e.y,visual.size,e.phase||0,0,e,e.duration>1?Math.min(.24,age*.3):death);ctx.restore();
}
function drawEnemy(e){
 const p=point(e.x,e.y),visual=enemyVisual(e.type,e.model);
 if(['mine','jammer','artillery'].includes(e.type)){
  const size=Math.max(34,W*.07)*p.scale;
  if(e.type==='mine'&&sprites[12]){drawSprite(visual.index,e.x,e.y,visual.size,e.phase,e.flash,e);}
  else if(e.type==='mine'){
   ctx.strokeStyle=e.fuse>0?'#f9bf85':'#b2c1c9';ctx.lineWidth=3;
   const stride=Math.sin(e.walk)*4;line({x:p.x,y:p.y-size*.48},{x:p.x,y:p.y-size*.12},ctx.strokeStyle,6);line({x:p.x,y:p.y-size*.15},{x:p.x-7,y:p.y+stride},ctx.strokeStyle,2);line({x:p.x,y:p.y-size*.15},{x:p.x+7,y:p.y-stride},ctx.strokeStyle,2);line({x:p.x-11,y:p.y-size*.15},{x:p.x+11,y:p.y-size*.4},ctx.strokeStyle,2);ctx.fillStyle='#cfdbdf';ctx.beginPath();ctx.arc(p.x,p.y-size*.6,5,0,7);ctx.fill();
  }else if(e.type==='jammer'){drawJammer(e);
  }else if(sprites[10]){drawSprite(visual.index,e.x,e.y,visual.size,e.phase,e.flash,e);}
  else{drawSprite(3,e.x,e.y,Math.max(55,W*.11),e.phase,e.flash,e);rounded(p.x-size*.2,p.y-size*.75,size*.4,size*.4,2,'#9aaebc');line({x:p.x,y:p.y-size*.4},{x:p.x,y:p.y+size*.25},'#d6e0e5',4);}
  if(e.type!=='mine'){rounded(p.x-size*.45,p.y+12,size*.9,3,1,'#192c38');rounded(p.x-size*.45,p.y+12,size*.9*Math.max(0,e.hp/e.max),3,1,'#b4cbd5');}
  return;
 }
const {index,size}=visual;
 if(!['normal','swarm','boss','charger'].includes(e.type)){ctx.strokeStyle=e.type==='boss'?'#cfac8466':'#779ab855';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y,size*p.scale*.45,size*p.scale*.10,0,0,7);ctx.stroke();}
 if(e.model==='morpho'&&!sprites[9]){line(point(e.x-135,e.y-130),point(e.x-135,e.y+140),'#738898',3);line(point(e.x+135,e.y-130),point(e.x+135,e.y+140),'#738898',3);}
 drawSprite(index,e.x,e.y,size,e.phase,e.flash,e);if(e.model==='morpho')drawMorphoSystems(e);if(e.model==='dinosauria')drawDinoSystems(e);if(e.type==='charger')drawChargerSystems(e);
 if(e.recoil>0&&e.type!=='charger'&&!['morpho','dinosauria'].includes(e.model)){const q=point(e.x+(Number.isInteger(e.lastPart)?(e.lastPart?105:-105):0),e.y+24);ctx.fillStyle='#fff3c6';ctx.beginPath();ctx.ellipse(q.x,q.y,5+e.recoil*12,4+e.recoil*20,0,0,7);ctx.fill();}
 if(e.type==='boss'){
  for(let i=0;i<e.nodes.length;i++){
   const port=e.model==='morpho'?bossPort(e,i):{x:e.x+(i?105:-105),y:e.y},node=point(port.x,port.y),active=e.nodes[i]>0;
   const r=Math.max(8,W*.011);ctx.strokeStyle=active?'#efbf92':'#607182';ctx.lineWidth=1.5;
   for(const side of [-1,1]){const x=node.x+side*r;line({x,y:node.y-22},{x,y:node.y-6},ctx.strokeStyle,1.5);line({x,y:node.y-22},{x:x-side*5,y:node.y-22},ctx.strokeStyle,1.5);}
   if(['dinosauria','morpho'].includes(e.model)){const side=i?1:-1,from={x:p.x+side*size*p.scale*.07,y:p.y-size*p.scale*(e.model==='morpho'?.3:.18)},to={x:node.x,y:node.y-bossTurretSize(e.model)*.45};line(from,to,active?'#18232d':'#111c25',5);line(from,to,active?'#87969f':'#39444b',2);}
   const w=Math.max(10,W*.015),charging=s.hazards.some(h=>h.source===e.id&&!h.fired&&(h.part===i||h.partIndex===i));
   if(['dinosauria','morpho'].includes(e.model)&&turretSprite){const height=bossTurretSize(e.model),width=height*560/755,recoil=active&&e.lastPart===i?e.recoil*6:0;ctx.save();if(!active){ctx.filter='brightness(.3) saturate(.25)';ctx.globalAlpha=.65;}let texture=turretSprite;for(const level of turretLevels)if(level.height>=height*Math.min(devicePixelRatio||1,2))texture=level;if(e.model==='dinosauria'){const gun=dinoGun(e,i);ctx.translate(gun.pivot.x,gun.pivot.y);ctx.rotate(gun.angle);if(!active){ctx.beginPath();ctx.rect(-width/2,-height*.5,width,height*.56);ctx.clip();}ctx.drawImage(texture,-width/2,-height*.5-gun.recoil,width,height);}else {if(!active){ctx.beginPath();ctx.rect(node.x-width/2,node.y-height+8,width,height*.56);ctx.clip();}ctx.drawImage(texture,node.x-width/2,node.y-height+8-recoil,width,height);}ctx.restore();}
   else {rounded(node.x-w/2,node.y-28,w,28,2,active?'#7f9bb7':'#26323c');line({x:node.x,y:node.y-18},{x:node.x,y:node.y+8},active?'#d2deea':'#35414a',active?5:2);}
   if(active){const f=e.nodes[i]/e.nodeMax;line({x:node.x-w/2,y:node.y-34},{x:node.x-w/2+w*f,y:node.y-34},charging?'#ffd397':'#bbcfe1',3);if(charging&&e.model!=='dinosauria'){ctx.fillStyle='#ffcb85';ctx.beginPath();ctx.arc(node.x,node.y+8,3+Math.sin(s.time*22)*1.5,0,7);ctx.fill();}}
   else {line({x:node.x-5,y:node.y-16},{x:node.x+5,y:node.y-6},'#d17d57',2);}


  }
  if(e.exposed>0&&!['morpho','dinosauria'].includes(e.model)){ctx.strokeStyle='#f7cd85';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-24,14+Math.sin(s.time*9)*2,0,7);ctx.stroke();}
 }else if(!['normal','swarm'].includes(e.type)){
  const barW=Math.max(30,W*.038),y=p.y-size*p.scale*.84-9;rounded(p.x-barW/2,y,barW,3,1,'#101b2e');rounded(p.x-barW/2,y,barW*Math.max(0,e.hp/e.max),3,1,'#aaafff');

 }
 if(e.type==='scout'&&s.hazards.some(h=>h.source===e.id&&!h.fired)){
  ctx.strokeStyle='#ffb188';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y-17,Math.max(12,W*.014)+Math.sin(s.time*6)*3,0,7);ctx.stroke();
 }
}
function drawTeam(){
 if(s.hp<=0){if(state==='settling')drawSprite(s.machine==='m4a3'&&sprites[6]?6:s.machine==='xm2'&&sprites[7]?7:0,s.x,792,Math.max(65,W*.105),0,0,null,clamp(1-phaseTime/phaseDuration,0,1));return;}
 const formation=C.formation?C.formation(s):Array.from({length:s.count},(_,i)=>({x:s.x+([0,-125,125,0][i]),y:[792,845,845,900][i],main:i===0}));
 for(const [i,unit] of formation.entries()){
  const size=Math.max(65,W*.105)*(unit.main?1:.82),p=point(unit.x,unit.y);
  if(s.invulnerable>0)ctx.globalAlpha=.65+Math.sin(s.time*30)*.2;
  drawSprite(s.machine==='m4a3'&&sprites[6]?6:s.machine==='xm2'&&sprites[7]?7:unit.main?0:1,unit.x,unit.y,size,i*1.9,0);ctx.globalAlpha=1;
  if(muzzle>0&&state==='playing'){
   const tip=point(unit.x,unit.y-size*.8*point(unit.x,unit.y).scale/(H*.0008)),age=.14-muzzle,scale=(unit.main?1:.7)*(s.machine==='m4a3'?1.3:1)*(shotBoost==='none'?1:1.18),length=(W<500?23:31)*scale;
   ctx.save();ctx.translate(tip.x,tip.y);
   if(age<.09){const fade=1-age/.09,flare=ctx.createRadialGradient(0,-length*.35,0,0,-length*.35,length*.7);flare.addColorStop(0,'#fff8db');flare.addColorStop(.18,shotBoost==='momentum'?'#c5eeecdf':'#ffe7afdf');flare.addColorStop(.5,'#e9b86b55');flare.addColorStop(1,'#c38a3b00');ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade;ctx.scale(.55,1);ctx.fillStyle=flare;ctx.fillRect(-length,-length*1.1,length*2,length*1.5);ctx.fillStyle='#fff9e6';ctx.fillRect(-2,-length*.55,4,length*.65);}
   else{ctx.globalAlpha=(1-age/.14)*.24;ctx.fillStyle='#b6b8af';ctx.beginPath();ctx.ellipse(0,-length*.65-age*20,9*scale,5*scale,0,0,7);ctx.fill();}ctx.restore();
  }
  
 }
 if(state==='playing'&&s.machine==='m4a3'){const p=point(s.x,815),wide=Math.max(18,W*.028),ready=s.brace>=.45,alpha=ready?.55+bracePulse*.9:clamp(s.brace/.45,0,1)*.35;ctx.save();ctx.globalAlpha=alpha;for(const side of [-1,1]){const x=p.x+wide*side;line({x,y:p.y-8},{x,y:p.y+3},'#c7dcdf',1.5);line({x,y:p.y+3},{x:x-side*8,y:p.y+3},'#c7dcdf',1.5);}ctx.restore();}
 drawPlayerMarker();
 const p=point(s.x,840),width=Math.max(44,W*.065);rounded(p.x-width/2,p.y+3,width,4,1,'#172734');rounded(p.x-width/2,p.y+3,width*clamp((s.hp??100)/(s.maxHp||100),0,1),4,1,s.hp<30?'#ee9d85':'#b4d3c9');
}
function drawPlayerMarker(){
 const p=point(s.x,s.arena?s.y:805);ctx.strokeStyle='#e5ffff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.stroke();ctx.fillStyle='#55d9ed';ctx.beginPath();ctx.arc(p.x,p.y,2,0,7);ctx.fill();
}
function drawInterference(){
 if(state!=='playing'&&state!=='paused')return;
 for(const e of s.enemies)if(e.type==='jammer'&&!e.dead){const active=s.jamSources?.some(source=>source.id===e.id),left=point(e.x-220,805),right=point(e.x+220,805);ctx.save();polygon([point(e.x-220,160),point(e.x+220,160),point(e.x+220,900),point(e.x-220,900)],active?'#a99edc0e':'#a99edc06');ctx.globalAlpha=active?.7:.25;ctx.setLineDash([3,7]);line(left,right,'#b9b3d9',1);ctx.setLineDash([]);for(const p of [left,right])line({x:p.x,y:p.y-5},{x:p.x,y:p.y+5},'#b9b3d9',1.5);ctx.restore();}
}
function drawFireControl(){
 if(state!=='playing'&&state!=='paused')return;
 const control=s.fireControl?.find(unit=>unit.main),target=control?.target,live=target&&s.enemies.find(e=>e.id===target.id&&!e.dead);
 if(live){const origin=hitOrigin({...target,x:target.aimX??target.x,part:Math.abs((target.aimX??target.x)-target.x)>1}),p=point(origin.x,origin.y),r=clamp(enemyVisual(target.kind,target.model).size*p.scale*.18,8,17);ctx.save();ctx.globalAlpha=.85;for(const side of [-1,1])for(const vertical of [-1,1]){const x=p.x+side*r,y=p.y+vertical*r;for(const [color,width] of [['#132b3e',3.5],['#b4eff0',1.5]]){line({x:x-side*5,y},{x,y},color,width);line({x,y},{x,y:y-vertical*5},color,width);}}ctx.restore();}
 const source=s.jamSources?.reduce((best,e)=>!best||Math.abs(e.x-s.x)<Math.abs(best.x-s.x)?e:best,null);
 if(s.jammed&&source){const from=point(source.x,source.y),to=point(s.x,775),r=Math.max(16,enemyVisual('jammer').size*from.scale*.4);ctx.save();ctx.globalAlpha=.9;for(const side of [-1,1]){line({x:from.x+side*r,y:from.y-6},{x:from.x+side*r,y:from.y+6},'#d5c7f0',1.5);line({x:from.x+side*r,y:from.y-6},{x:from.x+side*(r-5),y:from.y-6},'#d5c7f0',1.5);}ctx.globalAlpha=.42+(jamPulse?.active?Math.max(0,1-jamPulse.age/.65)*.4:0);ctx.setLineDash([2,9]);line({x:from.x,y:from.y+12},to,'#c7b6eb',1.5);ctx.restore();}
 if(s.jammed||jamPulse){const p=point(s.x,840),x=p.x-Math.max(44,W*.065)/2-18,y=p.y+4,active=s.jammed;ctx.save();ctx.globalAlpha=active?.9:Math.max(0,1-jamPulse.age/.65);ctx.strokeStyle=active?'#d5bdec':'#bcf0e5';ctx.lineWidth=1.7;for(const side of [-1,1]){line({x:x+side*7,y:y-6},{x:x+side*7,y:y+6},ctx.strokeStyle,1.7);line({x:x+side*7,y:y-6},{x:x+side*3,y:y-6},ctx.strokeStyle,1.7);line({x:x+side*7,y:y+6},{x:x+side*3,y:y+6},ctx.strokeStyle,1.7);}if(active)line({x:x-3,y:y+3},{x:x+3,y:y-3},ctx.strokeStyle,1.8);else{line({x:x-3,y},{x:x-1,y:y+3},ctx.strokeStyle,1.8);line({x:x-1,y:y+3},{x:x+5,y:y-4},ctx.strokeStyle,1.8);}ctx.restore();}
}
function draw(){
 ctx.clearRect(0,0,W,H);ctx.save();if(shake>0&&motion)ctx.translate(rand(-shake,shake),rand(-shake,shake));if(s.arena){drawArenaScene();}else{drawRoad();
 drawInterference();

 drawHazards();drawChargerGround();
 for(const a of s.crates){const b=s.crates.find(b=>b!==a&&b.group===a.group);if(b&&a.x<b.x){const p=point(a.x,a.y),q=point(b.x,b.y);ctx.setLineDash([3,5]);line({x:p.x+24,y:p.y-20},{x:q.x-24,y:q.y-20},'#b1c9ec55');ctx.setLineDash([]);}}
 const objects=[...wrecks.map(e=>({y:e.y,draw:()=>drawWreck(e)})),...s.gates.map(g=>({y:g.y,draw:()=>drawGate(g)})),...s.crates.map(b=>({y:b.y,draw:()=>drawCrate(b)})),...supplyGhosts.map(b=>({y:b.y,draw:()=>drawCrate(b,true)})),...s.enemies.map(e=>({y:e.y,draw:()=>drawEnemy(e)}))];objects.sort((a,b)=>a.y-b.y);objects.forEach(o=>o.draw());
 ctx.lineCap='round';for(const b of s.bullets){const p=point(b.x,b.y),tail=point(b.x-b.vx*.017,b.y+(b.ammo==='ap'?34:26));line(tail,p,b.shell?(b.boost==='momentum'?'#c8eeea':b.ammo==='ap'?'#e0f2f5':'#ffe1ab'):'#b8d6e2',Math.max(1,b.shell?p.scale*(b.boost&&b.boost!=='none'?4:3):p.scale*1.2));}
 for(const fx of ammoBursts){const center=point(fx.contact.x,fx.contact.y),fade=1-fx.age/.2;ctx.save();ctx.globalAlpha=Math.max(0,fade)*.65;for(const hit of fx.hits){const p=point(hit.contact.x,hit.contact.y),dx=p.x-center.x,dy=p.y-center.y;if(Math.hypot(dx,dy)<5)continue;line({x:center.x+dx*.55,y:center.y+dy*.55},p,'#e7c99c',1.2);}ctx.restore();}
 drawDecoy();drawTeam();drawArtilleryFire();
 for(const fx of bladeFx){const from=point(fx.x,fx.y),target=point(fx.contact.x,fx.contact.y),f=clamp(fx.age/.26,0,1),side=fx.target.x<fx.x?-1:1,reach=Math.hypot(target.x-from.x,target.y-from.y),angle=Math.atan2(target.y-from.y,target.x-from.x),width=motion?Math.sin(f*Math.PI)*.28:.12;
  ctx.save();ctx.globalAlpha=(1-f)*.9;ctx.translate(from.x,from.y);ctx.rotate(angle);ctx.globalCompositeOperation='screen';const gradient=ctx.createLinearGradient(0,0,reach,0);gradient.addColorStop(0,'#c8e3e900');gradient.addColorStop(.65,'#c8e3e944');gradient.addColorStop(1,'#ecf8ecb0');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(reach*Math.cos(width),-side*reach*Math.sin(width));ctx.quadraticCurveTo(reach+5,0,reach,side*4);ctx.closePath();ctx.fill();ctx.strokeStyle='#eef9f2';ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(reach*.15,-side*reach*.03);ctx.quadraticCurveTo(reach*.62,-side*reach*(width+.1),reach,0);ctx.stroke();ctx.restore();}
 }
 for(const tr of traces){ctx.globalAlpha=tr.life/.22;line(point(tr.fromX,tr.fromY),point(tr.x,tr.y),'#ffe0ad',3);ctx.globalAlpha=1;}
 for(const r of rings){const p=point(r.x,r.y),progress=1-r.life/r.max;ctx.globalAlpha=(1-progress)*.7;ctx.strokeStyle=r.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,progress*r.size*p.scale),Math.max(1,progress*r.size*p.scale*.38),0,0,7);ctx.stroke();}
 for(const fx of explosions){const frame=explosionFrames[Math.min(31,Math.floor(fx.age/fx.duration*32))];if(!frame?.blendLayer)continue;const p=point(fx.x,fx.y),size=fx.size*p.scale;ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(fx.heavy?.8:.55)*Math.min(1,(1-fx.age/fx.duration)*4);ctx.drawImage(s.arena?frame.blendLayer:frame,p.x-size/2,p.y-size*.7,size,size*221/239);ctx.restore();}
 for(const p of particles){const pos=point(p.x,p.y);ctx.globalAlpha=clamp(p.life/p.max,0,1);if(p.spark)line(pos,{x:pos.x-p.vx*.035,y:pos.y-p.vy*.03},p.color,1.3);else if(p.shard){ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(p.rotation);const r=p.r*pos.scale;polygon([{x:-r,y:-r*.5},{x:r*.7,y:-r*.3},{x:r,y:r*.4},{x:-r*.5,y:r*.7}],p.color,'#b5c3c655');ctx.restore();}else{ctx.fillStyle=p.color;ctx.fillRect(pos.x,pos.y,p.r*pos.scale,p.r*pos.scale);}}
 for(const hit of impacts){const p=point(hit.x,hit.y),f=hit.life/hit.max,r=(hit.style==='fracture'?32:hit.large?26:hit.style==='ricochet'?11:15)*p.scale;ctx.save();ctx.globalAlpha=f;ctx.translate(p.x,p.y);
  if(hit.style==='pierce'){const reach=Math.max(15,r*1.7),travel=(1-f)*reach*.4;line({x:0,y:5-travel},{x:0,y:-reach-travel},'#172c3ecc',5);line({x:0,y:5-travel},{x:0,y:-reach-travel},'#e9fcff',2.6);line({x:-2,y:-3-travel},{x:-7,y:-reach*.65-travel},'#c7e6ee',1.5);line({x:2,y:-3-travel},{x:8,y:-reach*.55-travel},'#c7e6ee',1.5);ctx.fillStyle='#f5ffff';ctx.fillRect(-2.5,-2.5,5,5);}
  else if(hit.style==='ricochet'){ctx.rotate(-.6);line({x:-r*.5,y:1},{x:r*1.5,y:-2},hit.color,1.5);ctx.fillStyle='#d4e9f0';ctx.fillRect(-2,-1,4,2);}
  else{const glow=ctx.createRadialGradient(0,0,0,0,0,r);glow.addColorStop(0,'#fff2d7');glow.addColorStop(.14,hit.color||'#ffdfa3');glow.addColorStop(.4,'#ebaa584c');glow.addColorStop(1,'#dd973b00');ctx.globalCompositeOperation='screen';ctx.fillStyle=glow;ctx.fillRect(-r,-r,r*2,r*2);if(hit.style==='fracture'){ctx.globalCompositeOperation='source-over';for(let i=0;i<5;i++){ctx.rotate(1.25);line({x:r*.2,y:0},{x:r*(1.2-f*.5),y:r*.16},'#e4bf84',1.2);}}}
  ctx.restore();}
 ctx.globalAlpha=1;for(const t of texts){const p=point(t.x,t.y);ctx.globalAlpha=Math.min(1,t.life*3);label(t.str,p.x,p.y,s.arena?14:24,t.color,900);}ctx.globalAlpha=1;if(s.arena){drawArenaLanding();drawArenaReticle();}else{drawSupport();drawShellBursts();drawRailBursts();drawArmorBreaks();for(const box of s.crates)drawCrate(box,false,true);for(const box of supplyGhosts)drawCrate(box,true,true);drawHazards(true);drawPlayerMarker();drawFireControl();}ctx.restore();drawRewards();
 if(flash>0&&motion){ctx.fillStyle=`rgba(181,215,255,${flash*.4})`;ctx.fillRect(0,0,W,H);}
 if(s.arena)drawArenaPlayerMarker();
}
function update(dt){
 for(const fx of chargerFx)fx.age+=dt;chargerFx=chargerFx.filter(fx=>fx.age<.75);
 for(const fx of armorBreaks)fx.age+=dt;armorBreaks=armorBreaks.filter(fx=>fx.age<1.35);for(const fx of hitResponses)fx.age+=dt;hitResponses=hitResponses.filter(fx=>fx.age<.22);
 if(jamPulse){jamPulse.age+=dt;if(jamPulse.age>.65)jamPulse=null;}
 for(const fx of ammoBursts)fx.age+=dt;ammoBursts=ammoBursts.filter(fx=>fx.age<.2);
for(const fx of fireLinkFx)fx.age+=dt;fireLinkFx=fireLinkFx.filter(fx=>fx.age<.4);
 for(const fx of bladeFx)fx.age+=dt;bladeFx=bladeFx.filter(fx=>fx.age<.26);bracePulse=Math.max(0,bracePulse-dt);
 for(const fx of rewardFx){fx.age+=dt;if(fx.age>=1.4&&!rewardFx.some(other=>other!==fx&&other.id===fx.id&&other.age<1.4)){const el=$(fx.id);delete el.dataset.reward;el.classList.remove('reward-pulse');}}rewardFx=rewardFx.filter(fx=>fx.age<1.4);for(const box of supplyGhosts)box.life-=dt;supplyGhosts=supplyGhosts.filter(box=>box.life>0);
 for(const fx of shellBursts)fx.age+=dt;shellBursts=shellBursts.filter(fx=>fx.age<.8);
 for(const fx of supportFx)fx.age+=dt;supportFx=supportFx.filter(fx=>fx.age<.7);
 for(const fx of railBursts)fx.age+=dt;railBursts=railBursts.filter(fx=>fx.age<.45);
 effectsClock+=dt;for(const fx of explosions)fx.age+=dt;explosions=explosions.filter(fx=>fx.age<fx.duration);
 if(eventTime>0){eventTime-=dt;if(eventTime<=0)$('eventNotice').hidden=true;}
 if(state==='launching'||state==='settling'){phaseTime-=dt;$('phaseProgress').style.width=`${clamp(1-phaseTime/phaseDuration,0,1)*100}%`;if(phaseTime<=0)completePhase();}
 for(const h of impacts)h.life-=dt;impacts=impacts.filter(h=>h.life>0).slice(-60);
 const speed=(C.machines[s.machine]||C.machines.m1a4).speed;let target=s.target;if(keys.has('a')||keys.has('arrowleft'))target=s.x-speed/16;if(keys.has('d')||keys.has('arrowright'))target=s.x+speed/16;
 s.muzzleScale=Math.max(65,W*.105)*.8/(H*.00080);s.muzzleY=792-s.muzzleScale*point(500,792).scale;if(state==='playing'){const previousCrates=s.crates.slice();C.step(s,dt,s.arena?{moveX:Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),moveY:Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup')),aimX:s.aimX,aimY:s.aimY,firing:true}:target);refreshBattleRadio();processEvents(previousCrates);refreshBattleRadio();if(!activeRadio)coreRadio(s.enemies.find(e=>e.type==='boss'&&!e.dead&&e.exposed>0));}if(s.over&&state==='playing')end();for(const e of wrecks){e.life-=dt;if(e.duration>1){const age=e.duration-e.life,stages=e.kind==='boss'?[.16,.42,.72]:[.18];while(e.burstStage<stages.length&&age>=stages[e.burstStage]){const i=e.burstStage++,x=e.x+(i===0?-45:i===2?40:0),y=e.y-(i===1?50:25);blastEffect(x,y,e.kind==='boss'?(i===1?170:92):75,e.kind==='boss'&&i===1,i===1?.95:.5,true);burst(x,y,'#d7b895',i===1?25:9,true);if(i===1){ring(x,y,'#d9b28c',true);if(motion)shake=Math.max(shake,5);}}}}wrecks=wrecks.filter(e=>e.life>0);
 const active=s.enemies.some(e=>e.type==='boss')?1:s.enemies.some(e=>e.type==='scout'||e.type==='charger')?.4:0;danger+=(active-danger)*Math.min(1,dt*2);
 for(const tr of traces)tr.life-=dt;traces=traces.filter(tr=>tr.life>0);shake=Math.max(0,shake-dt*38);flash=Math.max(0,flash-dt);muzzle=Math.max(0,muzzle-dt);
 for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.shard?300:180)*dt;if(p.shard)p.rotation+=p.spin*dt;}particles=particles.filter(p=>p.life>0);
 for(const t of texts){t.life-=dt;t.y-=dt*35;}texts=texts.filter(t=>t.life>0);for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
}
function formatTime(time){return `${String(Math.floor(time/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;}
function hud(){
 $('arenaAbilities').hidden=!s.arena||!['playing','paused'].includes(state);
 if(s.arena){
  for(const [id,remaining,active] of [['arenaBurst',s.burstCooldown||0,s.burstTime||0],['arenaDash',s.dashCooldown||0,s.dash?.remaining||0]]){
   const button=$(id);button.disabled=state!=='playing'||remaining>0;button.classList.toggle('active',active>0);button.querySelector('span').textContent=active>0?active.toFixed(1)+'s':remaining>0?remaining.toFixed(1)+'s':'就緒';button.style.setProperty('--ready',String(1-remaining/(id==='arenaBurst'?9:3)));
  }
 }

 $('count').innerHTML=`${String(s.count).padStart(2,'0')}<small>／04</small>`;$('shield').textContent=`耐久 ${Math.ceil(s.hp??100)} · 裝甲 ${Math.ceil(s.shield)}`;$('kills').textContent=String(s.kills).padStart(3,'0');$('bosskills').textContent=`BOSS ${String(s.bossKills).padStart(2,'0')}`;$('time').textContent=formatTime(s.time);
 const boss=s.enemies.find(e=>e.type==='boss');$('threat').textContent=s.over?(s.won?'作戰完成':'訊號中斷'):boss?'重型目標接敵':s.jammed?'火控干擾':s.stage===1?`軌道砲接敵 ${Math.max(0,Math.ceil(s.boss))}s`:'壁外作戰';if(s.mode==='endless')$('threat').textContent=s.over?'無限戰線結束':`第 ${s.wave} 波 · ${boss?'重型目標接敵':'持續接敵'}`;const total=s.mode==='endless'?Math.max(1,s.bossKills+1):s.encounter==='mixed'?2:1,progress=clamp((s.bossKills+(boss?1-boss.hp/boss.max:0))/total,0,1)*100;$('threatbar').style.width=progress+'%';$('threatbar').parentElement.setAttribute('aria-valuenow',Math.round(progress));$('objectiveRoute').hidden=s.mode==='endless'||s.encounter!=='mixed';$('routeDino').className=s.bossKills>0?'done':'current';$('routeMorpho').className=s.bossKills>1?'done':s.stage===1?'current':'';$('objectiveRoute').setAttribute('aria-label',`重戰車${s.bossKills>0?'已擊破':'待擊破'}，電磁加速砲${s.bossKills>1?'已擊破':s.stage===1?(boss?'接戰中':'接近中'):'待突破'}`);
 $('weaponlevel').textContent=`${(s.machine||'m1a4').toUpperCase()} · LV.${s.level} · ${{ap:'穿甲',he:'榴彈',standard:'通用'}[s.ammo||'standard']}`;$('weaponname').textContent=s.machine==='m4a3'?'120mm 滑膛砲':s.machine==='xm2'?'88mm 滑膛砲':'57mm 滑膛砲';$('dots').innerHTML=Array.from({length:8},(_,i)=>`<i class="${i<s.level?'on':''}"></i>`).join('');$('combo').innerHTML=s.combo>=8?`${s.combo}<small>連續擊破</small>`:'';
 const statusValue=s.arena?clamp(1-s.shot/(C.machines[s.machine].interval*(s.ammo==='ap'?1.25:1)),0,1):s.machine==='m4a3'?clamp(s.brace/.45,0,1):s.machine==='xm2'?clamp((s.momentum||0)/90,0,1):clamp(1-s.blade/2.4,0,1);
 $('machineStatus').innerHTML=state==='playing'?`<svg viewBox="0 0 24 24" fill="none" stroke="#bcdbdf" stroke-width="1.7" aria-hidden="true">${s.machine==='xm2'?'<path d="m15 2-9 12h6l-3 8 10-13h-6z"/>':s.machine==='m4a3'?'<path d="M3 8h18M6 8v8h12V8M12 3v8M4 21l4-5m12 5-4-5"/>':'<path d="m4 4 16 16M20 4 4 20M2 7l5-5m10 20 5-5"/>'}</svg><span class="state-track"><i style="width:${statusValue*100}%"></i></span>`:'';
 $('machineStatus').classList.toggle('skill-ready',statusValue>=1);$('machineStatus').setAttribute('aria-label',s.arena?'主砲裝填':s.machine==='m4a3'?'砲架穩定度':s.machine==='xm2'?'動能蓄積':'近擊準備度');
 $('tactical').disabled=state!=='playing'||!s.charges||s.tacticCooldown>0;$('tactical').innerHTML=`${s.tactic==='decoy'?'放置誘餌':'支援砲擊'}<small>空白鍵 · ${s.charges||0} 次${s.arena&&s.charges<2?' · '+Math.ceil(s.tacticRecharge||0)+'秒回充':''}</small>`;
 $('bossbar').hidden=!boss||!['playing','paused'].includes(state);$('bossnodeleft').hidden=!!s.arena;$('bossnoderight').hidden=!!s.arena;canvas.parentElement.classList.toggle('has-boss',!!boss&&state==='playing');$('game').parentElement.classList.toggle('danger',danger>.25);
 if(boss){
  $('bossname').textContent=boss.model==='dinosauria'?'DINOSAURIA · 重戰車型':boss.model==='morpho'?'MORPHO · 電磁加速砲型':boss.model==='phoenix'?'PHÖNIX · 高機動型':'LÖWE · 戰車型';$('bosshp').textContent=`${Math.ceil(boss.hp/boss.max*100)}%`;$('bossfill').style.width=`${clamp(boss.hp/boss.max*100,0,100)}%`;
  const pending=s.hazards.filter(h=>h.source===boss.id&&!h.fired).sort((a,b)=>a.delay-b.delay)[0],firing=s.hazards.some(h=>h.source===boss.id&&h.fired&&h.life>0&&(!s.arena||h.geometry==='beam')),permanent=!s.arena&&boss.model==='dinosauria'&&boss.nodes.every(n=>n<=0),phase=s.arena&&boss.exposed>0?'exposed':firing?'firing':boss.exposed>0?'exposed':pending?'charging':'armored';
  $('bossbar').dataset.phase=phase;$('bossbar').dataset.model=boss.model||'lowe';$('bosshint').textContent=s.arena?(boss.model==='phoenix'?(boss.exposed>0?'突襲撲空 · 反擊 ×1.6':boss.phase==='dash'?'鏈刃突襲':boss.phase==='windup'?'鎖定完成 · 側向躍進':boss.revealed>0?'迷彩破除':'迷彩追蹤 · 持續射擊顯形'):boss.exposed>0?'散熱窗口 · 反擊 ×1.6':firing?'火力釋放':pending?(pending.geometry==='beam'?'射界鎖定 · 移出光帶':'落點鎖定 · 離開圓圈'):'追蹤中'):firing?'砲擊中':boss.exposed>0?(permanent?'核心持續暴露':'核心開放 · '+boss.exposed.toFixed(1)+'s'):pending?({heavy:'主砲鎖定',secondary:'副砲齊射',sweep:'電磁蓄能',rail:'主砲預鎖',vulcan:'火神砲鎖定'}[pending.kind]||'武裝蓄力'):'裝甲閉合';
  const progress=phase==='exposed'?(permanent?1:clamp(boss.exposed/(s.arena?2:boss.model==='morpho'?2.2:1.5),0,1)):pending?clamp(1-pending.delay/pending.maxDelay,0,1):0;
  if($('bossphasefill'))$('bossphasefill').style.width=progress*100+'%';
  for(const [i,id] of ['bossnodeleft','bossnoderight'].entries()){const el=$(id);if(!el)continue;const active=boss.nodes[i]>0,fire=s.hazards.some(h=>h.source===boss.id&&h.fired&&h.life>0&&(h.partIndex===i||h.part===i));const charging=s.hazards.some(h=>h.source===boss.id&&!h.fired&&(h.partIndex===i||h.part===i));el.dataset.active=String(active);el.dataset.firing=String(fire);el.dataset.charging=String(charging);el.setAttribute('aria-label',(i?'右':'左')+'副砲 · '+(active?(fire?'射擊中':charging?'蓄力中':Math.ceil(boss.nodes[i])+'耐久'):'已失能'));}
 }

 if(s.arena)$('tip').textContent=s.jammed?'僚機索敵受限 · 擊落阻電機群':'靠近補給即可回收';
 $('boost').hidden=s.overdrive<=0;$('boosttime').textContent=Math.ceil(s.overdrive);$('tip').hidden=s.overdrive>0;
}
function preview(){s=C.create(()=>.4);s.count=3;s.level=1;for(let i=0;i<9;i++)C.spawnEnemy(s,'normal',210+(i%3)*265,80+Math.floor(i/3)*100);C.spawnEnemy(s,'shield',650,370);s.events=[];}
const params=new URLSearchParams(location.search);for(const id of ['machine','encounter','ammo','tactic']){const value=params.get(id);if({machine:['m1a4','m4a3','xm2'],encounter:['pursuit','mixed','fire-support','mines','dinosauria','morpho'],ammo:['standard','ap','he'],tactic:['support','decoy']}[id].includes(value))$(id).value=value;}if(/^\d{1,6}$/.test(params.get('seed')||''))$('seed').value=params.get('seed');loadoutPreview();
preview();resize();hud();
function frame(now){const dt=Math.min(.033,(now-previous)/1000||0);previous=now;if(['launching','playing','settling'].includes(state)&&!window.manualTime)update(dt);if(state==='playing')battleMusicScene=s.enemies.some(e=>e.type==='boss')?'boss':'battle';window.FrontlineAudio?.setScene?.(!$('titleScreen').hidden?'title':['ready','launching'].includes(state)?'prep':state==='settling'&&phaseTime>2.1?battleMusicScene:['over','settling'].includes(state)?s.won?'victory':'defeat':state==='paused'&&pausedFrom==='launching'?'prep':battleMusicScene);window.FrontlineAudio?.update({playing:['launching','playing','settling'].includes(state),phase:state,boss:s.enemies.some(e=>e.type==='boss'),elite:s.enemies.some(e=>['scout','shield','charger'].includes(e.type)),hp:s.hp??100,won:s.won});draw();if(now-lastHud>90){hud();lastHud=now;}requestAnimationFrame(frame);}requestAnimationFrame(frame);

window.advanceTime=ms=>{window.manualTime=true;for(let i=0;i<Math.round(ms/1000*60);i++)if(['launching','playing','settling'].includes(state))update(1/60);draw();hud();};
window.render_game_to_text=()=>JSON.stringify({mode:state,phaseRemaining:phaseTime,result:runResult,config:runConfig,coordinates:s.arena?'平面 x/y 0–1000，x向右 y向下；WASD移動、滑鼠aim':'x 0–1000 向右，y 0–1000 向下；小隊命中中心 y805',time:s.time,player:{arena:!!s.arena,y:s.y,aimX:s.aimX,aimY:s.aimY,angle:s.angle,mode:s.mode,wave:s.wave,machine:s.machine,ammo:s.ammo,charges:s.charges,brace:s.brace,momentum:s.momentum,jammed:s.jammed,x:s.x,hp:s.hp,won:s.won,count:s.count,shield:s.shield,level:s.level,overdrive:s.overdrive},enemies:s.enemies.map(e=>({id:e.id,type:e.type,model:e.model,x:e.x,y:e.y,hp:e.hp,max:e.max,charging:e.charging,chargeX:e.chargeX,attacks:e.attackCount,exposed:e.exposed,nodes:e.nodes,stagger:e.stagger||0,partDisabled:e.partDisabled})),bullets:s.bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,shell:b.shell,enemy:b.enemy})),obstacles:s.obstacles,abilities:{burst:s.burstTime,burstCooldown:s.burstCooldown,dashCooldown:s.dashCooldown,dash:s.dash},render:{poseFrames:arenaPoseCache.size,poseBytes:arenaPoseCache.bytes,wrecks:wrecks.length,particles:particles.length,explosions:explosions.length},hazards:s.hazards,items:s.crates,gates:s.gates,stats:s.stats});

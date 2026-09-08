(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const C={
  machines:{m1a4:{name:'M1A4 破壞神',hp:100,speed:720,interval:1,damage:1},m4a3:{name:'M4A3 破壞之杖',hp:160,speed:490,interval:1.7,damage:1.65},xm2:{name:'XM2 女武神',hp:80,speed:880,interval:1.35,damage:1.35}},
  setup(s,options={}){
   s.machine=C.machines[options.machine]?options.machine:'m1a4';const m=C.machines[s.machine];s.hp=s.maxHp=m.hp;s.speed=m.speed;s.encounter=options.encounter||'mixed';s.mode=options.mode==='endless'?'endless':'frontline';s.wave=1;s.ammo=['ap','he'].includes(options.ammo)?options.ammo:'standard';s.tactic=options.tactic==='decoy'?'decoy':'support';s.charges=1;s.tacticCooldown=0;s.brace=0;s.momentum=0;s.jammed=false;s.jamSources=[];s.fireControl=[];s.special=3;s.specialWave=0;s.supplyWave=0;s.stage=0;s.regroupWave=0;s.regroupSupply=false;
   s.boss=s.mode==='endless'||s.encounter==='mixed'?46:(['dinosauria','morpho'].includes(s.encounter)?1:50);if(s.encounter==='mixed'||s.encounter==='dinosauria')s.elite=6;if(s.encounter==='pursuit'){C.spawnEnemy(s,'charger',500,330);s.elite=8;}
   s.count=3;s.level=s.encounter==='mixed'?1:3;if(s.encounter==='fire-support'){C.spawnSpecial(s,'artillery',230,220).cooldown=.35;C.spawnSpecial(s,'jammer',770,300);C.spawnEnemy(s,'scout',500,250);s.special=10;}if(s.encounter==='mines'){for(const x of [200,300,400,700,800,900])C.spawnSpecial(s,'mine',x,x<500?480:420);s.special=8;}
   return s;
  },
  useTactic(s){
   if(s.over||!s.charges||s.tacticCooldown>0)return false;s.charges--;s.tacticCooldown=1;s.stats.tactics=(s.stats.tactics||0)+1;
   if(s.tactic==='decoy'){s.decoy={x:s.x,y:770,life:4};s.events.push({type:'tactic',kind:'decoy',x:s.x,y:770,duration:4});}
   else{const pending=s.hazards.filter(h=>!h.fired).map(h=>({hazard:h,snapshot:{...h}}));const hits=[];for(const e of [...s.enemies])if(!e.dead&&Math.abs(e.x-s.x)<190){let damage=0,part=false,partIndex=null,x=e.x;if(e.type==='boss'&&e.model==='dinosauria'){const i=s.x<e.x?0:1;if(e.nodes[i]>0){const before=e.nodes[i];C.hitBossNode(s,e,i,230,'support');damage=before-e.nodes[i];part=true;partIndex=i;x=e.x+(i?105:-105);}else{const before=e.hp;C.damageEnemy(s,e,230*(e.exposed>0?2.2:1));damage=Math.min(before,before-e.hp);}}else{const before=e.hp;C.damageEnemy(s,e,e.type==='boss'?(e.exposed>0?500:160):230);damage=Math.min(before,before-e.hp);}if(damage>0)hits.push({id:e.id,kind:e.type,model:e.model||e.type,x,y:e.y,part,partIndex,damage,killed:e.dead});}s.hazards=s.hazards.filter(h=>h.fired||h.kind==='mortar'&&h.launched||Math.abs(h.x-s.x)>190);const cancelled=pending.filter(({hazard})=>!s.hazards.includes(hazard)).map(({snapshot})=>snapshot);s.events.push({type:'tactic',kind:'support',x:s.x,y:420,width:380,hits,cancelled});}
   return true;
  },
  spawnSpecial(s,type,x,y=-30){
   const model=['dinosauria','morpho'].includes(type)?type:null,e=C.spawnEnemy(s,model?'boss':type,x,y);if(!e)return null;
   if(model){e.model=model;e.hp=e.max=model==='dinosauria'?2600:3200;e.nodes=model==='morpho'?[150,150]:[190,190];e.nodeMax=model==='dinosauria'?190:150;e.r=145;e.cooldown=.7;e.partDisabled=[false,false];}
   else{e.hp=e.max=type==='artillery'?150:type==='jammer'?90:25;e.r=type==='mine'?17:32;e.cooldown=1.2;e.fuse=0;}
   return e;
  },
  specialEnemy(s,e,dt){
   const aim=s.decoy?.x??s.x,busy=s.hazards.some(h=>!h.fired||h.persistent&&h.life>0)||s.enemies.some(n=>!n.dead&&n!==e&&(n.charging>0||n.dashing||n.fuse>0));
   if(e.type==='jammer'){e.y+=clamp(320-e.y,-dt*80,dt*80);e.x=clamp(e.x+Math.sin(s.time*.7+e.phase)*dt*35,220,780);return true;}
   if(e.type==='mine'){
    if(e.fuse>0){e.x+=clamp(e.chargeX-e.x,-dt*430,dt*430);e.y+=dt*110;e.fuse-=dt;if(e.fuse<=0){C.telegraph(s,e,'mine',e.x,170,.25,32);s.hazards[s.hazards.length-1].shape='zone';e.dead=true;}}
    else if(e.y>=680){if(s.hazards.some(h=>h.lethal))return true;e.chargeX=clamp(aim,e.x-350,e.x+350);e.fuse=.85;s.events.push({type:'warning',text:'地雷引信啟動 · 射爆可連鎖清場'});}
    else e.y+=dt*(s.time<30?135:180);return true;
   }
   if(e.type==='artillery'){
    e.y+=clamp(240-e.y,-dt*80,dt*80);e.cooldown-=dt;
    if(e.y>=220&&e.cooldown<=0&&!busy){e.cooldown=5.2;e.attackCount++;s.stats.eliteShots++;
     const scout=s.enemies.find(n=>n.type==='scout'&&!n.dead);
     const positions=scout?[aim,clamp(aim+(aim<500?230:-230),130,870)]:[aim];
     positions.forEach((x,i)=>{s.hazards.push({source:e.id,model:e.type,linkedTo:i?scout.id:undefined,origin:{fromX:e.x,fromY:e.y},scoutX:i?scout.x:undefined,scoutY:i?scout.y:undefined,volley:e.attackCount,shotIndex:i,kind:'mortar',shape:'zone',x,y:805,width:190,delay:1.5+i*.6,maxDelay:1.5+i*.6,life:2.2,persistent:true,tick:0,fired:false,launched:false,damage:22,...(s.decoy?{decoyX:s.decoy.x}:{})});});
     s.events.push({type:'mortarAim',sourceId:e.id,volley:e.attackCount,linkedTo:scout?.id,x:e.x,y:e.y});s.events.push({type:'warning',text:scout?'斥候修正第二落點 · 爆區會短暫殘留':'砲兵落點 · 離開後別立即折返'});
    }return true;
   }
   if(!e.model)return false;
   e.intro=Math.max(0,e.intro-dt);e.y+=clamp(460-e.y,-dt*360,dt*360);e.cooldown-=dt;
   if(e.model==='dinosauria'&&e.nodes.every(n=>n<=0))e.exposed=2.5;
   if(e.model==='morpho'){e.nodeRepair-=dt;if(e.nodeRepair<=0&&e.nodes.every(n=>n<=0)){e.nodes=[150,150];e.nodeRepair=12;s.events.push({type:'partsRepaired',sourceId:e.id,model:e.model,x:e.x,y:e.y});}}
   if(e.intro>0||e.cooldown>0||busy||s.crates.some(b=>!b.used&&!b.drop&&b.y>480&&b.y<820))return true;
   e.attackCount++;e.cooldown=e.hp<e.max*.45?3.4:4.2;
   if(e.model==='dinosauria'){
    const live=[0,1].filter(i=>!e.partDisabled[i]);
    if(!live.length){C.telegraph(s,e,'heavy',aim,280,1.25,52);const h=s.hazards[s.hazards.length-1];h.opensArmor=true;h.volley=e.attackCount;s.events.push({type:'attackCue',x:e.x,y:e.y,kind:'main',volley:e.attackCount});}
    else{C.telegraph(s,e,'heavy',aim,280,1.3,40);const h=s.hazards[s.hazards.length-1];h.opensArmor=true;h.volley=e.attackCount;s.events.push({type:'attackCue',x:e.x,y:e.y,kind:'main',volley:e.attackCount});for(const i of live){const x=i?795:205;s.hazards.push({source:e.id,model:e.model,kind:'secondary',x,y:e.y+20,width:260,delay:2.1,maxDelay:2.1,life:.3,fired:false,damage:24,partIndex:i,volley:e.attackCount});s.events.push({type:'attackCue',x,y:e.y,kind:'side',sourceId:e.id,partIndex:i,volley:e.attackCount});}}
    s.events.push({type:'warning',text:!live.length?'主砲暴露 · 單一重砲發射前保持移動':'側翼武裝鎖定 · 破壞玩家所在側可取消該招式'});
   }else if(e.attackCount%2){
    const gap=[250,750,500][Math.floor(e.attackCount/2)%3],half=130;e.gap=gap;
    for(const [left,right] of [[0,gap-half],[gap+half,1000]])if(right>left)s.hazards.push({source:e.id,model:e.model||e.type,kind:'sweep',x:(left+right)/2,y:e.y,width:right-left,delay:1.9,maxDelay:1.9,life:.45,fired:false,damage:999,lethal:true,volley:e.attackCount});
    s.events.push({type:'attackCue',x:e.x,y:e.y,kind:'rail'});s.events.push({type:'warning',text:'軌道砲全域封鎖 · 進入藍色安全缺口'});
   }else{const live=[0,1].filter(i=>e.nodes[i]>0);if(!live.length){C.telegraph(s,e,'rail',aim,180,1.15,24);s.hazards[s.hazards.length-1].volley=e.attackCount;if(s.decoy)s.hazards[s.hazards.length-1].decoyX=s.decoy.x;s.events.push({type:'attackCue',x:e.x,y:e.y,kind:'focused'});s.events.push({type:'warning',text:'主砲預鎖 · 側移避開單一射線'});return true;}const direction=aim<500?1:-1,preferred=live.indexOf(aim<500?0:1),start=preferred<0?0:preferred;for(let i=0;i<3;i++){C.telegraph(s,e,'vulcan',clamp(aim+direction*170*i,110,890),140,.9+.4*i,18);const h=s.hazards[s.hazards.length-1];h.partIndex=live[(start+i)%live.length];h.volley=e.attackCount;if(s.decoy)h.decoyX=s.decoy.x;}s.events.push({type:'warning',text:'火神砲三連掃射 · 首發鎖定後橫移躲開'});}
   return true;
  },
  gateResult:(count,type,value)=>Math.min(4,count+(type==='multiply'?value*2:value)),
  gateValue:(base,hits,cap=6)=>Math.min(cap,base+Math.floor(hits/12)),
  difficulty(time){const phase=time%28;return {interval:Math.max(.38,.8-time*.0014),density:time<8?.75:phase<10?1:phase<22?1.35:.42,speed:90+Math.min(140,time*.48),health:16+time*.12};},
  weapon(level){level=Math.min(8,level);return {interval:.65-Math.min(4,level)*.035,spread:1,pierce:level>=3?3:2,explosive:level>=4,damage:24+level*3};},
  create:(random=Math.random)=>({random,time:0,x:500,target:500,velocity:0,muzzleY:690,count:2,maxCount:4,hp:100,maxHp:100,shield:0,kills:0,bossKills:0,level:0,over:false,won:false,jammed:false,jamSources:[],fireControl:[],enemies:[],bullets:[],gates:[],crates:[],hazards:[],events:[],nextId:1,shot:0,mg:0,blade:0,volley:0,spawn:.4,gate:.5,crate:4,elite:11,boss:125,combo:0,comboTime:0,invulnerable:0,overdrive:0,recovery:0,scroll:0,walk:0,stats:{recruits:0,damage:0,interrupts:0,fullTime:0,bossShots:0,eliteShots:0,peakEnemies:0,items:0}}),
  formation(s){return [{x:s.x,y:792,main:true},...Array.from({length:Math.max(0,s.count-1)},(_,i)=>({x:s.x+(i===0?-125:i===1?125:0),y:i<2?845:900,main:false}))];},
  recruit(s,amount){const before=s.count;s.count=Math.min(s.maxCount,s.count+amount);s.stats.recruits+=s.count-before;s.events.push({type:'recruit',x:s.x,y:800,amount:s.count-before,shield:s.shield});},
  upgrade(s){if(s.level<8)s.level++;else s.overdrive=Math.max(s.overdrive,6);s.events.push({type:'upgrade',x:s.x,y:790,level:s.level});},
  hurt(s,amount,lethal=false,source={}){
   if(s.over||s.invulnerable>0)return;
   const rescue=lethal&&s.count>1,wing=rescue?C.formation(s).at(-1):null,hit=lethal?45:amount;
   const absorbed=rescue?0:Math.min(s.shield,hit);s.shield-=absorbed;
   const before=s.hp,body=rescue?0:Math.max(0,hit-absorbed);s.hp=Math.max(0,s.hp-body);let loss=0;
   if(rescue||body>=28&&s.count>1){s.count--;loss=1;}
   const actual=before-s.hp;s.stats.damage+=actual;s.stats.hits=(s.stats.hits||0)+1;s.invulnerable=1.2;s.lastDamage={kind:source.kind||'unknown',model:source.model||'unknown',sourceId:source.sourceId??source.source??null,time:s.time,amount:actual,lethal:s.hp<=0,critical:lethal};
   s.events.push({type:'hurt',x:s.x,y:800,amount:actual,loss,absorbed,lethal:s.hp<=0,wing,source:s.lastDamage});
   if(s.hp<=0){s.hp=0;s.count=0;s.over=true;s.events.push({type:'over'});}
  },
  result(s){
   if(!s.over)return null;
   return Object.freeze({won:s.won,time:s.time,kills:s.kills,bossKills:s.bossKills,wave:s.wave||1,mode:s.mode||'frontline',level:s.level,damage:s.stats.damage,hits:s.stats.hits||0,interrupts:s.stats.interrupts,items:s.stats.items,tactics:s.stats.tactics||0,machine:s.machine||'m1a4',encounter:s.encounter||'mixed',ammo:s.ammo||'standard',tactic:s.tactic||'support',lastDamage:s.lastDamage?Object.freeze({...s.lastDamage}):null});
  },
  spawnEnemy(s,type,x,y=-35){
   if(type==='boss'&&s.enemies.some(e=>e.type==='boss'&&!e.dead))return null;
   const d=C.difficulty(s.time),boss=type==='boss',scale=1+s.time/180;
   const hp=boss?3000*Math.pow(1+s.bossKills*.8,1.35):type==='scout'?70*scale:type==='charger'?85*scale:type==='shield'?155*scale:type==='swarm'?d.health*.55:d.health;
   const e={id:s.nextId++,type,x,y,hp,max:hp,r:boss?145:type==='shield'?36:type==='scout'?27:type==='charger'?26:18,speed:d.speed*(type==='shield'?.65:type==='scout'?.9:type==='swarm'?1.2:1),lateral:0,dead:false,flash:0,phase:s.random()*6,walk:0,recoil:0,cooldown:boss?.35:.5,intro:boss?1.2:0,age:0,attackCount:0,exposed:0,interrupts:0,nodes:boss?[120+70*s.bossKills,120+70*s.bossKills]:[],nodeMax:120+70*s.bossKills,nodeRepair:0,charging:0,chargeX:null,chargeDecoyX:null,dashing:false,dashFromX:null,dashFromY:null,dashProgress:0,dashDuration:0,retreat:false,retreatY:null,staggerDuration:0,ram:0,ramX:500};
   if(s.encounter&&['charger','scout','shield'].includes(type)){e.hp=e.max=hp*(type==='charger'?2.5:1.8);}s.enemies.push(e);if(boss)s.events.push({type:'bossEnter',x,y});else if(!['normal','swarm'].includes(type))s.events.push({type:'elite',kind:type,x,y});return e;
  },
  damageEnemy(s,e,damage){
   if(e.dead)return;if(e.type==='charger'&&e.stagger>0)damage*=1.8;e.hp-=damage;e.flash=.06;
   if(e.hp>0)return;e.dead=true;s.kills++;s.combo++;s.comboTime=2;
   const identity={sourceId:e.id,kind:e.type,model:e.model||e.type,x:e.x,y:e.y};s.events.push({type:'kill',...identity});
   const cancelled=s.hazards.filter(h=>h.kind==='mortar'&&(h.source===e.id||h.linkedTo===e.id)&&!h.fired&&!h.launched).map(h=>({...h}));s.hazards=s.hazards.filter(h=>(h.source!==e.id&&h.linkedTo!==e.id)||h.fired||h.launched);if(cancelled.length&&(e.type==='artillery'||e.type==='scout'))s.events.push({type:'fireLinkBroken',sourceId:e.id,cancelled});
   if(e.type==='boss'){
    s.bossKills++;s.recovery=5;s.boss=10000;s.elite=Math.max(s.elite,6);s.overdrive=6;C.recruit(s,4);C.upgrade(s);s.events.push({type:'bossDown',...identity});if(s.mode==='endless'||s.encounter==='mixed'&&s.bossKills===1){s.stage=1;s.wave=s.mode==='endless'?s.wave+1:s.wave;s.boss=30;s.elite=7;s.regroupWave=0;s.special=10000;s.crate=0;s.regroupSupply=true;s.events.push({type:'objective',model:s.mode==='endless'&&s.wave%2?'dinosauria':'morpho',eta:30,wave:s.wave});}else{s.won=true;s.over=true;s.events.push({type:'won'});}
   }else if(e.type==='mine'){for(const other of [...s.enemies])if(!other.dead&&other!==e&&Math.hypot(e.x-other.x,e.y-other.y)<150)C.damageEnemy(s,other,85);s.events.push({type:'blast',x:e.x,y:e.y});}
   else if(!['normal','swarm'].includes(e.type)){
    s.events.push({type:'eliteDown',...identity});s.crates.push({id:s.nextId++,group:s.nextId++,kind:'shield',x:e.x,y:e.y,hp:1,max:1,drop:true});
   }
  },
  collect(s,box){
   if(box.used||s.over||(!box.drop&&!box.readable)||(!box.drop&&box.y<815))return;box.used=true;for(const b of s.crates)if(box.group!==undefined&&b.group===box.group)b.used=true;
   const before={hp:s.hp,shield:s.shield,count:s.count,charges:s.charges,level:s.level,ammo:s.ammo,overdrive:s.overdrive};
   s.stats.items++;
   if(['ap','he'].includes(box.kind)){s.ammo=box.kind;}else if(box.kind==='charge'){s.charges=Math.min(2,(s.charges||0)+1);}else if(box.kind==='emp'){
    s.hazards=s.hazards.filter(h=>h.fired||h.kind==='mortar'&&h.launched);for(const e of s.enemies){if(e.type!=='boss'){C.damageEnemy(s,e,140);e.charging=0;e.dashing=false;e.dashProgress=0;e.dashDuration=0;e.dashFromX=e.dashFromY=null;e.retreat=false;e.cooldown=1.5;}}
   }else if(box.kind==='overdrive')s.overdrive=7;
   else if(box.kind==='shield')s.shield=Math.min(s.maxHp,s.shield+(box.drop?20:35));
   else if(box.kind==='repair')s.hp=Math.min(s.maxHp,s.hp+30);
   else if(box.kind==='recruit')C.recruit(s,1);
   else C.upgrade(s);
   s.events.push({type:'item',kind:box.kind,x:box.x,y:box.y,group:box.group,before,after:{hp:s.hp,shield:s.shield,count:s.count,charges:s.charges,level:s.level,ammo:s.ammo,overdrive:s.overdrive}});
  },
  hitBossNode(s,boss,index,damage,source='shell'){
   if(boss.dead||boss.nodes[index]<=0||boss.intro>0)return;boss.nodes[index]=Math.max(0,boss.nodes[index]-damage);
   if(boss.nodes[index]===0){boss.exposed=1.5;boss.cooldown=boss.model==='morpho'?2.2:boss.model==='dinosauria'?Math.max(boss.cooldown,2.2):.65;boss.nodeRepair=boss.model==='dinosauria'?Infinity:10;boss.interrupts++;s.stats.interrupts++;if(boss.partDisabled)boss.partDisabled[index]=true;const allDown=boss.model==='dinosauria'&&boss.nodes.every(n=>n<=0);s.hazards=s.hazards.filter(h=>h.source!==boss.id||h.fired||(boss.model==='dinosauria'&&h.partIndex!==index&&!allDown)||(boss.model==='morpho'&&h.kind!=='sweep'&&h.partIndex!==index));s.events.push({type:'interrupt',x:boss.x+(index?105:-105),y:boss.y,index,source,sourceId:boss.id});s.events.push({type:'partBreak',x:boss.x+(index?105:-105),y:boss.y,index,source,sourceId:boss.id});}
  },
  telegraph(s,e,kind,x,width,delay,damage,lethal=false){const decoyX=kind!=='mine'&&s.decoy&&(Math.abs(x-s.x)<1||kind==='heavy'&&x===s.decoy.x)?s.decoy.x:undefined;s.hazards.push({source:e.id,model:e.model||e.type,kind,x:clamp(decoyX??x,110,890),y:e.y+20,width,delay,maxDelay:delay,life:kind==='rail'?.22:.3,fired:false,damage,lethal,partIndex:kind==='secondary'?(x<500?0:1):undefined,...(decoyX===undefined?{}:{decoyX})});},
  step(s,dt,target){
   if(s.over)return;dt=Math.min(dt,.05);s.events=[];s.time+=dt;const machine=C.machines[s.machine]||C.machines.m1a4;
   const boss=s.enemies.find(e=>e.type==='boss'&&!e.dead),regroup=(s.encounter==='mixed'||s.mode==='endless')&&s.stage===1&&!boss,d=C.difficulty(s.time),w=C.weapon(s.level);
   s.scroll+=dt*(boss?32:100);s.target=clamp(target,110,890);const oldX=s.x;s.x+=clamp((s.target-s.x)*16*dt,-machine.speed*dt,machine.speed*dt);s.velocity=(s.x-oldX)/dt;s.walk+=dt*(boss?4:10)+Math.abs(s.x-oldX)*.017;
   const brace=s.brace||0;s.brace=Math.abs(s.velocity)<25?brace+dt:0;if(s.machine==='m4a3'&&brace<.45&&s.brace>=.45)s.events.push({type:'braceReady',x:s.x,y:s.muzzleY});s.momentum=Math.min(100,(s.momentum||0)+Math.abs(s.x-oldX)*.1);s.tacticCooldown=Math.max(0,(s.tacticCooldown||0)-dt);if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=0)s.decoy=null;}const previousSources=s.jamSources||[],jamSources=s.enemies.filter(e=>!e.dead&&e.type==='jammer'&&Math.abs(e.x-s.x)<220).map(e=>({id:e.id,x:e.x,y:e.y})),wasJammed=!!s.jammed;s.jamSources=jamSources;s.jammed=jamSources.length>0;if(s.jammed!==wasJammed){const destroyed=!s.jammed&&previousSources.length>0&&previousSources.every(source=>!s.enemies.some(e=>e.id===source.id&&!e.dead));s.events.push({type:'jamChange',active:s.jammed,sources:jamSources,previousSources,reason:s.jammed?'entered':destroyed?'destroyed':'left'});}
   for(const key of ['invulnerable','overdrive','recovery'])s[key]=Math.max(0,s[key]-dt);
   if(s.count===s.maxCount)s.stats.fullTime+=dt;s.comboTime-=dt;if(s.comboTime<=0)s.combo=0;
   s.spawn-=dt;
   if(s.spawn<=0){
    s.spawn=d.interval/(s.recovery>0?.4:d.density)*(boss?1.7:1);
    if(s.enemies.length<180){
     const amount=boss?6:s.time<10?3:s.time<20?5:7+Math.min(3,Math.floor(s.time/45)),center=clamp(s.x+(s.random()-.5)*650,200,800);
     for(let i=0;i<amount;i++)C.spawnEnemy(s,s.random()<.35?'swarm':'normal',clamp(center+(i-(amount-1)/2)*58,45,955),-30-s.random()*100);
    }
   }
   if(s.encounter){s.special-=dt;if(s.special<=0&&!s.hazards.some(h=>h.lethal)&&s.enemies.filter(e=>['mine','jammer','artillery'].includes(e.type)).length<5){
    const sequence=s.encounter==='fire-support'?['artillery','jammer','artillery']:s.encounter==='mines'?['mine','mine','jammer']:['jammer','artillery','mine'];const type=sequence[s.specialWave++%sequence.length];
    if(type==='mine'){for(const x of [250,360,470])C.spawnSpecial(s,type,x,-20-s.random()*60);}else C.spawnSpecial(s,type,s.specialWave%2?230:770);s.special=boss?14:10;
   }}
   s.elite-=dt;
   if(regroup&&s.elite<=0&&s.recovery<=0&&!s.regroupSupply&&!s.crates.some(b=>!b.drop&&!b.used)){if(s.regroupWave===0){if(!s.enemies.some(e=>e.type==='charger'&&!e.dead))C.spawnEnemy(s,'charger',clamp(s.x+(s.random()<.5?-180:180),170,830),330);s.regroupWave=1;s.elite=11;}else if(s.regroupWave===1){if(!s.enemies.some(e=>e.type==='scout'&&!e.dead))C.spawnEnemy(s,'scout',350,260);if(!s.enemies.some(e=>e.type==='shield'&&!e.dead))C.spawnEnemy(s,'shield',650,260);s.regroupWave=2;s.elite=10000;}}
   else if(!regroup&&s.elite<=0&&s.recovery<=0&&s.enemies.filter(e=>!['normal','swarm','boss'].includes(e.type)).length<(boss?1:3)){
    const types=['charger','scout','shield'],type=s.encounter==='pursuit'?'charger':types[Math.floor(s.time/8)%3];C.spawnEnemy(s,type,clamp(s.x+(s.random()-.5)*450,170,830));s.elite=boss?9:Math.max(4.5,8-s.time/90);
   }
    s.boss-=dt;if(s.boss<=0&&!boss&&s.recovery<=0){if(s.encounter)C.spawnSpecial(s,s.mode==='endless'?(s.wave%2===0?'morpho':'dinosauria'):(s.encounter==='morpho'||s.stage===1?'morpho':'dinosauria'),500,-50);else C.spawnEnemy(s,'boss',500,-50);s.boss=10000;if(regroup){s.special=8;s.elite=9;}s.hazards=s.hazards.filter(h=>h.fired||h.kind==='mortar'&&h.launched);}
   s.gate-=dt;if(s.gate<=0){s.gate=18;}
   s.crate-=dt;if(s.crate<=0&&(!s.regroupSupply||!s.crates.some(b=>!b.drop&&!b.used))&&!s.hazards.some(h=>h.lethal&&!h.fired)){
    s.crate=s.regroupSupply?22:12;const group=s.nextId++,hp=1,side=s.random()<.5,kind=['repair','recruit','shield','emp','overdrive','repair'][Math.floor(s.time/12)%6];
    const pair=s.regroupSupply?['repair','charge']:s.encounter?([['ap','he'],['charge','repair'],['weapon','recruit'],['shield','charge']][s.supplyWave++%4]):null;for(let i=0;i<2;i++)s.crates.push({id:s.nextId++,group,x:i?735:265,y:0,kind:pair?pair[side?1-i:i]:i===(side?1:0)?'weapon':kind,hp,max:hp,readable:false,readyIn:2.5});s.regroupSupply=false;
   }
   for(const e of s.enemies){
    if(e.dead)continue;const oldY=e.y;e.age+=dt;e.flash=Math.max(0,e.flash-dt);e.recoil=Math.max(0,e.recoil-dt*6);e.exposed=Math.max(0,e.exposed-dt);
    if(C.specialEnemy(s,e,dt)){}else if(e.type==='boss'){
     e.intro=Math.max(0,e.intro-dt);
     if(e.ram>0){e.ram-=dt;const progress=1-e.ram/.85;e.x=e.ramX;e.y=480+Math.sin(Math.max(0,progress)*Math.PI)*290;}
     else{e.y+=clamp(480-e.y,-dt*360,dt*360);const ram=s.hazards.find(h=>h.source===e.id&&h.kind==='ram'&&!h.fired);e.x+=clamp((ram?e.ramX:500)-e.x,-dt*400,dt*400);}
     e.nodeRepair-=dt;if(e.nodeRepair<=0&&e.nodes.every(n=>n<=0)){e.nodes=[e.nodeMax,e.nodeMax];e.nodeRepair=10;}
     if(e.intro<=0){
      e.cooldown-=dt;
      if(e.cooldown<=0&&!s.crates.some(b=>!b.drop&&!b.used&&b.y>480&&b.y<820)&&!s.hazards.some(h=>!h.fired)&&!s.enemies.some(n=>n.charging>0||n.dashing)){
       const mode=e.attackCount%3,angry=e.hp<e.max*.45;e.attackCount++;e.cooldown=angry?1.95:2.55;
       const delay=angry?.95:1.1,damage=30;
       if(mode===0){C.telegraph(s,e,'rail',s.x,230,delay,999,true);s.events.push({type:'warning',text:'致命主砲 · 中心移出實線區域'});}
       else if(mode===1){C.telegraph(s,e,'barrage',s.x,170,delay,damage);C.telegraph(s,e,'barrage',s.x<500?s.x+280:s.x-280,170,delay+.3,damage);s.events.push({type:'warning',text:'連環轟炸 · 避開兩條標線'});}
       else{e.ramX=s.x;C.telegraph(s,e,'ram',s.x,290,1.3,999,true);s.events.push({type:'warning',text:'致命衝撞 · 立刻讓開正面'});}
      }
     }
    }else if(e.type==='charger'){
     if(e.dashing){if(!e.dashDuration){e.dashFromX=e.x;e.dashFromY=e.y;e.dashDuration=Math.hypot(e.chargeX-e.x,795-e.y)/740;e.dashProgress=0;}e.dashProgress=e.dashDuration?Math.min(1,e.dashProgress+dt/e.dashDuration):1;e.x=e.dashFromX+(e.chargeX-e.dashFromX)*e.dashProgress;e.y=e.dashFromY+(795-e.dashFromY)*e.dashProgress;if(e.dashProgress===1){e.dashing=false;e.cooldown=2.2;e.retreat=true;e.retreatY=Math.min(680,(s.muzzleY??690)-40);const hit=Math.abs(e.x-s.x)<e.r+65;s.events.push({type:'chargerBrake',sourceId:e.id,x:e.x,y:e.y,hit});if(hit){e.staggerDuration=0;C.hurt(s,35,false,{kind:'ram',model:'grauwolf',sourceId:e.id});e.recoil=1;s.events.push({type:'ramHit',x:e.x,y:805,source:'charger',sourceId:e.id,model:'grauwolf'});}else e.staggerDuration=e.decoyLocked?2.4:1.5;}}
     else if(e.retreat){e.y=Math.max(e.retreatY,e.y-dt*530);if(e.y===e.retreatY){e.retreat=false;e.stagger=e.staggerDuration;s.events.push({type:'stagger',x:e.x,y:e.y,source:'charger',sourceId:e.id,model:'grauwolf',duration:e.stagger});}}
     else if(e.stagger>0){e.stagger=Math.max(0,e.stagger-dt);e.y=e.retreatY;e.exposed=e.stagger;}
     else if(e.charging>0){e.charging-=dt;if(e.charging<=0){e.dashing=true;e.dashFromX=e.x;e.dashFromY=e.y;e.dashProgress=0;e.dashDuration=Math.hypot(e.chargeX-e.x,795-e.y)/740;e.recoil=1;s.events.push({type:'dash',sourceId:e.id,model:'grauwolf',x:e.x,y:e.y,targetX:e.chargeX,targetY:795,duration:e.dashDuration});}}
     else if(e.y>=330){e.cooldown-=dt;if(e.cooldown<=0&&!s.hazards.some(h=>!h.fired)&&!s.enemies.some(n=>!n.dead&&n!==e&&(n.charging>0||n.dashing))){e.chargeX=s.decoy?.x??s.x;e.chargeDecoyX=s.decoy?.x??null;e.decoyLocked=!!s.decoy;e.charging=1.0;e.attackCount++;s.stats.eliteShots++;s.events.push({type:'chargerWindup',sourceId:e.id,x:e.x,y:e.y,targetX:e.chargeX,duration:1,...(e.decoyLocked?{decoyX:e.chargeDecoyX}:{})});s.events.push({type:'warning',text:'突擊精英 · 鎖定後衝撞，橫移躲開'});}}
     else e.y+=dt*e.speed*1.3;
    }else if(e.type==='scout'||e.type==='shield'){
     if(e.y<280)e.y+=dt*e.speed;else e.y+=dt*8;e.cooldown-=dt;
     if(e.y>=240&&e.cooldown<=0&&!s.hazards.some(h=>!h.fired)&&!s.enemies.some(n=>n.charging>0||n.dashing)&&(!boss||boss.cooldown>1.6)){
      e.cooldown=e.type==='scout'?3:2.7;e.attackCount++;s.stats.eliteShots++;e.exposed=.85;
      const linked=e.type==='scout'?s.enemies.find(n=>n.type==='shield'&&!n.dead):null;
      C.telegraph(s,e,e.type==='scout'?'mark':'shell',s.x,e.type==='scout'?190:150,e.type==='scout'?1.05:.85,e.type==='scout'?15:30);
      if(linked){const h=s.hazards[s.hazards.length-1];h.linkedTo=linked.id;h.damage=30;h.delay=h.maxDelay=1.2;linked.exposed=1.2;linked.cooldown=3.5;}
      s.events.push({type:'warning',text:e.type==='scout'?(linked?'斥候引導主砲 · 擊破任一機可中斷':'斥候鎖定掃射 · 移出虛線'):'裝甲砲擊 · 架砲時裝甲展開'});
     }
    }else{e.y+=dt*e.speed;if(e.y>320&&e.y<795){const max=e.type==='swarm'?90:75,turn=e.type==='swarm'?180:140,desired=clamp((s.x-e.x)*.7,-max,max);e.lateral+=clamp(desired-e.lateral,-turn*dt,turn*dt);e.x=clamp(e.x+e.lateral*dt,35,965);}}
    e.walk+=Math.abs(e.y-oldY)*.042;
    if(!e.dead&&e.type!=='boss'&&e.type!=='charger'&&e.y>=795){
     if(Math.abs(e.x-s.x)<e.r+65){C.hurt(s,e.type==='charger'?35:e.type==='shield'?30:8,false,{kind:'contact',model:e.type,sourceId:e.id});e.dead=true;s.events.push({type:'kill',sourceId:e.id,kind:e.type,model:e.model||e.type,x:e.x,y:e.y});}
     if(e.y>1030)e.dead=true;
    }
   }
   if(s.over)return;
   for(const h of s.hazards){
    if(!h.fired){h.delay-=dt;const chargingSource=s.enemies.find(e=>e.id===h.source);if(h.kind==='mortar'&&!h.launched&&h.delay<=.45){h.launched=true;h.fromX=chargingSource?.x??h.origin?.fromX;h.fromY=chargingSource?.y??h.origin?.fromY;h.flightDuration=Math.max(0,h.delay);if(chargingSource)chargingSource.recoil=1;s.events.push({type:'mortarLaunch',x:h.x,y:805,fromX:h.fromX,fromY:h.fromY,sourceId:h.source,linkedTo:h.linkedTo,duration:h.flightDuration,width:h.width,volley:h.volley,shotIndex:h.shotIndex});}if(h.kind==='ram'&&h.delay<=.425&&chargingSource&&chargingSource.ram<=0)chargingSource.ram=.85;if(h.delay<=0){h.fired=true;if(h.kind==='mortar'){s.events.push({type:'mortarImpact',x:h.x,y:805,sourceId:h.source,linkedTo:h.linkedTo,width:h.width,volley:h.volley,shotIndex:h.shotIndex});if(Math.abs(s.x-h.x)<h.width/2)C.hurt(s,h.damage,h.lethal,h);continue;}const source=s.enemies.find(e=>e.id===(h.linkedTo||h.source));if(source){source.recoil=1;source.lastPart=h.partIndex;if(h.opensArmor)source.exposed=2.5;if(source.type==='boss')s.stats.bossShots++;if(h.kind==='sweep'&&source.model==='morpho'&&source.recoveryVolley!==h.volley){source.recoveryVolley=h.volley;source.exposed=2.2;s.events.push({type:'bossRecovery',sourceId:source.id,model:'morpho',x:source.x,y:source.y,duration:2.2});}if(h.opensArmor&&source.model==='dinosauria'&&source.recoveryVolley!==h.volley){source.recoveryVolley=h.volley;s.events.push({type:'bossRecovery',sourceId:source.id,model:'dinosauria',x:source.x,y:source.y,duration:2.5});}}
     s.events.push({type:'cannon',x:h.x,y:790,kind:h.kind,sourceId:source?.id,model:source?.model||source?.type,volley:h.volley,partIndex:h.partIndex??null,width:h.width,fromX:source?source.x+(Number.isInteger(h.partIndex)?(h.partIndex?105:-105):0):undefined,fromY:source?.y});if(Math.abs(s.x-h.x)<h.width/2)C.hurt(s,h.damage,h.lethal,h);
    }}else{h.life-=dt;if(h.persistent){h.tick=(h.tick||0)-dt;if(h.tick<=0){if(Math.abs(s.x-h.x)<h.width/2)C.hurt(s,8,false,h);h.tick=.65;}}if(h.lethal&&Math.abs(s.x-h.x)<h.width/2)C.hurt(s,h.damage,true,h);}
   }
   s.hazards=s.hazards.filter(h=>h.life>0);if(s.over)return;
   s.shot-=dt;s.mg-=dt;s.blade-=dt;
   const formation=C.formation(s);
   s.fireControl=formation.map(unit=>{const y=s.muzzleScale?unit.y-s.muzzleScale*(.48+.52*unit.y/1000)*(unit.main?1:.82):s.muzzleY+unit.y-792,close=s.enemies.filter(e=>!e.dead&&e.y>(s.jammed?520:150)&&e.y<y&&Math.abs(e.x-unit.x)<(e.type==='boss'?180:105)).sort((a,b)=>b.y-a.y)[0],aimX=close?.type==='boss'&&unit.main&&Math.abs(unit.x-close.x)>50&&close.nodes[unit.x<close.x?0:1]>0?close.x+(unit.x<close.x?-105:105):close?.x;return {main:unit.main,x:unit.x,y,target:close?{id:close.id,x:close.x,y:close.y,kind:close.type,model:close.model||null,aimX}:null,aim:close?clamp((aimX-unit.x)*900/Math.max(90,y-close.y),-200,200):0};});
   if(s.shot<=0||s.mg<=0){
    const cannon=s.shot<=0,machinegun=s.mg<=0;
    const boost=s.machine==='m4a3'&&s.brace>=.45?'brace':s.machine==='xm2'&&s.momentum>=90?'momentum':'none';
    if(cannon){const y=s.muzzleScale?792-s.muzzleScale*(.48+.52*792/1000):s.muzzleY,damage=w.damage*machine.damage*(boost==='brace'?1.7:boost==='momentum'?1.8:1)*(s.ammo==='ap'?1.4:s.ammo==='he'?.8:1);s.shot=w.interval*machine.interval*(s.ammo==='ap'?1.25:1)*(s.overdrive>0?.62:1);s.volley++;s.events.push({type:'mainShot',machine:s.machine,x:s.x,y,boost,damage,ammo:s.ammo});if(boost==='momentum'){s.momentum=0;s.events.push({type:'momentum',x:s.x,y});}}
    if(machinegun){s.mg=.16*(s.overdrive>0?.72:1);s.events.push({type:'shot'});}
    for(const control of s.fireControl){const {main,x:unitX,y,aim}=control;
     if(cannon)s.bullets.push({x:unitX,y,px:unitX,py:y,vx:aim,damage:w.damage*machine.damage*(main?1:.75)*(boost==='brace'?1.7:boost==='momentum'?1.8:1)*(s.ammo==='ap'?1.4:s.ammo==='he'?.8:1),life:1.6,left:s.ammo==='ap'?4:s.ammo==='he'?1:w.pierce,explosive:s.ammo!=='ap'&&main,armorPiercing:s.ammo==='ap'||boost==='brace',he:s.ammo==='he',ammo:s.ammo,shell:true,controlled:main,boost,hit:[]});
     if(machinegun)s.bullets.push({x:unitX+9,y:y+16,px:unitX+9,py:y+16,vx:aim,damage:2.8+s.level*.45,life:1.6,left:1,explosive:false,hit:[]});
    }
   }
   if(s.machine!=='m4a3'&&s.blade<=0){const near=s.enemies.find(e=>!e.dead&&e.type!=='boss'&&e.y>(s.machine==='xm2'?610:690)&&e.y<800&&Math.abs(e.x-s.x)<(s.machine==='xm2'?150:100));if(near){const target={id:near.id,x:near.x,y:near.y,kind:near.type,model:near.model||null},before=near.hp;s.blade=s.machine==='xm2'?1.25:2.4;C.damageEnemy(s,near,s.machine==='xm2'?110+s.level*8:45+s.level*5);s.events.push({type:'blade',machine:s.machine,x:s.x,y:s.muzzleY,target,actualDamage:Math.min(before,before-near.hp),killed:near.dead});}}
   const targets=s.enemies.filter(e=>!e.dead).sort((a,b)=>b.y-a.y);
   for(const b of s.bullets){
    b.px=b.x;b.py=b.y;b.life-=dt;b.y-=dt*900;b.x+=dt*b.vx;if(b.life<=0)continue;
    for(const e of targets){
     if(e.dead||b.hit.includes(e.id)||e.intro>0)continue;const ry=e.type==='boss'?45:20;
     if(Math.abs(b.x-e.x)>e.r+5||e.y<b.y-ry||e.y>b.py+ry)continue;b.hit.push(e.id);
      if(e.type==='boss'){
      const index=b.x<e.x?0:1,nodeHit=Math.abs(b.x-(e.x+(index?105:-105)))<32&&e.nodes[index]>0,before=nodeHit?e.nodes[index]:e.hp;if(nodeHit){if(b.shell&&b.controlled!==false)C.hitBossNode(s,e,index,b.damage,'shell');}
      else C.damageEnemy(s,e,b.damage*(e.exposed>0?2.2:e.model==='dinosauria'?(b.armorPiercing?.65:.25):e.model==='morpho'?.5:.8));
      if(b.shell)s.events.push({type:'impact',x:b.x,y:e.y,kind:'boss',model:e.model,part:nodeHit,armored:!nodeHit&&e.exposed<=0&&e.model==='dinosauria'&&!b.armorPiercing,boost:b.boost||'none',shell:!!b.shell,ammo:b.ammo||'standard',targetId:e.id,damage:Math.min(before,Math.max(0,before-(nodeHit?e.nodes[index]:e.hp))),killed:e.dead,penetrating:b.left>1});
     }else{
      const armor=e.type==='shield'&&e.exposed<=0?(b.armorPiercing?1:b.left>1?.8:.45):e.type==='charger'&&!e.stagger?(b.armorPiercing?.9:.65):1,before=e.hp;C.damageEnemy(s,e,b.damage*armor);if(b.shell)s.events.push({type:'impact',x:b.x,y:e.y,kind:e.type,armored:armor<1,boost:b.boost||'none',shell:true,ammo:b.ammo||'standard',targetId:e.id,damage:Math.min(before,Math.max(0,before-e.hp)),killed:e.dead,penetrating:b.left>1});
      if(b.explosive){const radius=b.he?165:w.explosive?120:90,hits=[];for(const other of targets)if(other!==e&&!other.dead&&other.type!=='boss'&&Math.hypot(e.x-other.x,e.y-other.y)<radius){const before=other.hp;C.damageEnemy(s,other,b.damage*(w.explosive?1.25:1));const damage=Math.min(before,Math.max(0,before-other.hp));if(damage>0)hits.push({id:other.id,kind:other.type,model:other.model||other.type,x:other.x,y:other.y,damage,killed:other.dead});}s.events.push({type:'blast',x:e.x,y:e.y,ammo:b.ammo||'standard',radius,directTarget:{id:e.id,kind:e.type,model:e.model||e.type,x:e.x,y:e.y},hits});b.explosive=false;}
     }
     b.left--;b.damage*=.7;if(b.left<=0){b.life=0;break;}
    }
    if(b.life<=0)continue;
    for(const gate of s.gates)if(Math.abs(b.x-gate.x)<135&&gate.y>=b.y-8&&gate.y<=b.py+8)gate.hits++;
   }
   s.bullets=s.bullets.filter(b=>b.life>0&&b.y>-65&&b.x>-30&&b.x<1030);s.enemies=s.enemies.filter(e=>!e.dead);
   s.stats.peakEnemies=Math.max(s.stats.peakEnemies,s.enemies.length);
   for(const gate of s.gates){gate.y+=dt*130;if(gate.y>=805&&!gate.used){gate.used=true;if(Math.abs(s.x-gate.x)<150)C.recruit(s,C.gateValue(gate.base,gate.hits,gate.cap));}}
   s.gates=s.gates.filter(g=>g.y<1050);
   if(s.over)return;
   for(const box of s.crates){
    box.y+=dt*120;if(!box.drop&&!box.readable){box.readyIn-=dt;if(box.readyIn<=0)box.readable=true;}
    if(!box.used&&box.y>=815){if(Math.abs(s.x-box.x)<80)C.collect(s,box);box.used=true;}
   }

   s.crates=s.crates.filter(b=>!b.used&&b.y<1030);
  }
 };
 if(typeof module!=='undefined')module.exports=C;else root.GameCore=C;
})(globalThis);

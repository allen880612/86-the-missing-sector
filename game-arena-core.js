(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const distanceToSegment=(px,py,x1,y1,x2,y2)=>{
  const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy;
  if(!length)return Math.hypot(px-x1,py-y1);
 const t=clamp(((px-x1)*dx+(py-y1)*dy)/length,0,1);
  return Math.hypot(px-(x1+dx*t),py-(y1+dy*t));
 };
 const segmentRect=(x1,y1,x2,y2,o,pad=0)=>{
  const left=o.x-o.w/2-pad,right=o.x+o.w/2+pad,top=o.y-o.h/2-pad,bottom=o.y+o.h/2+pad;
  let near=0,far=1;
  for(const [start,delta,min,max] of [[x1,x2-x1,left,right],[y1,y2-y1,top,bottom]]){
   if(Math.abs(delta)<1e-9){if(start<min||start>max)return null;continue;}
   let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
  }
  return near;
 };
 const circleRect=(x,y,r,o)=>{
  const nx=clamp(x,o.x-o.w/2,o.x+o.w/2),ny=clamp(y,o.y-o.h/2,o.y+o.h/2);
  return Math.hypot(x-nx,y-ny)<r-1e-6;
 };
 const obstacleHit=(s,x1,y1,x2,y2,pad=0)=>{
  let hit=null;
  for(const o of s.obstacles||[]){if(o.dead)continue;const t=segmentRect(x1,y1,x2,y2,o,pad);if(t!==null&&(!hit||t<hit.t))hit={o,t,x:x1+(x2-x1)*t,y:y1+(y2-y1)*t};}
  return hit;
 };
 const blocked=(s,body,x,y,others=true)=>{
  const bounds=body===s?s.bounds:{left:0,right:1000,top:0,bottom:1000};
  if(x-body.r<bounds.left||x+body.r>bounds.right||y-body.r<bounds.top||y+body.r>bounds.bottom)return true;
  if((s.obstacles||[]).some(o=>!o.dead&&circleRect(x,y,body.r,o)))return true;
  if(!others)return false;
  if(body!==s&&Math.hypot(x-s.x,y-s.y)<body.r+22-1e-6)return true;
  return (s.enemies||[]).some(e=>e!==body&&!e.dead&&Math.hypot(x-e.x,y-e.y)<body.r+e.r-1e-6);
 };
 const moveCircle=(s,body,dx,dy,others=true)=>{
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6)),sx=dx/steps,sy=dy/steps;
  for(let i=0;i<steps;i++){
   if(!blocked(s,body,body.x+sx,body.y+sy,others)){body.x+=sx;body.y+=sy;continue;}
   if(!blocked(s,body,body.x+sx,body.y,others))body.x+=sx;
   if(!blocked(s,body,body.x,body.y+sy,others))body.y+=sy;
  }
 };
 const routeTarget=(s,e,target)=>{
  let o=e.route&&s.obstacles.find(o=>o.id===e.route.id&&!o.dead);
  if(!o){const hit=obstacleHit(s,e.x,e.y,target.x,target.y,e.r+4);if(!hit){e.route=null;return target;}o=hit.o;const p=e.r+10,horizontal=Math.abs(target.x-e.x)>=Math.abs(target.y-e.y);
   if(horizontal){const top=o.y-o.h/2-p,bottom=o.y+o.h/2+p,side=Math.abs(e.y-top)+Math.abs(target.y-top)<=Math.abs(e.y-bottom)+Math.abs(target.y-bottom)?top:bottom;e.route={id:o.id,stage:0,nearX:e.x<o.x?o.x-o.w/2-p:o.x+o.w/2+p,farX:e.x<o.x?o.x+o.w/2+p:o.x-o.w/2-p,y:side,horizontal:true};}
   else {const left=o.x-o.w/2-p,right=o.x+o.w/2+p,side=Math.abs(e.x-left)+Math.abs(target.x-left)<=Math.abs(e.x-right)+Math.abs(target.x-right)?left:right;e.route={id:o.id,stage:0,nearY:e.y<o.y?o.y-o.h/2-p:o.y+o.h/2+p,farY:e.y<o.y?o.y+o.h/2+p:o.y-o.h/2-p,x:side,horizontal:false};}
  }
  const r=e.route,waypoint=r.horizontal?{x:r.stage?r.farX:r.nearX,y:r.y}:{x:r.x,y:r.stage?r.farY:r.nearY};
  if(Math.hypot(e.x-waypoint.x,e.y-waypoint.y)<8){if(!r.stage)r.stage=1;else{e.route=null;return target;}return routeTarget(s,e,target);}
  return waypoint;
 };
 const C={
  machines:{
   m1a4:{name:'M1A4 破壞神',hp:100,speed:300,interval:.24,damage:24,projectileSpeed:760,r:6},
   m4a3:{name:'M4A3 破壞之杖',hp:160,speed:225,interval:.38,damage:42,projectileSpeed:650,r:9},
   xm2:{name:'XM2 女武神',hp:80,speed:360,interval:.18,damage:22,projectileSpeed:900,r:5}
  },
  create:(random=Math.random)=>({
   random,time:0,x:500,y:500,target:500,velocity:0,muzzleY:500,count:3,maxCount:4,
   hp:100,maxHp:100,shield:0,kills:0,bossKills:0,level:0,over:false,won:false,
   enemies:[],bullets:[],gates:[],crates:[],hazards:[],events:[],nextId:1,shot:0,
   wingShot:0,spawn:.8,boss:40,bossWarned:false,pickupTimer:8,spawnSide:0,wave:1,
   charges:1,tacticCooldown:0,invulnerable:0,angle:-Math.PI/2,aimX:500,aimY:200,r:22,
   burstTime:0,burstCooldown:0,dashCooldown:0,dash:null,supplyGroup:0,
   walk:0,scroll:0,brace:0,momentum:0,blade:0,overdrive:0,combo:0,comboTime:0,moving:false,moveAngle:0,
   stats:{recruits:0,damage:0,interrupts:0,fullTime:0,bossShots:0,eliteShots:0,peakEnemies:0,items:0,tactics:0,hits:0}
  }),
  setup(s,options={}){
   s.machine=C.machines[options.machine]?options.machine:'m1a4';
   const machine=C.machines[s.machine];
   s.hp=s.maxHp=machine.hp;s.shield=25;s.dash=null;s.dashCooldown=0;s.mode='endless';s.arena=true;s.encounter='arena';
   s.ammo=['ap','he'].includes(options.ammo)?options.ammo:'standard';
   s.tactic=options.tactic==='decoy'?'decoy':'support';
   s.x=s.y=500;s.bounds={left:90,right:910,top:120,bottom:900};
   s.obstacles=[
    {id:'cover-1',x:290,y:330,w:110,h:90,hp:180,max:180,dead:false},
    {id:'cover-2',x:710,y:360,w:130,h:70,hp:180,max:180,dead:false},
    {id:'cover-3',x:320,y:700,w:140,h:70,hp:180,max:180,dead:false},
    {id:'cover-4',x:700,y:700,w:100,h:100,hp:180,max:180,dead:false}
   ];
   return s;
  },
  formation(s){
   const result=[{x:s.x,y:s.y,angle:s.angle,main:true}],count=Math.max(0,s.count-1);
   const fx=Math.cos(s.angle),fy=Math.sin(s.angle),px=-fy,py=fx;
   for(let i=0;i<count;i++){
    const row=i<2?1:2,side=i%2?-1:1;
    result.push({x:s.x-fx*42*row+px*side*(i<2?38:0),y:s.y-fy*42*row+py*side*(i<2?38:0),angle:s.angle,main:false});
   }
   return result;
  },
  spawnEnemy(s,type='normal',x,y){
   if(type==='boss'&&s.enemies.some(e=>e.type==='boss'&&!e.dead))return null;
   if(type!=='boss'&&s.enemies.filter(e=>!e.dead).length>=70)return null;
   const explicit=x!==undefined&&y!==undefined;
   let side,along;
   if(x===undefined||y===undefined){
    side=['top','right','bottom','left'][s.spawnSide++%4];
    along=160+s.random()*680;
    if(side==='top'){x=along;y=92;}else if(side==='right'){x=938;y=along;}
    else if(side==='bottom'){x=along;y=928;}else{x=62;y=along;}
   }else{
    const edge=Math.min(y,1000-x,1000-y,x);
    side=edge===y?'top':edge===1000-x?'right':edge===1000-y?'bottom':'left';
    along=side==='top'||side==='bottom'?x:y;
   }
   const scale=Math.min(2.4,1+s.time/180);
   const boss=type==='boss',hp=boss?1800+Math.min(2200,s.bossKills*500):type==='charger'?140:type==='artillery'?180:32*scale;
   const e={id:s.nextId++,type,x,y,side,hp,max:hp,r:boss?105:type==='artillery'?36:type==='charger'?32:18,
    speed:boss?42:type==='artillery'?70:type==='charger'?128:82+Math.min(70,s.time*.3),dead:false,flash:0,walk:0,
    angle:Math.atan2(s.y-y,s.x-x),cooldown:type==='artillery'?2.4:.5,contactCooldown:0,
    phase:'approach',windup:0,lockedX:null,lockedY:null,stagger:0,attackCount:0,nodes:[],exposed:0};
   const sides=['top','right','bottom','left'],start=sides.indexOf(side),valid=(cx,cy)=>cx-e.r>=0&&cx+e.r<=1000&&cy-e.r>=0&&cy+e.r<=1000&&
    !(s.obstacles||[]).some(o=>!o.dead&&circleRect(cx,cy,e.r,o))&&Math.hypot(cx-s.x,cy-s.y)>=e.r+22&&
    !s.enemies.some(other=>!other.dead&&Math.hypot(cx-other.x,cy-other.y)<e.r+other.r);
   let placed=explicit&&valid(e.x,e.y);
   for(let edge=0;edge<4&&!placed;edge++)for(let attempt=0;attempt<=24&&!placed;attempt++){
    const candidateSide=sides[(start+edge)%4],offset=attempt?Math.ceil(attempt/2)*(e.r*2+6)*(attempt%2?1:-1):0,candidate=clamp(along+offset,e.r,1000-e.r);
    const cx=candidateSide==='left'?e.r:candidateSide==='right'?1000-e.r:candidate;
    const cy=candidateSide==='top'?e.r:candidateSide==='bottom'?1000-e.r:candidate;
    if(valid(cx,cy)){e.x=cx;e.y=cy;e.side=candidateSide;placed=true;}
   }
   if(!placed)return null;
   s.enemies.push(e);
   if(boss)s.events.push({type:'bossEnter',x:e.x,y:e.y,model:e.model});
   else if(type!=='normal')s.events.push({type:'elite',kind:type,x:e.x,y:e.y});
   return e;
  },
  spawnSpecial(s,type,x,y){
   if(['dinosauria','morpho'].includes(type)){
    if(s.enemies.some(e=>e.type==='boss'&&!e.dead))return null;
    const e=C.spawnEnemy(s,'boss',x,y);
    if(!e)return null;
    e.model=type;e.hp=e.max=type==='dinosauria'?2200:2600;e.cooldown=2.6;e.intro=1.2;
    const enter=s.events.findLast?.(event=>event.type==='bossEnter');if(enter)enter.model=type;
    return e;
   }
   return C.spawnEnemy(s,type,x,y);
  },
  collect(s,box){
   if(box.used||s.over)return false;
   const before={hp:s.hp,shield:s.shield,charges:s.charges,count:s.count,level:s.level,overdrive:s.overdrive,ammo:s.ammo};
   if(box.kind==='repair')s.hp=Math.min(s.maxHp,s.hp+30);
   else if(box.kind==='shield')s.shield=Math.min(s.maxHp,s.shield+35);
   else if(box.kind==='charge')s.charges=Math.min(2,s.charges+1);
   else if(box.kind==='recruit'){const count=s.count;s.count=Math.min(s.maxCount,s.count+1);s.stats.recruits+=s.count-count;}
   else if(box.kind==='weapon')s.level=Math.min(8,s.level+1);
   else if(box.kind==='ap')s.ammo='ap';
   else if(box.kind==='he')s.ammo='he';
   else if(box.kind==='overdrive')s.overdrive=7;
   else if(box.kind==='emp'){
    const hits=[];
    for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-box.x,e.y-box.y)<=230+e.r){
     const damage=e.type==='boss'?0:C.damageEnemy(s,e,140);e.stagger=Math.max(e.stagger,e.type==='boss'?.8:1);
     if(e.type==='charger'){e.phase='stagger';e.windup=0;}hits.push({id:e.id,damage,killed:e.dead});
    }
    const ids=new Set(hits.map(hit=>hit.id));s.hazards=s.hazards.filter(h=>h.fired||!ids.has(h.source));s.stats.interrupts+=hits.length;
    s.events.push({type:'emp',x:box.x,y:box.y,radius:230,hits});
   }
   const after={hp:s.hp,shield:s.shield,charges:s.charges,count:s.count,level:s.level,overdrive:s.overdrive,ammo:s.ammo};
   box.used=true;s.stats.items++;
   const event={type:'collect',kind:box.kind,x:box.x,y:box.y,before,after};
   s.events.push(event);
   if(box.kind==='weapon'&&after.level>before.level)s.events.push({type:'upgrade',x:box.x,y:box.y,level:s.level});
   return true;
  },
  damageEnemy(s,e,damage){
   if(!e||e.dead)return 0;
   if(e.type==='boss'&&e.exposed>0)damage*=1.6;
   const before=e.hp;e.hp-=damage;e.flash=.06;
   if(e.hp>0)return before-e.hp;
   e.hp=0;e.dead=true;s.kills++;
   const identity={sourceId:e.id,kind:e.type,model:e.model||e.type,x:e.x,y:e.y,angle:e.angle};
   s.events.push({type:'kill',...identity});
   if(e.type==='boss'){
    s.bossKills++;s.wave++;s.boss=25;s.bossWarned=false;
    s.events.push({type:'bossDown',...identity});
    s.crates.push({id:s.nextId++,kind:s.hp<s.maxHp*.55?'repair':'weapon',x:e.x,y:e.y,used:false,drop:true,life:30});
   }else if(e.type!=='normal'||s.kills%6===0){
    const kinds=['charge','repair','weapon'];
    s.crates.push({id:s.nextId++,kind:kinds[Math.floor(s.kills/6)%kinds.length],x:e.x,y:e.y,used:false,drop:true,life:30});
    if(e.type!=='normal')s.events.push({type:'eliteDown',...identity});
   }
   s.hazards=s.hazards.filter(h=>h.source!==e.id||h.fired);
   return before;
  },
  hurt(s,amount,lethal=false,source={}){
   if(s.over||(!lethal&&s.invulnerable>0))return 0;
   const shieldBefore=s.shield,absorbed=lethal?0:Math.min(s.shield,amount);s.shield=lethal?0:s.shield-absorbed;amount-=absorbed;
   const before=s.hp;s.hp=lethal?0:Math.max(0,s.hp-amount);const actual=before-s.hp;
   s.stats.damage+=actual;s.stats.hits++;s.invulnerable=lethal?0:.55;
   s.lastDamage={kind:source.kind||'unknown',model:source.model||'unknown',sourceId:source.sourceId??source.source??null,time:s.time,amount:actual,absorbed,lethal};
   if(absorbed)s.events.push({type:'shieldAbsorb',x:s.x,y:s.y,amount:absorbed,before:shieldBefore,after:s.shield});
   s.events.push({type:'hurt',x:s.x,y:s.y,amount:actual,absorbed,shieldBefore,shieldAfter:s.shield,lethal,source:s.lastDamage});
   if(s.hp<=0){s.count=0;s.over=true;s.events.push({type:'over'});}
   return actual;
  },
  result(s){
   if(!s.over)return null;
   return Object.freeze({won:false,time:s.time,kills:s.kills,bossKills:s.bossKills,wave:s.wave,mode:'endless',level:s.level,
    damage:s.stats.damage,hits:s.stats.hits,interrupts:s.stats.interrupts,items:s.stats.items,tactics:s.stats.tactics,
    machine:s.machine,encounter:'arena',ammo:s.ammo,tactic:s.tactic,lastDamage:s.lastDamage?Object.freeze({...s.lastDamage}):null});
  },
  useTactic(s,aim){
   if(s.over||!s.charges||s.tacticCooldown>0)return false;
   const x=clamp(aim?.x??aim?.aimX??s.aimX,s.bounds.left,s.bounds.right),y=clamp(aim?.y??aim?.aimY??s.aimY,s.bounds.top,s.bounds.bottom),radius=230;
   s.charges--;s.tacticCooldown=1;s.stats.tactics++;
   if(s.tactic==='decoy'){
    s.decoy={x,y,life:6};
    s.events.push({type:'tactic',kind:'decoy',x,y,radius:40,duration:6,hits:[]});
    return true;
   }
   s.hazards.push({geometry:'circle',x,y,r:radius,fromX:x,fromY:y,toX:x,toY:y,width:0,delay:.65,maxDelay:.65,fired:false,life:.3,source:null,model:'player',kind:'support',damage:0,playerImmune:true});
   s.events.push({type:'tactic',kind:'support',x,y,radius,delay:.65,hits:[]});
   return true;
  },
  useAbility(s,kind,input={}){
   if(s.over)return false;
   if(kind==='burst'){
    if(s.burstCooldown>0)return false;s.burstTime=3;s.burstCooldown=9;
    if(Number.isFinite(input.aimX))s.aimX=input.aimX;if(Number.isFinite(input.aimY))s.aimY=input.aimY;
    s.events.push({type:'ability',kind:'burst',duration:3,cooldown:9});return true;
   }
   if(kind==='dash'){
    if(s.dashCooldown>0)return false;
    let dx=Number(input.moveX)||0,dy=Number(input.moveY)||0,d=Math.hypot(dx,dy);
    if(d<.01){const angle=s.moving?s.moveAngle:Math.atan2((input.aimY??s.aimY)-s.y,(input.aimX??s.aimX)-s.x);dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    s.dash={fromX:s.x,fromY:s.y,dirX:dx/d,dirY:dy/d,elapsed:0,duration:.22,remaining:.22};s.dashCooldown=3;
    s.events.push({type:'ability',kind:'dash',fromX:s.x,fromY:s.y,x:s.x,y:s.y,distance:100,duration:.22,cooldown:3});return true;
   }
   return false;
  },
  insideHazard(s,h){
   if(h.geometry==='circle')return Math.hypot(s.x-h.x,s.y-h.y)<=h.r;
   if(h.geometry==='beam')return distanceToSegment(s.x,s.y,h.fromX,h.fromY,h.toX,h.toY)<=h.width/2;
   return false;
  },
  fire(s,machine){
   if(s.shot>0)return;
   const dx=s.aimX-s.x,dy=s.aimY-s.y,length=Math.hypot(dx,dy);if(length<1)return;
   const ammoDamage=s.ammo==='ap'?1.25:s.ammo==='he'?.85:1,level=Math.min(8,s.level);
   const damage=(machine.damage+level*2.5)*ammoDamage;
   s.bullets.push({x:s.x,y:s.y,px:s.x,py:s.y,vx:dx/length*machine.projectileSpeed,vy:dy/length*machine.projectileSpeed,r:machine.r,damage,enemy:false,life:1.5,shell:true,ammo:s.ammo,left:s.ammo==='ap'?2:1,hitIds:[]});
   s.shot=Math.max(.11,machine.interval-level*.008)*(s.ammo==='ap'?1.25:1);
   const event={type:'shoot',machine:s.machine,x:s.x,y:s.y,angle:s.angle,boost:'none',damage,ammo:s.ammo};
   s.events.push(event,{...event,type:'mainShot'});
  },
  addHazard(s,geometry,source,kind,target,delay,damage){
   const model=source.model||source.type;
   if(geometry==='circle')s.hazards.push({geometry,x:target.x,y:target.y,r:target.r||80,fromX:source.x,fromY:source.y,toX:target.x,toY:target.y,width:0,delay,maxDelay:delay,fired:false,life:.3,source:source.id,model,kind,damage,exposeAfter:!!target.exposeAfter});
   else{
    const rawToX=target.x,rawToY=target.y,hit=obstacleHit(s,source.x,source.y,rawToX,rawToY,0);
    const toX=hit?hit.x:rawToX,toY=hit?hit.y:rawToY;
    s.hazards.push({geometry,fromX:source.x,fromY:source.y,toX,toY,rawToX,rawToY,width:target.width||46,x:toX,y:toY,r:0,delay,maxDelay:delay,fired:false,life:.24,source:source.id,model,kind,damage,heavy:!!target.heavy,blockedBy:hit?.o.id||null,exposeAfter:!!target.exposeAfter});
   }
  },
  updateEnemy(s,e,dt){
   if(e.dead)return;
   e.flash=Math.max(0,e.flash-dt);e.contactCooldown=Math.max(0,e.contactCooldown-dt);e.exposed=Math.max(0,(e.exposed||0)-dt);
   const hadStagger=e.stagger>0;e.stagger=Math.max(0,e.stagger-dt);
   const target=s.decoy||s,routed=routeTarget(s,e,target),dx=routed.x-e.x,dy=routed.y-e.y,d=Math.hypot(dx,dy)||1;e.angle=Math.atan2(target.y-e.y,target.x-e.x);
   if(hadStagger)return;
   if(e.type==='boss'){
    e.intro=Math.max(0,(e.intro||0)-dt);e.cooldown-=dt;
    const targetDistance=Math.hypot(target.x-e.x,target.y-e.y);
    if(targetDistance>320)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
    if(e.intro<=0&&e.cooldown<=0){
     e.attackCount++;e.cooldown=e.hp<e.max*.45?2.8:3.7;
     if(e.model==='dinosauria'){
      C.addHazard(s,'circle',e,'mortar',{x:target.x,y:target.y,r:150},1.15,30);
      const base=Math.atan2(target.y-e.y,target.x-e.x);
      for(const spread of [-.32,0,.32])C.addHazard(s,'beam',e,'rail',{x:e.x+Math.cos(base+spread)*900,y:e.y+Math.sin(base+spread)*900,width:38,heavy:true,exposeAfter:spread===.32},1.3,34);
     }else{
      C.addHazard(s,'beam',e,'rail',{x:target.x+(target.x-e.x)*2,y:target.y+(target.y-e.y)*2,width:58,heavy:true},1.5,44);
      const side=e.attackCount%2?1:-1;
      C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x+side*105,s.bounds.left,s.bounds.right),y:target.y,r:82},1.75,28);
      C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x-side*105,s.bounds.left,s.bounds.right),y:target.y,r:82,exposeAfter:true},2.15,28);
     }
     s.stats.bossShots++;s.events.push({type:'warning',kind:e.model,x:s.x,y:s.y});
    }
    if(targetDistance<=e.r+22&&e.contactCooldown<=0){C.hurt(s,35,false,{kind:'contact',model:e.model,sourceId:e.id});e.contactCooldown=.8;}
    return;
   }
   if(e.type==='artillery'){
    const targetDistance=Math.hypot(target.x-e.x,target.y-e.y);
    if(targetDistance<270)moveCircle(s,e,-dx/d*e.speed*dt,-dy/d*e.speed*dt);else if(targetDistance>390)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
    e.cooldown-=dt;if(e.cooldown<=0){e.cooldown=3.8;C.addHazard(s,'circle',e,'mortar',{x:target.x,y:target.y,r:78},1.1,24);s.stats.eliteShots++;s.events.push({type:'warning',kind:'mortar',x:target.x,y:target.y});}
    return;
   }
   if(e.type==='charger'){
    if(e.stagger>0)return;
    if(e.phase==='windup'){e.windup-=dt;if(e.windup<=0)e.phase='dash';return;}
    if(e.phase==='dash'){
     const tx=e.lockedX-e.x,ty=e.lockedY-e.y,left=Math.hypot(tx,ty);
     if(left<18){e.phase='stagger';e.stagger=1.15;return;}
     const move=Math.min(left,430*dt),beforeX=e.x,beforeY=e.y;moveCircle(s,e,tx/left*move,ty/left*move);
     if(Math.hypot(e.x-beforeX,e.y-beforeY)<move*.25){if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5)C.hurt(s,28,false,{kind:'ram',model:'charger',sourceId:e.id});e.phase='stagger';e.stagger=1.15;return;}
     if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5){C.hurt(s,28,false,{kind:'ram',model:'charger',sourceId:e.id});e.phase='stagger';e.stagger=1.15;}
     return;
    }
    if(e.phase==='stagger'){if(e.stagger<=0){e.phase='approach';e.cooldown=1.4;}return;}
    e.cooldown-=dt;
    if(d<250&&e.cooldown<=0){e.phase='windup';e.windup=.9;e.lockedX=target.x;e.lockedY=target.y;C.addHazard(s,'beam',e,'charge',{x:e.lockedX,y:e.lockedY,width:2*(e.r+18)},.9,0);s.events.push({type:'warning',kind:'charger',x:e.lockedX,y:e.lockedY,sourceId:e.id});return;}
   }
   moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
   if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5&&e.contactCooldown<=0){C.hurt(s,e.type==='charger'?28:10,false,{kind:'contact',model:e.type,sourceId:e.id});e.contactCooldown=.8;}
  },
  step(s,dt,input={}){
   if(s.over)return s;dt=Math.min(.05,Math.max(0,dt));s.events=[];s.time+=dt;
   const machine=C.machines[s.machine]||C.machines.m1a4;
   let mx=Number(input.moveX)||0,my=Number(input.moveY)||0,magnitude=Math.hypot(mx,my);if(magnitude>1){mx/=magnitude;my/=magnitude;}
   if(magnitude>0)s.moveAngle=Math.atan2(my,mx);const playerX=s.x,playerY=s.y;
   if(s.dash){const dash=s.dash,before=dash.elapsed/dash.duration;dash.elapsed=Math.min(dash.duration,dash.elapsed+dt);dash.remaining=Math.max(0,dash.duration-dash.elapsed);const after=dash.elapsed/dash.duration,distance=100*((1-before)**2-(1-after)**2);s.moveAngle=Math.atan2(dash.dirY,dash.dirX);moveCircle(s,s,dash.dirX*distance,dash.dirY*distance,true);if(dash.remaining<=1e-9)s.dash=null;}
   else moveCircle(s,s,mx*machine.speed*dt,my*machine.speed*dt,true);
   const playerMove=Math.hypot(s.x-playerX,s.y-playerY);s.moving=playerMove>.001;s.walk+=playerMove*.03;s.scroll+=playerMove;
   if(Number.isFinite(input.aimX))s.aimX=input.aimX;if(Number.isFinite(input.aimY))s.aimY=input.aimY;
   s.angle=Math.atan2(s.aimY-s.y,s.aimX-s.x);s.target=s.x;s.muzzleY=s.y;
   s.shot=Math.max(0,s.shot-dt);s.wingShot=Math.max(0,s.wingShot-dt);s.tacticCooldown=Math.max(0,s.tacticCooldown-dt);s.invulnerable=Math.max(0,s.invulnerable-dt);
   s.burstTime=Math.max(0,s.burstTime-dt);s.burstCooldown=Math.max(0,s.burstCooldown-dt);s.dashCooldown=Math.max(0,s.dashCooldown-dt);s.overdrive=Math.max(0,s.overdrive-dt);
   if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=1e-9){const shock=s.decoy,hits=[];for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-shock.x,e.y-shock.y)<=180+e.r){const damage=C.damageEnemy(s,e,90);if(damage){e.stagger=Math.max(e.stagger,(e.type==='boss'?.8:1)+dt);hits.push({id:e.id,damage,killed:e.dead});}}s.events.push({type:'decoyShock',x:shock.x,y:shock.y,radius:180,hits});s.decoy=null;}}
   if(input.firing!==false){const before=s.shot;C.fire(s,machine);if(before<=0&&(s.burstTime>0||s.overdrive>0)&&s.shot>0)s.shot/=1.7;}
   if(s.count>1&&s.wingShot<=0){let fired=false;const slots=C.formation(s).slice(1,4),nearest=slots.map(()=>({enemy:null,distance:280*280}));for(const e of s.enemies)if(!e.dead)for(let i=0;i<slots.length;i++){const dx=e.x-slots[i].x,dy=e.y-slots[i].y,distance=dx*dx+dy*dy;if(distance<nearest[i].distance)nearest[i]={enemy:e,distance};}for(let i=0;i<slots.length;i++){const f=slots[i],near=nearest[i].enemy;if(!near)continue;const dx=near.x-f.x,dy=near.y-f.y,d=Math.hypot(dx,dy)||1;s.bullets.push({x:f.x,y:f.y,px:f.x,py:f.y,vx:dx/d*620,vy:dy/d*620,r:4,damage:9+Math.min(5,s.level),enemy:false,life:.8,shell:false,ammo:'wing',targetId:near.id});fired=true;}if(fired)s.wingShot=.42;}
   for(const b of s.bullets){
    if(b.dead)continue;b.hitIds=b.hitIds||[];b.left=b.left??1;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const cover=obstacleHit(s,b.px,b.py,b.x,b.y,b.r);
    let nearest=null,nearestT=Infinity;
    if(!b.enemy)for(const e of s.enemies){
     if(e.dead||b.hitIds.includes(e.id))continue;if(distanceToSegment(e.x,e.y,b.px,b.py,b.x,b.y)>e.r+b.r)continue;
     const length=(b.x-b.px)**2+(b.y-b.py)**2,t=length?clamp(((e.x-b.px)*(b.x-b.px)+(e.y-b.py)*(b.y-b.py))/length,0,1):0;if(t<nearestT){nearest=e;nearestT=t;}
    }
    if(cover&&cover.t<=nearestT){const coverDamage=b.damage*.2;b.x=cover.x;b.y=cover.y;b.dead=true;cover.o.hp=Math.max(0,cover.o.hp-coverDamage);cover.o.flash=.1;if(cover.o.hp<=0)cover.o.dead=true;s.events.push({type:'coverImpact',x:b.x,y:b.y,obstacleId:cover.o.id,damage:coverDamage,hp:cover.o.hp,dead:cover.o.dead,ammo:b.ammo});}
    else if(nearest){const e=nearest;
     const damage=C.damageEnemy(s,e,b.damage);b.hitIds.push(e.id);b.left--;s.events.push({type:'impact',x:b.x,y:b.y,damage,targetId:e.id,killed:e.dead,ammo:b.ammo,shell:b.shell});
     if(b.ammo==='he'){
      const hits=[];for(const other of s.enemies)if(other!==e&&!other.dead&&Math.hypot(other.x-e.x,other.y-e.y)<=70+other.r){const splash=C.damageEnemy(s,other,b.damage*.7);if(splash)hits.push({id:other.id,damage:splash,killed:other.dead});}
      s.events.push({type:'blast',x:e.x,y:e.y,radius:70,hits});
     }
     if(b.left<=0)b.dead=true;
    }
    if(b.life<=0||b.x<0||b.x>1000||b.y<0||b.y>1000)b.dead=true;
   }
   s.bullets=s.bullets.filter(b=>!b.dead).slice(-120);
   for(const e of s.enemies){const x=e.x,y=e.y;C.updateEnemy(s,e,dt);const moved=Math.hypot(e.x-x,e.y-y);e.walk+=moved*.03;e.moving=moved>.001;}
   for(const h of s.hazards){
    if(!h.fired){h.delay-=dt;if(h.delay<=1e-9){h.fired=true;if(h.exposeAfter){const source=s.enemies.find(e=>e.id===h.source&&!e.dead);if(source)source.exposed=2;}
     if(h.kind==='support'){const hits=[];for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r+e.r){const damage=C.damageEnemy(s,e,e.type==='boss'?380:300);if(damage)hits.push({id:e.id,damage,killed:e.dead});}s.events.push({type:'mortarImpact',kind:h.kind,x:h.x,y:h.y,r:h.r,sourceId:h.source,model:h.model,hits});}
     else if(h.geometry==='circle')s.events.push({type:'mortarImpact',kind:h.kind,x:h.x,y:h.y,r:h.r,sourceId:h.source,model:h.model});
     else {if(h.blockedBy){const o=s.obstacles.find(o=>o.id===h.blockedBy);if(o&&!o.dead){const coverDamage=h.heavy?80:h.damage;o.hp=Math.max(0,o.hp-coverDamage);o.flash=.12;if(o.hp<=0)o.dead=true;s.events.push({type:'coverImpact',x:h.toX,y:h.toY,obstacleId:o.id,damage:coverDamage,hp:o.hp,dead:o.dead,kind:h.kind});}}s.events.push({type:'cannon',kind:h.kind,fromX:h.fromX,fromY:h.fromY,toX:h.toX,toY:h.toY,rawToX:h.rawToX,rawToY:h.rawToY,width:h.width,sourceId:h.source,model:h.model,blockedBy:h.blockedBy});}
    }}
    else h.life-=dt;
    if(h.fired&&!h.hitPlayer&&!h.playerImmune&&C.insideHazard(s,h)){h.hitPlayer=true;if(h.damage>0)C.hurt(s,h.damage,false,{kind:h.kind,model:h.model,sourceId:h.source});}
   }
   s.hazards=s.hazards.filter(h=>!h.fired||h.life>0).slice(-160);
   for(const box of s.crates){if(box.life===undefined)box.life=30;box.life-=dt;if(!box.used&&Math.hypot(box.x-s.x,box.y-s.y)<=56)C.collect(s,box);}
   s.crates=s.crates.filter(box=>!box.used&&box.life>0).slice(-24);
   s.pickupTimer-=dt;if(s.pickupTimer<=1e-9){s.pickupTimer=20;const pairs=[[[160,180],[290,180]],[[500,820],[630,820]],[[440,590],[570,590]],[[820,520],[820,650]]],positions=pairs[s.supplyGroup%pairs.length],survival=['repair','shield','recruit'],offense=['weapon','charge','ap','he','overdrive','emp'],kinds=s.supplyGroup===0?['shield','weapon']:[survival[Math.floor(s.random()*survival.length)],offense[Math.floor(s.random()*offense.length)]],group=++s.supplyGroup;for(const [i,p] of positions.entries())s.crates.push({id:s.nextId++,group,kind:kinds[i],x:p[0],y:p[1],used:false,life:18});s.events.push({type:'supplyChoice',group,crates:s.crates.filter(b=>b.group===group).map(b=>({id:b.id,kind:b.kind,x:b.x,y:b.y}))});}
   s.spawn-=dt;if(s.spawn<=0){s.spawn=Math.max(.36,1.05-s.time*.004);const amount=Math.min(4,1+Math.floor(s.time/35));for(let i=0;i<amount;i++){const roll=s.random(),type=s.time>18&&roll<.12?'charger':s.time>28&&roll>.91?'artillery':'normal';C.spawnEnemy(s,type);}}
   const activeBoss=s.enemies.some(e=>e.type==='boss'&&!e.dead);if(!activeBoss){s.boss-=dt;if(s.boss<=5&&!s.bossWarned){s.bossWarned=true;s.events.push({type:'warning',kind:'boss',eta:5});}if(s.boss<=0){const spawned=C.spawnSpecial(s,s.bossKills%2?'morpho':'dinosauria');s.boss=spawned?999:1;}}
   s.enemies=s.enemies.filter(e=>!e.dead);
   s.stats.peakEnemies=Math.max(s.stats.peakEnemies,s.enemies.filter(e=>!e.dead).length);
   return s;
  }
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=C;else root.GameArenaCore=C;
})(typeof globalThis!=='undefined'?globalThis:this);

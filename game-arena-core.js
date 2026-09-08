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
  if(body!==s&&(Math.hypot(x-(s.dash?s.dash.toX:s.x),y-(s.dash?s.dash.toY:s.y))<body.r+22-1e-6||s.dash&&Math.hypot(x-s.dash.fromX,y-s.dash.fromY)<body.r+22-1e-6))return true;
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
 const playerSpot=(s,x,y)=>!blocked(s,s,x,y,true);
 const dashLanding=(s,x,y,dirX,dirY)=>{
  if(playerSpot(s,x,y))return {x,y};
  for(const radius of [24,42,60,78])for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4]){
   const c=Math.cos(angle),n=Math.sin(angle),cx=x+dirX*c*radius-dirY*n*radius,cy=y+dirY*c*radius+dirX*n*radius;
   if(playerSpot(s,cx,cy))return {x:cx,y:cy};
  }
  return null;
 };
 const pickupSpot=(s,x,y)=>{x=clamp(x,s.bounds.left,s.bounds.right);y=clamp(y,s.bounds.top,s.bounds.bottom);if(!blocked(s,s,x,y,false))return {x,y};for(let radius=24;radius<=192;radius+=24)for(let i=0;i<16;i++){const angle=i*Math.PI/8,cx=clamp(x+Math.cos(angle)*radius,s.bounds.left,s.bounds.right),cy=clamp(y+Math.sin(angle)*radius,s.bounds.top,s.bounds.bottom);if(!blocked(s,s,cx,cy,false))return {x:cx,y:cy};}return {x:500,y:500};};
 const insideShape=(x,y,pad,h)=>{if(h.geometry==='circle')return Math.hypot(x-h.x,y-h.y)<=h.r+pad;if(h.geometry==='beam')return distanceToSegment(x,y,h.fromX,h.fromY,h.toX,h.toY)<=h.width/2+pad;if(h.geometry==='sector'){const dx=x-h.x,dy=y-h.y,d=Math.hypot(dx,dy);return d<=h.r+pad&&(d<=pad||Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-h.angle),Math.cos(Math.atan2(dy,dx)-h.angle)))<=h.halfAngle);}return false;};
 const dropKind=(s,quality='ordinary')=>quality==='boss'?'weapon':quality==='elite'?['weapon','charge','overdrive','emp'][s.eliteDropCycle++%4]:['shield','weapon','repair','charge','shield','repair'][s.dropCycle++%6];
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
 const syncWings=s=>{s.wings=s.wings||[];s.nextWingId=s.nextWingId||1;if(s.over||s.count<=0){s.wings.length=0;s.count=0;return s.wings;}const wanted=Math.max(0,Math.min(3,s.count-1));while(s.wings.length<wanted)s.wings.push({id:s.nextWingId++,hp:36,maxHp:36,jam:0,jamGrace:0,hijacked:0,warned:false,hostileCooldown:0});if(s.wings.length>wanted)s.wings.length=wanted;s.count=1+s.wings.length;return s.wings;};
 const C={
  machines:{
   m1a4:{name:'M1A4 破壞神',hp:100,speed:300,interval:.24,damage:24,projectileSpeed:760,r:6},
   m4a3:{name:'M4A3 破壞之杖',hp:160,speed:225,interval:.38,damage:42,projectileSpeed:650,r:9},
   xm2:{name:'XM2 女武神',hp:80,speed:360,interval:.18,damage:22,projectileSpeed:900,r:5}
  },
  create:(random=Math.random)=>({
   random,time:0,x:500,y:500,target:500,velocity:0,muzzleY:500,count:3,maxCount:4,
   hp:100,maxHp:100,shield:0,kills:0,bossKills:0,level:0,over:false,won:false,
   enemies:[],bullets:[],gates:[],crates:[],hazards:[],events:[],nextId:1,shot:0,wings:[],nextWingId:1,
   wingShot:0,spawn:.8,boss:32,bossWarned:false,bossModel:'dinosauria',bossIndex:0,bossSpawnCount:0,bossCap:1,pickupTimer:8,spawnSide:0,wave:1,threatStage:1,nextSpecial:16,specialIndex:0,
   charges:2,tacticCooldown:0,tacticRecharge:18,invulnerable:0,heavyInvulnerable:0,invulnerabilitySource:null,angle:-Math.PI/2,aimX:500,aimY:200,r:22,
   burstTime:0,burstCooldown:0,dashCooldown:0,dash:null,wingSaveCooldown:0,normalKills:0,lastEliteDrop:-Infinity,dropCycle:0,eliteDropCycle:0,supplyGroup:0,wingRange:280,jammed:false,
   walk:0,scroll:0,brace:0,momentum:0,blade:0,overdrive:0,combo:0,comboTime:0,moving:false,moveAngle:0,
   stats:{recruits:0,sacrifices:0,damage:0,interrupts:0,fullTime:0,bossShots:0,eliteShots:0,peakEnemies:0,items:0,tactics:0,hits:0}
  }),
  setup(s,options={}){
   s.machine=C.machines[options.machine]?options.machine:'m1a4';
   const machine=C.machines[s.machine];
   s.hp=s.maxHp=machine.hp;s.shield=25;s.dash=null;s.dashCooldown=0;s.wingSaveCooldown=0;s.invulnerable=0;s.heavyInvulnerable=0;s.invulnerabilitySource=null;s.mode='endless';s.arena=true;s.encounter='arena';s.wings=[];s.nextWingId=1;syncWings(s);
   s.ammo=['ap','he'].includes(options.ammo)?options.ammo:'standard';
   s.tactic='support';s.charges=2;s.tacticRecharge=18;s.boss=32;s.nextSpecial=16;s.specialIndex=0;
   const bosses=['dinosauria','phoenix','morpho'];s.bossModel=bosses.includes(options.bossModel)?options.bossModel:'dinosauria';s.bossIndex=bosses.indexOf(s.bossModel);s.bossSpawnCount=0;s.bossCap=1;s.wave=1;s.threatStage=1;
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
   const result=[{x:s.x,y:s.y,angle:s.angle,main:true}],wings=syncWings(s),count=wings.length;
   const fx=Math.cos(s.angle),fy=Math.sin(s.angle),px=-fy,py=fx;
   for(let i=0;i<count;i++){
    const row=i<2?1:2,side=i%2?-1:1;
    const wing=wings[i];result.push({x:s.x-fx*42*row+px*side*(i<2?38:0),y:s.y-fy*42*row+py*side*(i<2?38:0),angle:s.angle,main:false,wingId:wing.id,hp:wing.hp,maxHp:wing.maxHp,jam:wing.jam,hijacked:wing.hijacked});
   }
   return result;
  },
  damageWing(s,wingId,amount,source={}){const wings=syncWings(s),index=wings.findIndex(w=>w.id===wingId);if(index<0)return 0;const wing=wings[index],before=wing.hp;wing.hp=Math.max(0,wing.hp-amount);const slot=C.formation(s).find(f=>f.wingId===wingId)||{x:s.x,y:s.y};s.events.push({type:'wingHit',wingId,x:slot.x,y:slot.y,damage:before-wing.hp,hp:wing.hp,maxHp:wing.maxHp,sourceId:source.sourceId??null,kind:source.kind||'unknown'});if(wing.hp<=0){wings.splice(index,1);s.count=1+wings.length;s.events.push({type:'wingDown',wingId,x:slot.x,y:slot.y,sourceId:source.sourceId??null,kind:source.kind||'unknown'});}return before-wing.hp;},
  spawnEnemy(s,type='normal',x,y){
   const living=s.enemies.filter(e=>!e.dead);if(living.length>=70)return null;
   if(type==='boss'&&s.enemies.filter(e=>e.type==='boss'&&!e.dead).length>=(s.bossCap||1))return null;
   if(type!=='boss'&&living.filter(e=>e.type!=='boss').length>=67)return null;
   if(['normal','gunner'].includes(type)&&living.filter(e=>['normal','gunner'].includes(e.type)).length>=32)return null;
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
   const wave=Math.max(1,s.wave||1),early=wave<5?.75:wave<9?.9:1,scale=1+(wave-1)*.035,specialScale=1+(Math.max(1,s.threatStage||1)-1)*.18,spec={charger:[140,32,128],artillery:[180,36,70],scout:[75,22,115],shield:[260,42,55],jammer:[90,22,95],mine:[55,20,120],swarm:[45,15,135],stier:[220,34,65],gunner:[48,20,90]}[type];
   const boss=type==='boss',hp=boss?(1800+s.bossKills*350)*specialScale:spec?spec[0]*scale:32*scale;
   const e={id:s.nextId++,type,x,y,side,hp,max:hp,r:boss?105:spec?spec[1]:18,
    speed:boss?42:spec?spec[2]:82+Math.min(70,s.time*.3),dead:false,flash:0,walk:0,
    angle:Math.atan2(s.y-y,s.x-x),cooldown:type==='artillery'?2.4:.5,contactCooldown:0,
    phase:'approach',windup:0,lockedX:null,lockedY:null,stagger:0,attackCount:0,nodes:[],exposed:0,heat:0,cooling:0,damageScale:early*(1+(wave-1)*.015),jamRadius:type==='jammer'?240:type==='swarm'?170:0,flying:['jammer','swarm'].includes(type)};
   const sides=['top','right','bottom','left'],start=sides.indexOf(side),valid=(cx,cy)=>cx-e.r>=0&&cx+e.r<=1000&&cy-e.r>=0&&cy+e.r<=1000&&
    !(s.obstacles||[]).some(o=>!o.dead&&circleRect(cx,cy,e.r,o))&&Math.hypot(cx-(s.dash?s.dash.toX:s.x),cy-(s.dash?s.dash.toY:s.y))>=e.r+22&&(!s.dash||Math.hypot(cx-s.dash.fromX,cy-s.dash.fromY)>=e.r+22)&&
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
   if(['dinosauria','phoenix','morpho'].includes(type)){
    if(s.enemies.filter(e=>e.type==='boss'&&!e.dead).length>=(s.bossCap||1))return null;
    const e=C.spawnEnemy(s,'boss',x,y);
    if(!e)return null;
    e.model=type;e.hp=e.max=(type==='dinosauria'?2200:type==='phoenix'?1600:2600)*(1+(Math.max(1,s.threatStage||1)-1)*.18);e.r=type==='phoenix'?48:105;e.speed=type==='phoenix'?140:42;e.cooldown=2.6;e.intro=1.2;e.bossStage=1;
    if(type==='phoenix'){e.camo=true;e.revealed=0;e.dashLeft=0;}
    const enter=s.events.findLast?.(event=>event.type==='bossEnter');if(enter)enter.model=type;
    return e;
   }
   return C.spawnEnemy(s,type,x,y);
  },
  collect(s,box){
   if(box.used||s.over)return false;
   const before={hp:s.hp,shield:s.shield,charges:s.charges,count:s.count,level:s.level,overdrive:s.overdrive,ammo:s.ammo};
   if(box.kind==='repair')s.hp=Math.min(s.maxHp,s.hp+12);
   else if(box.kind==='shield')s.shield=Math.min(s.maxHp,s.shield+10);
   else if(box.kind==='charge')s.charges=Math.min(2,s.charges+1);
   else if(box.kind==='recruit'){const count=s.count;if(s.count<s.maxCount){s.count++;syncWings(s);s.stats.recruits++;}else for(const wing of syncWings(s))wing.hp=Math.min(wing.maxHp,wing.hp+18);}
   else if(box.kind==='weapon'){s.level++;if(s.level>=12&&s.level%4===0)s.events.push({type:'weaponMilestone',level:s.level,tier:(s.level-8)/4});}
   else if(box.kind==='ap')s.ammo='ap';
   else if(box.kind==='he')s.ammo='he';
   else if(box.kind==='overdrive')s.overdrive=7;
   else if(box.kind==='emp'){
    const hits=[];
    for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-box.x,e.y-box.y)<=230+e.r){
     const damage=e.type==='boss'?0:C.damageEnemy(s,e,140);e.stagger=Math.max(e.stagger,e.type==='boss'?.8:1);
     if(e.type==='charger'){e.phase='stagger';e.windup=0;}
     else if(e.model==='phoenix'&&['closing','flank','windup','slashWindup','dash'].includes(e.phase)){e.phase='recover';e.windup=0;e.dashLeft=0;e.exposed=Math.max(e.exposed,2);s.events.push({type:'phoenixRecover',x:e.x,y:e.y,sourceId:e.id,exposed:2,interrupted:true});}
     hits.push({id:e.id,damage,killed:e.dead});
    }
    const ids=new Set(hits.map(hit=>hit.id));s.hazards=s.hazards.filter(h=>h.fired||!ids.has(h.source));s.stats.interrupts+=hits.length;
    for(const wing of syncWings(s))if(wing.jam||wing.hijacked||wing.warned){const slot=C.formation(s).find(f=>f.wingId===wing.id)||s;wing.jam=wing.hijacked=0;wing.jamGrace=3;wing.warned=false;s.events.push({type:'wingRecovered',wingId:wing.id,x:slot.x,y:slot.y,reason:'emp'});}
    s.events.push({type:'emp',x:box.x,y:box.y,radius:230,hits});
   }
   const after={hp:s.hp,shield:s.shield,charges:s.charges,count:s.count,level:s.level,overdrive:s.overdrive,ammo:s.ammo};
   box.used=true;s.stats.items++;
   const event={type:'collect',kind:box.kind,x:box.x,y:box.y,before,after};
   s.events.push(event);
   if(box.kind==='weapon'&&after.level>before.level)s.events.push({type:'upgrade',x:box.x,y:box.y,level:s.level});
   return true;
  },
  damageEnemy(s,e,damage,cause={}){
   if(!e||e.dead)return 0;
   if((e.type==='boss'||e.type==='stier')&&e.exposed>0)damage*=1.6;
   if(e.model==='phoenix')e.revealed=Math.max(e.revealed||0,1.5);
   const before=e.hp;e.hp-=damage;e.flash=.06;
   if(e.hp>0)return before-e.hp;
   e.hp=0;e.dead=true;s.kills++;
   const identity={sourceId:e.id,kind:e.type,model:e.model||e.type,x:e.x,y:e.y,angle:e.angle};
   s.events.push({type:'kill',...identity});
   if(e.type==='boss'){
    s.bossKills++;s.boss=25;s.bossWarned=false;
   s.events.push({type:'bossDown',...identity});
    {const spot=pickupSpot(s,e.x,e.y);s.crates.push({id:s.nextId++,kind:dropKind(s,'boss'),x:spot.x,y:spot.y,used:false,drop:true,life:30});}
   }else if(e.type==='normal'||e.type==='gunner'){
    if(++s.normalKills%12===0){const spot=pickupSpot(s,e.x,e.y);s.crates.push({id:s.nextId++,kind:dropKind(s),x:spot.x,y:spot.y,used:false,drop:true,life:30});}
   }else{
    if(s.time-s.lastEliteDrop>=8){s.lastEliteDrop=s.time;const spot=pickupSpot(s,e.x,e.y);s.crates.push({id:s.nextId++,kind:dropKind(s,'elite'),x:spot.x,y:spot.y,used:false,drop:true,life:30});}
    s.events.push({type:'eliteDown',...identity});
   }
   s.hazards=s.hazards.filter(h=>(h.source!==e.id&&h.linkedTo!==e.id)||h.fired);
   if(e.type==='mine'&&cause.kind!=='mineChain'){const hits=[];for(const other of s.enemies)if(other!==e&&!other.dead&&Math.hypot(other.x-e.x,other.y-e.y)<=95+other.r){const dealt=C.damageEnemy(s,other,80,{kind:'mineChain'});if(dealt)hits.push({id:other.id,damage:dealt,killed:other.dead});}s.events.push({type:'mineChain',x:e.x,y:e.y,radius:95,hits});}
   return before;
  },
  hurt(s,amount,lethal=false,source={}){
   const heavy=!!source.heavy||['rail','mortar','ram'].includes(source.kind)||['dinosauria','morpho','phoenix','stier','shield','artillery'].includes(source.model);
   if(s.over||(!lethal&&(heavy?(s.heavyInvulnerable>0||(s.invulnerable>0&&s.invulnerabilitySource!=='chip')):s.invulnerable>0)))return 0;
   if(!lethal&&s.dash&&['contact','ram','blade'].includes(source.kind))return 0;
   const shieldBefore=s.shield,absorbed=lethal?0:Math.min(s.shield,amount);s.shield=lethal?0:s.shield-absorbed;amount-=absorbed;
   if(!lethal&&amount>=s.hp&&s.count>1&&s.wingSaveCooldown<=0){const countBefore=s.count,wings=syncWings(s),wing=wings.at(-1),slot=C.formation(s).find(f=>f.wingId===wing?.id)||s;wings.pop();s.count=1+wings.length;s.wingSaveCooldown=6;s.invulnerable=.8;s.heavyInvulnerable=.8;s.invulnerabilitySource='wingSave';s.stats.sacrifices++;s.events.push({type:'wingSacrifice',wingId:wing?.id,x:slot.x,y:slot.y,countBefore,countAfter:s.count,absorbed:amount,source:{...source}});return 0;}
   const before=s.hp;s.hp=lethal?0:Math.max(0,s.hp-amount);const actual=before-s.hp;
   s.stats.damage+=actual;s.stats.hits++;s.invulnerable=lethal?0:heavy?.75:.55;s.heavyInvulnerable=lethal?0:heavy?.75:0;s.invulnerabilitySource=lethal?null:heavy?'heavy':'chip';
   s.lastDamage={kind:source.kind||'unknown',model:source.model||'unknown',sourceId:source.sourceId??source.source??null,time:s.time,amount:actual,absorbed,lethal};
   if(absorbed)s.events.push({type:'shieldAbsorb',x:s.x,y:s.y,amount:absorbed,before:shieldBefore,after:s.shield});
   s.events.push({type:'hurt',x:s.x,y:s.y,amount:actual,absorbed,shieldBefore,shieldAfter:s.shield,lethal,source:s.lastDamage});
   if(s.hp<=0){s.count=0;s.over=true;s.events.push({type:'over'});}
   return actual;
  },
  result(s){
   if(!s.over)return null;
   return Object.freeze({won:false,time:s.time,kills:s.kills,bossKills:s.bossKills,wave:s.wave,mode:'endless',level:s.level,
    damage:s.stats.damage,hits:s.stats.hits,interrupts:s.stats.interrupts,items:s.stats.items,tactics:s.stats.tactics,sacrifices:s.stats.sacrifices,
    machine:s.machine,encounter:'arena',ammo:s.ammo,tactic:s.tactic,lastDamage:s.lastDamage?Object.freeze({...s.lastDamage}):null});
  },
  useTactic(s,aim){
   if(s.over||!s.charges||s.tacticCooldown>0)return false;
   const x=clamp(aim?.x??aim?.aimX??s.aimX,s.bounds.left,s.bounds.right),y=clamp(aim?.y??aim?.aimY??s.aimY,s.bounds.top,s.bounds.bottom),radius=280;
   s.charges--;s.tacticCooldown=1;s.stats.tactics++;for(const wing of syncWings(s))if(wing.jam||wing.hijacked||wing.warned){const slot=C.formation(s).find(f=>f.wingId===wing.id)||s;wing.jam=wing.hijacked=0;wing.jamGrace=3;wing.warned=false;s.events.push({type:'wingRecovered',wingId:wing.id,x:slot.x,y:slot.y,reason:'support'});}
   s.hazards.push({geometry:'circle',x,y,r:radius,fromX:x,fromY:y,toX:x,toY:y,width:0,delay:.65,maxDelay:.65,fired:false,life:.3,source:null,model:'player',kind:'support',damage:0,playerImmune:true});
   s.events.push({type:'tactic',kind:'support',x,y,radius,delay:.65,hits:[]});
   return true;
  },
  useBurst(s,input={}){
   if(s.over||s.burstCooldown>0)return false;
   const machine=s.machine||'m1a4';if(Number.isFinite(input.aimX))s.aimX=input.aimX;if(Number.isFinite(input.aimY))s.aimY=input.aimY;
   if(machine==='m4a3'){s.burstTime=3;s.burstCooldown=9;s.events.push({type:'ability',kind:'burst',skill:'overclock',x:s.x,y:s.y,radius:0,hits:[],duration:3,cooldown:9});return true;}
   const blade=machine==='xm2',radius=blade?220:170,hits=[];s.burstTime=.25;s.burstCooldown=blade?9:8;
   for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-s.x,e.y-s.y)<=radius+e.r){const damage=C.damageEnemy(s,e,e.type==='boss'?(blade?120:80):(blade?240:160));if(damage){let interrupted=false;if(!e.dead){e.stagger=Math.max(e.stagger,blade?1:.8);if(blade){for(const h of s.hazards)if(!h.fired&&(h.source===e.id||h.linkedTo===e.id))h.cancelled=interrupted=true;if(e.type==='charger'){e.phase='stagger';e.windup=0;e.lockedX=e.lockedY=null;interrupted=true;}else if(e.model==='phoenix'&&['closing','flank','windup','slashWindup','dash'].includes(e.phase)){e.phase='recover';e.windup=0;e.dashLeft=0;e.exposed=Math.max(e.exposed,2);s.events.push({type:'phoenixRecover',x:e.x,y:e.y,sourceId:e.id,exposed:2,interrupted:true});interrupted=true;}}}hits.push({id:e.id,damage,killed:e.dead,interrupted});}}
   if(!blade){s.bullets=s.bullets.filter(b=>!b.enemy||Math.hypot(b.x-s.x,b.y-s.y)>radius+b.r);s.invulnerable=Math.max(s.invulnerable,.35);s.heavyInvulnerable=Math.max(s.heavyInvulnerable,.35);s.invulnerabilitySource='ability';}
   s.hazards=s.hazards.filter(h=>!h.cancelled);s.events.push({type:'ability',kind:'burst',skill:blade?'blade':'counter',x:s.x,y:s.y,radius,hits,duration:.25,cooldown:s.burstCooldown});return true;
  },
  useAbility(s,kind,input={}){
   if(s.over)return false;
   if(kind==='burst')return C.useBurst(s,input);
   if(kind==='dash'){
    if(s.dashCooldown>0)return false;
    let dx=Number(input.moveX)||0,dy=Number(input.moveY)||0,d=Math.hypot(dx,dy);
    if(d<.01){const angle=s.moving?s.moveAngle:Math.atan2((input.aimY??s.aimY)-s.y,(input.aimX??s.aimX)-s.x);dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    const dirX=dx/d,dirY=dy/d,distance=s.machine==='xm2'?220:s.machine==='m4a3'?150:180;
    if(!playerSpot(s,s.x,s.y))return false;const landing=dashLanding(s,s.x+dirX*distance,s.y+dirY*distance,dirX,dirY);if(!landing)return false;
    s.dash={fromX:s.x,fromY:s.y,toX:landing.x,toY:landing.y,dirX,dirY,elapsed:0,duration:.36,remaining:.36};s.dashCooldown=3;
    s.events.push({type:'ability',kind:'dash',fromX:s.x,fromY:s.y,toX:landing.x,toY:landing.y,x:s.x,y:s.y,distance:Math.hypot(landing.x-s.x,landing.y-s.y),duration:.36,cooldown:3});return true;
   }
   return false;
  },
  insideHazard(s,h){
   return insideShape(s.x,s.y,0,h);
  },
  fire(s,machine){
   if(s.shot>0)return;
   const dx=s.aimX-s.x,dy=s.aimY-s.y,length=Math.hypot(dx,dy);if(length<1)return;
   const ammoDamage=s.ammo==='ap'?1.25:s.ammo==='he'?.85:1,level=s.level,milestone=Math.max(0,Math.floor((level-8)/4));
   const damage=(machine.damage+level*2.5)*ammoDamage;
   s.bullets.push({x:s.x,y:s.y,px:s.x,py:s.y,vx:dx/length*machine.projectileSpeed,vy:dy/length*machine.projectileSpeed,r:machine.r,damage,enemy:false,life:1.5,shell:true,ammo:s.ammo,left:s.ammo==='ap'?2:1,hitIds:[]});
   if(milestone>0){const angle=Math.atan2(dy,dx)+(s.kills%2?-.055:.055),ratio=Math.min(.65,.3+milestone*.05),left=s.ammo==='ap'?(milestone>=3?3:2):milestone>=3?2:1;s.bullets.push({x:s.x,y:s.y,px:s.x,py:s.y,vx:Math.cos(angle)*machine.projectileSpeed,vy:Math.sin(angle)*machine.projectileSpeed,r:Math.max(3,machine.r-1),damage:damage*ratio,enemy:false,life:1.5,shell:true,ammo:s.ammo,left,hitIds:[],milestone});}
   s.shot=Math.max(.11,machine.interval-Math.min(12,level)*.008)*(s.ammo==='ap'?1.25:1);
   const event={type:'shoot',machine:s.machine,x:s.x,y:s.y,angle:s.angle,boost:'none',damage,ammo:s.ammo,milestone};
   s.events.push(event,{...event,type:'mainShot'});
  },
  addHazard(s,geometry,source,kind,target,delay,damage){
   const model=source.model||source.type;
   if(geometry==='circle')s.hazards.push({geometry,x:target.x,y:target.y,r:target.r||80,fromX:source.x,fromY:source.y,toX:target.x,toY:target.y,width:0,delay,maxDelay:delay,fired:false,life:.3,source:source.id,model,kind,damage,exposeAfter:!!target.exposeAfter});
   else if(geometry==='sector')s.hazards.push({geometry,x:target.x,y:target.y,r:target.r,angle:target.angle,halfAngle:target.halfAngle,delay,maxDelay:delay,fired:false,life:.25,maxLife:.25,source:source.id,model,kind,damage,heavy:!!target.heavy,exposeAfter:!!target.exposeAfter});
   else{
    const rawToX=target.x,rawToY=target.y,hit=obstacleHit(s,source.x,source.y,rawToX,rawToY,0);
    const toX=hit?hit.x:rawToX,toY=hit?hit.y:rawToY;
    s.hazards.push({geometry,fromX:source.x,fromY:source.y,toX,toY,rawToX,rawToY,width:target.width||46,x:toX,y:toY,r:0,delay,maxDelay:delay,fired:false,life:.24,source:source.id,model,kind,damage,heavy:!!target.heavy,blockedBy:hit?.o.id||null,exposeAfter:!!target.exposeAfter});
   }
  },
  updateEnemy(s,e,dt){
   if(e.dead)return;
   e.flash=Math.max(0,e.flash-dt);e.contactCooldown=Math.max(0,e.contactCooldown-dt);e.exposed=Math.max(0,(e.exposed||0)-dt);e.revealed=Math.max(0,(e.revealed||0)-dt);
   const hadStagger=e.stagger>0;e.stagger=Math.max(0,e.stagger-dt);
   const target=s.decoy||s,routed=routeTarget(s,e,target),dx=routed.x-e.x,dy=routed.y-e.y,d=Math.hypot(dx,dy)||1;e.angle=Math.atan2(target.y-e.y,target.x-e.x);
   if(hadStagger)return;
   if(e.type==='jammer'||e.type==='swarm'){if(Math.hypot(target.x-e.x,target.y-e.y)>190)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);return;}
   if(e.type==='mine'){
    if(e.phase==='windup'){e.windup-=dt;if(e.windup<=0){e.dead=true;s.events.push({type:'mineDetonate',x:e.x,y:e.y,radius:75,sourceId:e.id});if(Math.hypot(s.x-e.x,s.y-e.y)<=97)C.hurt(s,32*e.damageScale,false,{kind:'mine',model:'mine',sourceId:e.id});}return;}
    if(Math.hypot(target.x-e.x,target.y-e.y)<=105){e.phase='windup';e.windup=.6;s.events.push({type:'warning',kind:'mine',x:e.x,y:e.y,radius:75,sourceId:e.id});return;}
   }
   if(e.type==='shield'){
    e.cooling=Math.max(0,e.cooling-dt);if(e.cooling>0)return;e.cooldown-=dt;
    if(e.cooldown<=0){e.attackCount++;e.heat++;e.cooldown=2.8;C.addHazard(s,'beam',e,'rail',{x:target.x+(target.x-e.x)*2,y:target.y+(target.y-e.y)*2,width:40},.9,30*e.damageScale);s.events.push({type:'warning',kind:'shield',x:target.x,y:target.y,sourceId:e.id});if(e.heat>=2){e.heat=0;e.cooling=4.5;e.cooldown=4.5;}return;}
    if(Math.hypot(target.x-e.x,target.y-e.y)>330)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);return;
   }
   if(e.type==='stier'){
    if(e.phase==='cooling'){e.cooling=Math.max(0,(e.cooling||0)-dt);if(e.cooling<=0){e.phase='approach';e.cooldown=1.5;}return;}
    if(e.phase==='windup'){e.windup-=dt;if(e.windup<=1e-9){e.phase='cooling';e.cooling=e.eliteStage===2?3:2.4;e.exposed=e.cooling;}return;}
    e.cooldown-=dt;if(d>300)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);else if(d<210)moveCircle(s,e,-dx/d*e.speed*dt,-dy/d*e.speed*dt);else moveCircle(s,e,-dy/d*e.speed*.55*dt,dx/d*e.speed*.55*dt);
    if(d<=400&&e.cooldown<=0){e.phase='windup';e.windup=.95;e.lockedAngle=Math.atan2(target.y-e.y,target.x-e.x);e.eliteStage=(e.hp<=e.max*.5||(s.threatStage||1)>=2)?2:1;for(const spread of [-.22,0,.22]){C.addHazard(s,'beam',e,'rail',{x:e.x+Math.cos(e.lockedAngle+spread)*350,y:e.y+Math.sin(e.lockedAngle+spread)*350,width:22},.95+dt,32*e.damageScale);s.hazards.at(-1).maxDelay=.95;}s.events.push({type:'warning',kind:'stier',x:e.x,y:e.y,angle:e.lockedAngle,sourceId:e.id,delay:.95});if(e.eliteStage===2){const angle=e.lockedAngle+.34;for(const spread of [-.18,0,.18])C.addHazard(s,'beam',e,'rail',{x:e.x+Math.cos(angle+spread)*350,y:e.y+Math.sin(angle+spread)*350,width:22},1.3+dt,26*e.damageScale);s.events.push({type:'warning',kind:'stierFollow',x:e.x,y:e.y,angle,sourceId:e.id,delay:1.3});}}return;
   }
   if(e.type==='gunner'){
    if(e.phase==='windup'){e.windup-=dt;if(e.windup<=1e-9){for(const spread of [-.065,.065]){const angle=e.lockedAngle+spread;s.bullets.push({x:e.x,y:e.y,px:e.x,py:e.y,vx:Math.cos(angle)*220,vy:Math.sin(angle)*220,r:5,damage:6*e.damageScale,enemy:true,life:2.2,model:'gunner',sourceId:e.id});s.events.push({type:'enemyShot',model:'gunner',sourceId:e.id,x:e.x,y:e.y,angle});}e.phase='approach';e.cooldown=2.2;}return;}
    e.cooldown-=dt;if(d>240)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);else if(d<180)moveCircle(s,e,-dx/d*e.speed*dt,-dy/d*e.speed*dt);else moveCircle(s,e,-dy/d*e.speed*.65*dt,dx/d*e.speed*.65*dt);
    if(d<=300&&e.cooldown<=0){e.phase='windup';e.windup=.5;e.lockedAngle=Math.atan2(target.y-e.y,target.x-e.x);s.events.push({type:'warning',kind:'gunner',x:e.x,y:e.y,angle:e.lockedAngle,sourceId:e.id,delay:.5});}return;
   }
   if(e.type==='boss'){
    if(!e.bossStage)e.bossStage=1;if(e.bossStage<2&&(e.hp<=e.max*.5||(s.threatStage||1)>=2)){e.bossStage=2;s.events.push({type:'bossPhase',sourceId:e.id,model:e.model,phase:2});}
    const preparing=new Set(s.hazards.filter(h=>!h.fired&&!h.cancelled&&s.enemies.some(b=>b.id===h.source&&b.type==='boss'&&!b.dead)).map(h=>h.source));
    for(const boss of s.enemies)if(boss.type==='boss'&&!boss.dead&&['closing','flank','windup','slashWindup','dash'].includes(boss.phase))preparing.add(boss.id);
    const pendingBosses=preparing.size;
    if(e.model==='phoenix'){
     e.intro=Math.max(0,(e.intro||0)-dt);
     if(e.phase==='recover'){if(e.exposed<=0){e.phase='approach';e.cooldown=2.2;}return;}
     const recover=()=>{e.phase='recover';e.windup=0;e.dashLeft=0;e.exposed=Math.max(e.exposed,2);e.cooldown=2.2;s.events.push({type:'phoenixRecover',x:e.x,y:e.y,sourceId:e.id,exposed:2});};
     const slash=(r,halfAngle,delay,damage,combo=0)=>{const angle=Math.atan2(target.y-e.y,target.x-e.x);e.phase='slashWindup';e.windup=delay;C.addHazard(s,'sector',e,'blade',{x:e.x,y:e.y,r,angle,halfAngle,heavy:true},delay+dt,damage*e.damageScale);s.hazards.at(-1).maxDelay=delay;s.events.push({type:'phoenixSlashCue',x:e.x,y:e.y,radius:r,angle,halfAngle,delay,sourceId:e.id,combo});};
     const flank=mode=>{e.phase='flank';e.attackMode=mode;e.flankTime=1;e.flankSide=e.attackCount%2?1:-1;s.events.push({type:'phoenixFlank',x:e.x,y:e.y,sourceId:e.id,mode,duration:1,direction:e.flankSide});};
     if(e.phase==='closing'){
      e.closeTime-=dt;const actual=Math.hypot(target.x-e.x,target.y-e.y)||1;if(actual>225)moveCircle(s,e,(target.x-e.x)/actual*e.speed*1.45*dt,(target.y-e.y)/actual*e.speed*1.45*dt,false);
      if(actual<=230)flank('slash');else if(e.closeTime<=0)flank('dash');return;
     }
     if(e.phase==='flank'){
      e.flankTime-=dt;const px=target.x-e.x,py=target.y-e.y,actual=Math.hypot(px,py)||1,radial=actual>300?.55:actual<175?-.55:0,beforeX=e.x,beforeY=e.y;
      moveCircle(s,e,(px/actual*radial-py/actual*.84*e.flankSide)*e.speed*dt,(py/actual*radial+px/actual*.84*e.flankSide)*e.speed*dt,false);
      if(Math.hypot(e.x-beforeX,e.y-beforeY)>.001)e.moveAngle=Math.atan2(e.y-beforeY,e.x-beforeX);
      if(e.flankTime<=1e-9){if(e.attackMode==='slash')slash(185,Math.PI*5/12,.85,26);else{const distance=clamp(Math.hypot(target.x-e.x,target.y-e.y)+80,180,520),angle=Math.atan2(target.y-e.y,target.x-e.x);e.phase='windup';e.windup=.85;e.lockedX=e.x+Math.cos(angle)*distance;e.lockedY=e.y+Math.sin(angle)*distance;C.addHazard(s,'beam',e,'charge',{x:e.lockedX,y:e.lockedY,width:2*(e.r+16)},.85+dt,0);s.hazards.at(-1).maxDelay=.85;s.events.push({type:'phoenixCue',x:e.x,y:e.y,toX:e.lockedX,toY:e.lockedY,sourceId:e.id,delay:.85});}}return;
     }
     if(e.phase==='windup'){e.windup-=dt;if(e.windup<=1e-9){e.phase='dash';e.dashLeft=Math.hypot(e.lockedX-e.x,e.lockedY-e.y);s.events.push({type:'phoenixDash',fromX:e.x,fromY:e.y,toX:e.lockedX,toY:e.lockedY,sourceId:e.id});}return;}
     if(e.phase==='dash'){
      const tx=e.lockedX-e.x,ty=e.lockedY-e.y,left=Math.hypot(tx,ty),move=Math.min(left,e.dashLeft,560*dt),beforeX=e.x,beforeY=e.y;
      if(move>0)moveCircle(s,e,tx/(left||1)*move,ty/(left||1)*move,false);const moved=Math.hypot(e.x-beforeX,e.y-beforeY);if(moved>.001)e.moveAngle=Math.atan2(e.y-beforeY,e.x-beforeX);e.dashLeft=Math.max(0,e.dashLeft-moved);
      const touched=Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5;if(touched&&e.contactCooldown<=0){C.hurt(s,30*e.damageScale,false,{kind:'ram',model:'phoenix',sourceId:e.id});e.contactCooldown=1;}
      if(touched||moved<move*.6||e.dashLeft<=1||left<=1){if(e.bossStage>=2&&!e.chainUsed){e.chainUsed=true;slash(150,Math.PI/3,.7,22,2);}else recover();}return;
     }
     if(e.phase==='slashWindup'){e.windup-=dt;if(e.windup<=1e-9){e.windup=0;e.phase='slash';}return;}
     if(e.phase==='slash'){if(!s.hazards.some(h=>h.source===e.id&&h.geometry==='sector'&&h.fired&&h.life>1e-6))recover();return;}
     e.cooldown-=dt;const actual=Math.hypot(target.x-e.x,target.y-e.y)||1,side=e.attackCount%2?1:-1;
     const beforeX=e.x,beforeY=e.y,radial=actual>320?.7:actual<180?-.7:.15;moveCircle(s,e,((target.x-e.x)/actual*radial-(target.y-e.y)/actual*.7*side)*e.speed*dt,((target.y-e.y)/actual*radial+(target.x-e.x)/actual*.7*side)*e.speed*dt,false);if(Math.hypot(e.x-beforeX,e.y-beforeY)>.001)e.moveAngle=Math.atan2(e.y-beforeY,e.x-beforeX);
     if(e.intro<=0&&e.cooldown<=0){if(pendingBosses>=2){e.cooldown=.5;return;}e.attackCount++;e.chainUsed=false;s.stats.bossShots++;const mode=e.attackCount%2?'dash':'slash';if(mode==='slash'&&actual>230){e.phase='closing';e.attackMode=mode;e.closeTime=1.5;}else flank(mode);}return;
    }
    e.intro=Math.max(0,(e.intro||0)-dt);e.cooldown-=dt;
    const targetDistance=Math.hypot(target.x-e.x,target.y-e.y);
    if(targetDistance>320)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
    if(e.intro<=0&&e.cooldown<=0){if(pendingBosses>=2){e.cooldown=.5;return;}
     e.attackCount++;e.cooldown=e.hp<e.max*.45?2.8:3.7;
     if(e.model==='dinosauria'){
      C.addHazard(s,'circle',e,'mortar',{x:target.x,y:target.y,r:150},1.15,40*e.damageScale);
      const base=Math.atan2(target.y-e.y,target.x-e.x);
      for(const spread of [-.32,0,.32])C.addHazard(s,'beam',e,'rail',{x:e.x+Math.cos(base+spread)*900,y:e.y+Math.sin(base+spread)*900,width:38,heavy:true,exposeAfter:e.bossStage<2&&spread===.32},1.3,48*e.damageScale);
      if(e.bossStage>=2)C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x+Math.cos(base+Math.PI/2)*170,s.bounds.left,s.bounds.right),y:clamp(target.y+Math.sin(base+Math.PI/2)*170,s.bounds.top,s.bounds.bottom),r:105,exposeAfter:true},1.7,26*e.damageScale);
     }else{
      C.addHazard(s,'beam',e,'rail',{x:target.x+(target.x-e.x)*2,y:target.y+(target.y-e.y)*2,width:58,heavy:true},1.5,60*e.damageScale);
      const side=e.attackCount%2?1:-1;
      C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x+side*105,s.bounds.left,s.bounds.right),y:target.y,r:82},1.75,28*e.damageScale);
      C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x-side*105,s.bounds.left,s.bounds.right),y:target.y,r:82,exposeAfter:e.bossStage<2},2.15,28*e.damageScale);
      if(e.bossStage>=2)C.addHazard(s,'beam',e,'rail',{x:target.x-(target.y-e.y),y:target.y+(target.x-e.x),width:36,exposeAfter:true},2.45,26*e.damageScale);
     }
     s.stats.bossShots++;s.events.push({type:'warning',kind:e.model,x:s.x,y:s.y});
    }
    if(targetDistance<=e.r+22&&e.contactCooldown<=0){C.hurt(s,35*e.damageScale,false,{kind:'contact',model:e.model,sourceId:e.id});e.contactCooldown=.8;}
    return;
   }
   if(e.type==='artillery'){
    const targetDistance=Math.hypot(target.x-e.x,target.y-e.y);
    if(targetDistance<270)moveCircle(s,e,-dx/d*e.speed*dt,-dy/d*e.speed*dt);else if(targetDistance>390)moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
    e.cooldown-=dt;if(e.cooldown<=0){e.cooldown=3.8;C.addHazard(s,'circle',e,'mortar',{x:target.x,y:target.y,r:78},1.1,24*e.damageScale);const scout=s.enemies.find(n=>n.type==='scout'&&!n.dead&&Math.hypot(n.x-e.x,n.y-e.y)<260);if(scout){C.addHazard(s,'circle',e,'mortar',{x:clamp(target.x+(scout.x-e.x)*.45,s.bounds.left,s.bounds.right),y:clamp(target.y+(scout.y-e.y)*.45,s.bounds.top,s.bounds.bottom),r:68},1.55,20*e.damageScale);s.hazards.at(-1).linkedTo=scout.id;}s.stats.eliteShots++;s.events.push({type:'warning',kind:'mortar',x:target.x,y:target.y,linkedTo:scout?.id});}
    return;
   }
   if(e.type==='charger'){
    if(e.stagger>0)return;
    if(e.phase==='windup'){e.windup-=dt;if(e.windup<=0)e.phase='dash';return;}
    if(e.phase==='dash'){
     const tx=e.lockedX-e.x,ty=e.lockedY-e.y,left=Math.hypot(tx,ty);
     if(left<18){e.phase='stagger';e.stagger=1.15;return;}
     const move=Math.min(left,430*dt),beforeX=e.x,beforeY=e.y;moveCircle(s,e,tx/left*move,ty/left*move);
     if(Math.hypot(e.x-beforeX,e.y-beforeY)<move*.25){if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5)C.hurt(s,28*e.damageScale,false,{kind:'ram',model:'charger',sourceId:e.id});e.phase='stagger';e.stagger=1.15;return;}
     if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5){C.hurt(s,28*e.damageScale,false,{kind:'ram',model:'charger',sourceId:e.id});e.phase='stagger';e.stagger=1.15;}
     return;
    }
    if(e.phase==='stagger'){if(e.stagger<=0){e.phase='approach';e.cooldown=1.4;}return;}
    e.cooldown-=dt;
    if(d<250&&e.cooldown<=0){e.phase='windup';e.windup=.9;e.lockedX=target.x;e.lockedY=target.y;C.addHazard(s,'beam',e,'charge',{x:e.lockedX,y:e.lockedY,width:2*(e.r+18)},.9,0);s.events.push({type:'warning',kind:'charger',x:e.lockedX,y:e.lockedY,sourceId:e.id});return;}
   }
   moveCircle(s,e,dx/d*e.speed*dt,dy/d*e.speed*dt);
   if(e.type!=='scout'&&e.contactCooldown<=0){const contact=e.type==='normal'?6:10,wing=C.formation(s).slice(1).find(f=>Math.hypot(f.x-e.x,f.y-e.y)<=e.r+12+.5);if(wing){C.damageWing(s,wing.wingId,contact*e.damageScale,{kind:'contact',sourceId:e.id});e.contactCooldown=.8;}else if(Math.hypot(s.x-e.x,s.y-e.y)<=e.r+22+.5){C.hurt(s,(e.type==='charger'?28:contact)*e.damageScale,false,{kind:'contact',model:e.type,sourceId:e.id});e.contactCooldown=.8;}}
  },
  step(s,dt,input={}){
   if(s.over)return s;dt=Math.min(.05,Math.max(0,dt));s.events=[];s.time+=dt;
   const nextWave=1+Math.floor(s.time/30);if(nextWave>s.wave){for(let wave=s.wave+1;wave<=nextWave;wave++){s.level++;s.events.push({type:'waveStart',wave,threatStage:1+Math.floor((wave-1)/4)});if(s.level>=12&&s.level%4===0)s.events.push({type:'weaponMilestone',level:s.level,tier:(s.level-8)/4});}s.wave=nextWave;}const nextThreat=1+Math.floor((s.wave-1)/4);if(nextThreat!==s.threatStage){s.threatStage=nextThreat;s.events.push({type:'threatStage',stage:nextThreat,bossCap:Math.min(3,nextThreat)});}s.bossCap=Math.min(3,s.threatStage);
   const machine=C.machines[s.machine]||C.machines.m1a4;
   let mx=Number(input.moveX)||0,my=Number(input.moveY)||0,magnitude=Math.hypot(mx,my);if(magnitude>1){mx/=magnitude;my/=magnitude;}
   if(magnitude>0)s.moveAngle=Math.atan2(my,mx);const playerX=s.x,playerY=s.y;
   if(s.dash){const dash=s.dash;dash.elapsed=Math.min(dash.duration,dash.elapsed+dt);dash.remaining=Math.max(0,dash.duration-dash.elapsed);const t=dash.elapsed/dash.duration,ease=1-(1-t)*(1-t);s.x=dash.fromX+(dash.toX-dash.fromX)*ease;s.y=dash.fromY+(dash.toY-dash.fromY)*ease;s.moveAngle=Math.atan2(dash.dirY,dash.dirX);if(dash.remaining<=1e-9){let landing=dashLanding(s,dash.toX,dash.toY,dash.dirX,dash.dirY);if(!landing)for(let i=9;i>=0&&!landing;i--){const x=dash.fromX+(dash.toX-dash.fromX)*i/10,y=dash.fromY+(dash.toY-dash.fromY)*i/10;if(playerSpot(s,x,y))landing={x,y};}if(!landing)landing={x:dash.fromX,y:dash.fromY};s.x=landing.x;s.y=landing.y;s.events.push({type:'dashLand',x:s.x,y:s.y,fromX:dash.fromX,fromY:dash.fromY});s.dash=null;}}
   else moveCircle(s,s,mx*machine.speed*dt,my*machine.speed*dt,true);
   const playerMove=Math.hypot(s.x-playerX,s.y-playerY);s.moving=playerMove>.001;s.walk+=playerMove*.03;s.scroll+=playerMove;
   if(Number.isFinite(input.aimX))s.aimX=input.aimX;if(Number.isFinite(input.aimY))s.aimY=input.aimY;
   s.angle=Math.atan2(s.aimY-s.y,s.aimX-s.x);s.target=s.x;s.muzzleY=s.y;
   s.shot=Math.max(0,s.shot-dt);s.wingShot=Math.max(0,s.wingShot-dt);s.tacticCooldown=Math.max(0,s.tacticCooldown-dt);s.invulnerable=Math.max(0,s.invulnerable-dt);s.heavyInvulnerable=Math.max(0,(s.heavyInvulnerable||0)-dt);if(s.invulnerable<=0&&s.heavyInvulnerable<=0)s.invulnerabilitySource=null;
   if(s.charges<2){s.tacticRecharge-=dt;if(s.tacticRecharge<=1e-9){s.charges++;s.tacticRecharge=18;s.events.push({type:'tacticRecharge',charges:s.charges,cooldown:18});}}else s.tacticRecharge=18;
   s.burstTime=Math.max(0,s.burstTime-dt);s.burstCooldown=Math.max(0,s.burstCooldown-dt);s.dashCooldown=Math.max(0,s.dashCooldown-dt);s.wingSaveCooldown=Math.max(0,s.wingSaveCooldown-dt);s.overdrive=Math.max(0,s.overdrive-dt);
   if(s.decoy){s.decoy.life-=dt;if(s.decoy.life<=1e-9){const shock=s.decoy,hits=[];for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-shock.x,e.y-shock.y)<=180+e.r){const damage=C.damageEnemy(s,e,90);if(damage){e.stagger=Math.max(e.stagger,(e.type==='boss'?.8:1)+dt);hits.push({id:e.id,damage,killed:e.dead});}}s.events.push({type:'decoyShock',x:shock.x,y:shock.y,radius:180,hits});s.decoy=null;}}
   if(input.firing!==false){const before=s.shot;C.fire(s,machine);if(before<=0&&((s.machine==='m4a3'&&s.burstTime>0)||s.overdrive>0)&&s.shot>0)s.shot/=1.7;}
   const wingSlots=C.formation(s).slice(1,4),wings=syncWings(s),wingRanges=[];s.jammed=false;
   for(let i=0;i<wingSlots.length;i++){const f=wingSlots[i],wing=wings[i],source=s.enemies.find(e=>!e.dead&&e.jamRadius&&Math.hypot(e.x-f.x,e.y-f.y)<=e.jamRadius);wing.jamGrace=Math.max(0,(wing.jamGrace||0)-dt);wing.hostileCooldown=Math.max(0,(wing.hostileCooldown||0)-dt);if(source&&wing.jamGrace<=0){s.jammed=true;wing.jam=Math.min(2,wing.jam+dt);if(wing.jam>=1&&!wing.warned){wing.warned=true;s.events.push({type:'wingHijackWarning',wingId:wing.id,x:f.x,y:f.y,progress:wing.jam,duration:2,sourceId:source.id});}if(wing.jam>=2&&wing.hijacked<=0){wing.hijacked=2.5;wing.hostileCooldown=0;s.events.push({type:'wingHijacked',wingId:wing.id,x:f.x,y:f.y,duration:2.5,sourceId:source.id});}}else if(!source&&(wing.jam||wing.hijacked||wing.warned)){wing.jam=wing.hijacked=0;wing.jamGrace=3;wing.warned=false;s.events.push({type:'wingRecovered',wingId:wing.id,x:f.x,y:f.y,reason:'clear'});}if(wing.hijacked>0){wing.hijacked=Math.max(0,wing.hijacked-dt);if(wing.hostileCooldown<=0){const dx=s.x-f.x,dy=s.y-f.y,d=Math.hypot(dx,dy)||1;s.bullets.push({x:f.x,y:f.y,px:f.x,py:f.y,vx:dx/d*260,vy:dy/d*260,r:3,damage:4,enemy:true,life:.5,model:'hijackedWing',sourceId:wing.id,skipWingId:wing.id});wing.hostileCooldown=.9;s.events.push({type:'wingHostileShot',wingId:wing.id,x:f.x,y:f.y});}if(wing.hijacked<=0){wing.jam=0;wing.jamGrace=3;wing.warned=false;s.events.push({type:'wingRecovered',wingId:wing.id,x:f.x,y:f.y,reason:'timeout'});}}wingRanges.push(source?110:280);}
   s.wingRange=s.jammed?110:280;
   if(wingSlots.length&&s.wingShot<=0){let fired=false;const nearest=wingSlots.map((_,i)=>({enemy:null,distance:wingRanges[i]**2}));for(const e of s.enemies)if(!e.dead)for(let i=0;i<wingSlots.length;i++){if(wings[i].hijacked>0)continue;const dx=e.x-wingSlots[i].x,dy=e.y-wingSlots[i].y,distance=dx*dx+dy*dy;if(distance<nearest[i].distance)nearest[i]={enemy:e,distance};}for(let i=0;i<wingSlots.length;i++){const f=wingSlots[i],near=nearest[i].enemy;if(!near||wings[i].hijacked>0)continue;const dx=near.x-f.x,dy=near.y-f.y,d=Math.hypot(dx,dy)||1;s.bullets.push({x:f.x,y:f.y,px:f.x,py:f.y,vx:dx/d*620,vy:dy/d*620,r:4,damage:9+Math.min(5,s.level),enemy:false,life:.8,shell:false,ammo:'wing',targetId:near.id});fired=true;}if(fired)s.wingShot=.42;}
   for(const b of s.bullets){
    if(b.dead)continue;b.hitIds=b.hitIds||[];b.left=b.left??1;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const cover=obstacleHit(s,b.px,b.py,b.x,b.y,b.r);
    let nearest=null,nearestT=Infinity,wingTarget=null,playerTarget=false;
    if(!b.enemy)for(const e of s.enemies){
     if(e.dead||b.hitIds.includes(e.id))continue;if(distanceToSegment(e.x,e.y,b.px,b.py,b.x,b.y)>e.r+b.r)continue;
     const length=(b.x-b.px)**2+(b.y-b.py)**2,t=length?clamp(((e.x-b.px)*(b.x-b.px)+(e.y-b.py)*(b.y-b.py))/length,0,1):0;if(t<nearestT){nearest=e;nearestT=t;}
    }
    if(b.enemy){const length=(b.x-b.px)**2+(b.y-b.py)**2;if(distanceToSegment(s.x,s.y,b.px,b.py,b.x,b.y)<=22+b.r){nearestT=length?clamp(((s.x-b.px)*(b.x-b.px)+(s.y-b.py)*(b.y-b.py))/length,0,1):0;playerTarget=true;}for(const f of C.formation(s).slice(1))if(f.wingId!==b.skipWingId&&distanceToSegment(f.x,f.y,b.px,b.py,b.x,b.y)<=12+b.r){const t=length?clamp(((f.x-b.px)*(b.x-b.px)+(f.y-b.py)*(b.y-b.py))/length,0,1):0;if(t<nearestT){nearestT=t;wingTarget=f;playerTarget=false;}}}
    if(cover&&cover.t<=nearestT){const coverDamage=b.damage*.2;b.x=cover.x;b.y=cover.y;b.dead=true;cover.o.hp=Math.max(0,cover.o.hp-coverDamage);cover.o.flash=.1;if(cover.o.hp<=0)cover.o.dead=true;s.events.push({type:'coverImpact',x:b.x,y:b.y,obstacleId:cover.o.id,damage:coverDamage,hp:cover.o.hp,dead:cover.o.dead,ammo:b.ammo});}
    else if(nearest){const e=nearest;
     const damage=C.damageEnemy(s,e,b.damage);b.hitIds.push(e.id);b.left--;s.events.push({type:'impact',x:b.x,y:b.y,damage,targetId:e.id,killed:e.dead,ammo:b.ammo,shell:b.shell});
     if(b.ammo==='he'){
      const hits=[];for(const other of s.enemies)if(other!==e&&!other.dead&&Math.hypot(other.x-e.x,other.y-e.y)<=70+other.r){const splash=C.damageEnemy(s,other,b.damage*.7);if(splash)hits.push({id:other.id,damage:splash,killed:other.dead});}
      s.events.push({type:'blast',x:e.x,y:e.y,radius:70,hits});
     }
     if(b.left<=0)b.dead=true;
    }
    else if(b.enemy&&wingTarget){b.dead=true;C.damageWing(s,wingTarget.wingId,b.damage,{kind:'bullet',sourceId:b.sourceId});}
    else if(b.enemy&&playerTarget){b.dead=true;const damage=C.hurt(s,b.damage,false,{kind:'bullet',model:b.model,sourceId:b.sourceId});s.events.push({type:'enemyImpact',x:b.x,y:b.y,damage,model:b.model,sourceId:b.sourceId});}
    if(b.life<=0||b.x<0||b.x>1000||b.y<0||b.y>1000)b.dead=true;
   }
   s.bullets=s.bullets.filter(b=>!b.dead).slice(-120);
   for(const e of s.enemies){const x=e.x,y=e.y;C.updateEnemy(s,e,dt);const moved=Math.hypot(e.x-x,e.y-y);e.walk+=moved*.03;e.moving=moved>.001;if(e.moving)e.moveAngle=Math.atan2(e.y-y,e.x-x);}
   for(const h of s.hazards){
    if(h.cancelled)continue;
    if(!h.fired){h.delay-=dt;if(h.delay<=1e-9){h.fired=true;if(h.exposeAfter){const source=s.enemies.find(e=>e.id===h.source&&!e.dead);if(source)source.exposed=2;}
     if(h.kind==='support'){const hits=[];for(const e of s.enemies)if(!e.dead&&Math.hypot(e.x-h.x,e.y-h.y)<=h.r+e.r){const damage=C.damageEnemy(s,e,e.type==='boss'?300:450);if(damage){let interrupted=false;if(!e.dead){e.stagger=Math.max(e.stagger,1.5);for(const pending of s.hazards)if(!pending.fired&&(pending.source===e.id||pending.linkedTo===e.id))pending.cancelled=interrupted=true;if(e.type==='charger'){e.phase='stagger';e.windup=0;e.lockedX=e.lockedY=null;}else if(e.type==='stier'){e.phase='cooling';e.windup=0;e.cooling=2.4;e.exposed=Math.max(e.exposed,2.4);}else if(e.model==='phoenix'&&['closing','flank','windup','slashWindup','dash'].includes(e.phase)){e.phase='recover';e.windup=0;e.dashLeft=0;e.exposed=Math.max(e.exposed,2);s.events.push({type:'phoenixRecover',x:e.x,y:e.y,sourceId:e.id,exposed:2,interrupted:true});}s.stats.interrupts++;interrupted=true;}hits.push({id:e.id,damage,killed:e.dead,interrupted});}}s.events.push({type:'mortarImpact',kind:h.kind,x:h.x,y:h.y,r:h.r,sourceId:h.source,model:h.model,hits});}
     else if(h.geometry==='circle')s.events.push({type:'mortarImpact',kind:h.kind,x:h.x,y:h.y,r:h.r,sourceId:h.source,model:h.model});
     else if(h.geometry==='sector')s.events.push({type:'phoenixSlash',kind:h.kind,x:h.x,y:h.y,radius:h.r,angle:h.angle,halfAngle:h.halfAngle,sourceId:h.source,model:h.model,life:h.life,maxLife:h.maxLife});
     else {if(h.blockedBy){const o=s.obstacles.find(o=>o.id===h.blockedBy);if(o&&!o.dead){const coverDamage=h.heavy?80:h.damage;o.hp=Math.max(0,o.hp-coverDamage);o.flash=.12;if(o.hp<=0)o.dead=true;s.events.push({type:'coverImpact',x:h.toX,y:h.toY,obstacleId:o.id,damage:coverDamage,hp:o.hp,dead:o.dead,kind:h.kind});}}s.events.push({type:'cannon',kind:h.kind,fromX:h.fromX,fromY:h.fromY,toX:h.toX,toY:h.toY,rawToX:h.rawToX,rawToY:h.rawToY,width:h.width,sourceId:h.source,model:h.model,blockedBy:h.blockedBy});}
    }}
    else h.life-=dt;
    if(h.fired&&!h.hitPlayer&&!h.playerImmune&&C.insideHazard(s,h)){h.hitPlayer=true;if(h.damage>0)C.hurt(s,h.damage,false,{kind:h.kind,model:h.model,sourceId:h.source});}
    if(h.fired&&!h.playerImmune&&h.damage>0){h.hitWingIds=h.hitWingIds||[];for(const f of C.formation(s).slice(1))if(!h.hitWingIds.includes(f.wingId)&&insideShape(f.x,f.y,12,h)){h.hitWingIds.push(f.wingId);C.damageWing(s,f.wingId,h.damage,{kind:h.kind,sourceId:h.source});}}
   }
   s.hazards=s.hazards.filter(h=>!h.cancelled&&(!h.fired||h.life>0)).slice(-160);
   for(const box of s.crates){if(box.life===undefined)box.life=30;box.life-=dt;if(!box.used&&Math.hypot(box.x-s.x,box.y-s.y)<=56)C.collect(s,box);}
   s.crates=s.crates.filter(box=>!box.used&&box.life>0).slice(-24);
   s.pickupTimer-=dt;if(s.pickupTimer<=1e-9){s.pickupTimer=18;const pairs=[[[160,180],[290,180]],[[500,820],[630,820]],[[440,590],[570,590]],[[820,520],[820,650]]],positions=pairs[s.supplyGroup%pairs.length],offense=['weapon','charge','ap','he','overdrive','emp','recruit'],kinds=s.supplyGroup===0?['shield','weapon']:[s.supplyGroup%2?'repair':'shield',offense[Math.floor(s.random()*offense.length)]],group=++s.supplyGroup;for(const [i,p] of positions.entries()){const spot=pickupSpot(s,p[0],p[1]);s.crates.push({id:s.nextId++,group,kind:kinds[i],x:spot.x,y:spot.y,used:false,life:18});}s.events.push({type:'supplyChoice',group,crates:s.crates.filter(b=>b.group===group).map(b=>({id:b.id,kind:b.kind,x:b.x,y:b.y}))});}
   s.spawn-=dt;if(s.spawn<=0){s.spawn=Math.max(.6,1.1-s.time*.0015);const amount=Math.min(3,1+Math.floor((s.wave-1)/2)),order=['scout','artillery','shield','jammer','mine','swarm','charger','stier'],specials=[];if(s.time>=s.nextSpecial){for(let slot=0;slot<Math.min(amount,s.threatStage);slot++){const candidate=order[s.specialIndex++%order.length],baseLimit=candidate==='jammer'?2:candidate==='swarm'?4:3,limit=baseLimit+(s.threatStage>=3?1:0);if(s.enemies.filter(e=>!e.dead&&e.type===candidate).length<limit)specials.push(candidate);}s.nextSpecial+=Math.max(3.5,7-(s.threatStage-1)*.75);}for(let i=0;i<amount;i++){let type=specials[i]||'normal';if(type==='normal'&&s.time>=12&&s.random()<Math.min(.35,.2+(s.threatStage-1)*.02))type='gunner';C.spawnEnemy(s,type);}}
   const activeBosses=s.enemies.filter(e=>e.type==='boss'&&!e.dead).length;if(activeBosses<s.bossCap){s.boss-=dt;if(s.boss<=5&&!s.bossWarned){s.bossWarned=true;s.events.push({type:'warning',kind:'boss',eta:5,bossCap:s.bossCap});}if(s.boss<=0){const bosses=['dinosauria','phoenix','morpho'],spawned=C.spawnSpecial(s,bosses[(s.bossIndex+s.bossSpawnCount)%bosses.length]);if(spawned)s.bossSpawnCount++;s.boss=spawned?25:1;s.bossWarned=false;}}
   s.enemies=s.enemies.filter(e=>!e.dead);
   s.stats.peakEnemies=Math.max(s.stats.peakEnemies,s.enemies.filter(e=>!e.dead).length);
   return s;
  }
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=C;else root.GameArenaCore=C;
})(typeof globalThis!=='undefined'?globalThis:this);

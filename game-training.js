(function(root){
 'use strict';
 const lessons=[
  {title:'四向移動與主砲',objective:'移入標記區，並用主砲命中目標。',speaker:'lena',message:'保持移動，游標對準目標後主砲會自動開火。'},
  {title:'躍進越過掩體',objective:'用右鍵躍過低掩體，落在標記區。',speaker:'shin',message:'右鍵躍進可越過低掩體，但落點必須有足夠空間。'},
  {title:'回收與切換武器',objective:'先回收機砲彈，再按 Q 切換，最後瞄準新出現的目標。',speaker:'lena',message:'先靠近機砲補給。回收後再按 Q 切換武器。'},
  {title:'誘導撲空後反擊',objective:'躲開獵兵預警衝撞，趁失衡期間命中它。',speaker:'shin',message:'等衝撞方向鎖定再橫移，撲空後是反擊窗口。'},
  {title:'排除飛群干擾',objective:'讓支援曾被封鎖，清除六隻飛群，再成功呼叫支援。',speaker:'lena',message:'干擾中呼叫不會消耗次數；先清飛群，再按 Space。'}
 ];
 const marker=(x,y,r=55)=>({x,y,r});
 const inMarker=(s,m)=>!!m&&Math.hypot(s.x-m.x,s.y-m.y)<=m.r;
 const randomFor=step=>{let seed=(0x8639+step*997)>>>0;return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};};
 function prepare(session,step){
  const C=session._C,s=C.setup(C.create(randomFor(step)),{machine:session._machine,map:'ruins'});
  Object.assign(s,{count:1,wings:[],spawn:1e9,boss:1e9,pickupTimer:1e9,wingRecruitTimer:1e9,wave:1,waveKind:'normal',wavePhase:'engaging',waveElapsed:0,waveSpawned:0,waveTotal:1,waveBossSpawned:0,waveEliteSpawned:0,regroupRemaining:0});
  s.enemies=[];s.crates=[];s.hazards=[];s.bullets=[];s.obstacles=[];s.x=s.y=800;s.aimX=1040;s.aimY=800;
  session.step=step;session.state=s;session.title=lessons[step].title;session.objective=lessons[step].objective;session.speaker=lessons[step].speaker;session.message=lessons[step].message;session.marker=null;session.done=false;session._seen={};session._delay=null;session._targetIds=[];
  if(step===0){session.marker=marker(900,800,60);const enemy=C.spawnEnemy(s,'normal',1040,800);session._targetIds=[enemy.id];}
  else if(step===1){s.x=650;s.obstacles=[{id:'training-cover',kind:'cover',height:'low',x:740,y:800,w:50,h:150,hp:180,max:180,dead:false}];session.marker=marker(835,800,65);}
  else if(step===2){session.marker=marker(825,800,58);s.crates=[{id:s.nextId++,group:1,kind:'autocannon',x:825,y:800,used:false,life:1e9}];}
  else if(step===3){session.marker=marker(800,1020,75);const enemy=C.spawnEnemy(s,'charger',600,800);enemy.cooldown=0;session._targetIds=[enemy.id];}
  else{session.marker=marker(800,800,150);const flockId=s.nextFlockId++;for(let i=0;i<6;i++){const angle=i*Math.PI/3,enemy=C.spawnEnemy(s,'swarm',800+Math.cos(angle)*110,800+Math.sin(angle)*110);enemy.flockId=flockId;enemy.flockLeader=i===0;session._targetIds.push(enemy.id);}}
  return s;
 }
 function complete(session){if(session._delay!==null)return;session._delay=1;session.message='完成。準備下一項練習。';}
 const api={
  create(C,options={}){if(!C||typeof C.create!=='function'||typeof C.setup!=='function')throw new TypeError('GameTraining requires GameArenaCore');const session={_C:C,_machine:C.machines?.[options.machine]?options.machine:'m1a4',state:null,step:0,title:'',objective:'',speaker:'',message:'',marker:null,done:false,skipped:false};prepare(session,0);return session;},
  observe(session,events){if(!session?.state||session.done)return session;for(const event of Array.isArray(events)?events:[events]){if(!event)continue;const seen=session._seen;
    if(session.step===0&&event.type==='impact'&&session._targetIds.includes(event.targetId)&&!['autocannon','heavy'].includes(event.ammo))seen.mainHit=true;
    else if(session.step===1&&event.type==='ability'&&event.kind==='dash')seen.dashed=true;
    else if(session.step===2){if(event.type==='collect'&&event.kind==='autocannon'){seen.picked=true;session.message='機砲彈已回收。按 Q 切換到機砲。';}else if(event.type==='trainingInput'&&event.code==='KeyQ'&&seen.picked){seen.q=true;session.message='切換指令已輸入。';}else if(event.type==='weaponSwitch'&&event.slot===2&&seen.q){seen.switched=true;seen.ammoAtSwitch=session.state.specialAmmo.autocannon;if(!session._targetIds.length){const enemy=session._C.spawnEnemy(session.state,'normal',1040,800);if(enemy)session._targetIds=[enemy.id];}session.message='已切換機砲。瞄準新出現的目標。';}else if(event.type==='impact'&&event.ammo==='autocannon'&&session._targetIds.includes(event.targetId)&&seen.switched)seen.limitedHit=true;}
    else if(session.step===3){if(event.type==='warning'&&event.kind==='charger'&&session._targetIds.includes(event.sourceId))seen.warned=event.sourceId;else if(event.type==='hurt'&&seen.warned&&(event.source?.sourceId??event.sourceId)===seen.warned)seen.hit=true;else if(seen.warned&&!seen.hit&&((event.type==='impact'&&event.targetId===seen.warned)||(event.type==='ability'&&event.hits?.some(hit=>hit.id===seen.warned)))){const enemy=session.state.enemies.find(item=>item.id===seen.warned);if(enemy?.phase==='stagger')seen.countered=true;}}
    else if(session.step===4){if(event.type==='uplinkChanged'&&event.blocked)seen.blocked=true;else if(event.type==='tacticBlocked'&&seen.blocked){seen.blockedAttempt=true;seen.charges=session.state.charges;}else if(event.type==='uplinkChanged'&&!event.blocked&&seen.blockedAttempt){seen.unblocked=true;session.message='鏈路恢復，按 Space 呼叫支援。';}else if(event.type==='tactic'&&event.kind==='support'&&seen.unblocked)seen.support=true;}
   }return session;},
  tick(session,dt=0){if(!session?.state||session.done)return session?.state??null;if(session.state.over){prepare(session,session.step);session.message='主機失能，已重新建立本項練習。';return session.state;}const seen=session._seen;
   if(session.step===3&&seen.hit){prepare(session,3);session.message='衝撞命中，已重新建立本項練習。';return session.state;}
   const cleared=session._targetIds.length&&session._targetIds.every(id=>!session.state.enemies.some(enemy=>enemy.id===id&&!enemy.dead)),achieved=session.step===0?seen.mainHit&&inMarker(session.state,session.marker):session.step===1?seen.dashed&&!session.state.dash&&inMarker(session.state,session.marker):session.step===2?seen.picked&&seen.q&&seen.switched&&seen.limitedHit&&session.state.specialAmmo.autocannon<seen.ammoAtSwitch:session.step===3?seen.warned&&seen.countered:seen.blocked&&seen.blockedAttempt&&seen.unblocked&&seen.support&&session.state.charges<seen.charges&&cleared;
   if(session._delay===null&&session.step>=2&&cleared&&!achieved&&(session.step!==4||!seen.blockedAttempt)){const step=session.step,messages=['','', '目標在完成 Q 切換前被擊破，已重新建立本項練習。','獵兵在失衡反擊前被擊破，已重新建立本項練習。','飛群在支援封鎖確認前被清除，已重新建立本項練習。'];prepare(session,step);session.message=messages[step];return session.state;}
   if(session._delay===null&&achieved)complete(session);
   if(session._delay!==null){session._delay-=Math.max(0,Number(dt)||0);if(session._delay<=1e-9){if(session.step===lessons.length-1){session.done=true;session.message='實戰練習完成。';}else prepare(session,session.step+1);}}
   return session.state;},
  skip(session){if(!session?.state||session.done)return null;session.state=null;session.done=true;session.skipped=true;session.marker=null;session.message='已跳過實戰練習。';return null;},
  dispose(session){if(session){session.state=null;session.done=true;session.marker=null;}return null;}
 };
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GameTraining=api;
})(typeof globalThis!=='undefined'?globalThis:this);

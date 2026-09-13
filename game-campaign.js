(function(root){
 const Core=typeof module!=='undefined'&&module.exports?require('./game-arena-core.js'):root.GameArenaCore;
 const mission=(speaker,text)=>({type:'mission',speaker,text});
 const nodes=()=>[
  {id:'cargo',x:800,y:850,r:80,label:'中央回收點',done:false},
  {id:'rescue',x:300,y:930,r:80,label:'西側救援訊號',done:false},
  {id:'exit',x:800,y:130,r:80,label:'北側撤離點',done:false}
 ];
 const Campaign=Object.assign(Object.create(Core),{
  create(random=Math.random){return Core.create(random);},
  setup(s,options={}){
   const random=s?.random||Math.random;
   Object.assign(s,Core.create(random));
   Core.setup(s,{machine:'m1a4',ammo:options.ammo});
   Object.assign(s,{mode:'campaign',encounter:'ash-return',worldBounds:{left:0,right:1600,top:0,bottom:1600},bounds:{left:60,right:1540,top:60,bottom:1540},x:800,y:1480,aimX:800,aimY:1100,supplyAnchors:null});
   s.obstacles=[
    {id:'ash-west-spine',kind:'wall',height:'high',x:560,y:750,w:120,h:620,dead:false},
    {id:'ash-east-spine',kind:'wall',height:'high',x:1040,y:750,w:120,h:620,dead:false},
    {id:'ash-north-west',kind:'wall',height:'high',x:390,y:400,w:440,h:100,dead:false},
    {id:'ash-north-east',kind:'wall',height:'high',x:1210,y:400,w:440,h:100,dead:false},
    {id:'ash-cover-west',kind:'cover',height:'low',x:290,y:690,w:170,h:70,hp:180,max:180,dead:false},
    {id:'ash-cover-centre',kind:'cover',height:'low',x:800,y:1060,w:180,h:70,hp:180,max:180,dead:false},
    {id:'ash-cover-east',kind:'cover',height:'low',x:1310,y:690,w:170,h:70,hp:180,max:180,dead:false}
   ];
   s.campaign={stage:'approach',cargo:false,rescued:false,working:null,progress:0,nodes:nodes(),objective:'前往中央回收點',hint:'斥候正在替北側重砲標定目標',saved:{cargo:0,rescue:0},spawned:{approach:false,recover:false,extract:false},loweId:null};
   s.wavePhase='campaign';s.waveTotal=0;s.pickupTimer=Infinity;s.spawn=Infinity;
   s.crates.push({id:s.nextId++,kind:'shield',x:940,y:1450,used:false,life:Infinity,campaignSupply:true});
   s.events=[mission('lena','回收點在舊城中央。我會更新路線，請保留撤離用的彈藥。')];
   return s;
  },
  interact(s){
   if(!s.campaign||s.over)return false;
   if(s.campaign.working){const id=s.campaign.working;s.campaign.saved[id]=id==='cargo'?Math.floor(s.campaign.saved[id]/3)*3:0;s.campaign.working=null;s.campaign.progress=s.campaign.saved.cargo/6;s.events.push(mission('shin','中止作業，先確保周圍安全。'));return true;}
   const n=s.campaign.nodes.find(point=>Math.hypot(s.x-point.x,s.y-point.y)<=point.r+22);
   if(!n)return false;
   if(n.id==='exit'){
    if(!s.campaign.cargo){s.events.push(mission('lena','主要物資尚未回收，現在不能撤離。'));return false;}
    n.done=true;s.over=s.won=true;s.campaign.working=null;s.campaign.objective='任務完成';s.campaign.hint='已確認返回';s.events.push(mission('lena','已確認返回。回收紀錄稍後再說，先整備。'));return true;
   }
   if(n.done)return false;
   s.campaign.working=n.id;s.campaign.progress=n.id==='cargo'?s.campaign.saved.cargo/6:s.campaign.saved.rescue/3;
   s.events.push(mission('lena',n.id==='cargo'?'開始回收作業。':'開始確認失聯機體。'));return true;
  },
  step(s,dt,input={}){
   if(s.over)return s;
   Core.step(s,dt,input);
   if(s.over)return s;
   const c=s.campaign,added=[];
   if(!c.spawned.approach&&s.y<=1250){
    c.spawned.approach=true;
    const scout=Core.spawnEnemy(s,'scout',720,720),lowe=Core.spawnEnemy(s,'shield',800,220);
    Core.spawnEnemy(s,'normal',410,1110);Core.spawnEnemy(s,'normal',1190,1110);
    if(lowe){c.loweId=lowe.id;lowe.campaignSentry=true;lowe.campaignActive=false;}
    added.push(mission('shin','前面那隻在替重砲看路。先處理它。'));
   }
   if(!c.spawned.recover&&Math.hypot(s.x-800,s.y-850)<=280){c.spawned.recover=true;Core.spawnEnemy(s,'charger',260,760);Core.spawnEnemy(s,'charger',1340,760);added.push(mission('lena','西側還有失聯機體的訊號。接近會暴露在街道上，由你判斷。'));}
   if(!c.spawned.extract&&c.cargo){c.spawned.extract=true;Core.spawnEnemy(s,'scout',700,300);Core.spawnEnemy(s,'normal',1080,300);}
   if(c.working){
    const n=c.nodes.find(point=>point.id===c.working),duration=n.id==='cargo'?6:3;
    if(Math.hypot(s.x-n.x,s.y-n.y)>n.r+22){c.saved[n.id]=n.id==='cargo'?Math.floor(c.saved[n.id]/3)*3:0;c.working=null;c.progress=c.saved.cargo/6;added.push(mission('shin','已離開作業範圍。'));}
    else{
     c.saved[n.id]=Math.min(duration,c.saved[n.id]+Math.min(.05,Math.max(0,dt)));c.progress=c.saved[n.id]/duration;
     if(c.saved[n.id]>=duration-1e-9){n.done=true;c.working=null;
      if(n.id==='cargo'){c.cargo=true;c.stage='extract';c.progress=1;c.objective='前往北側撤離點';c.hint='可擊毀重型機，也可繞過封鎖';s.crates.push({id:s.nextId++,kind:'autocannon',x:700,y:760,used:false,life:Infinity,campaignSupply:true},{id:s.nextId++,kind:'repair',x:900,y:760,used:false,life:Infinity,campaignSupply:true});added.push(mission('shin','拿到了。接下來是把自己帶回去。'));}
      else{c.rescued=true;c.progress=c.saved.cargo/6;s.crates.push({id:s.nextId++,kind:'repair',x:420,y:930,used:false,life:120,campaignSupply:true});added.push(mission('lena','已確認生還訊號。補給已送到西側道路。'));}
     }
    }
   }
   if(c.stage==='approach'&&Math.hypot(s.x-800,s.y-850)<=280){c.stage='recover';c.objective='回收中央物資';c.hint='按 E 開始或取消，完成一段後會保留進度';}
   const exit=c.nodes.find(point=>point.id==='exit');
   if(c.cargo&&Math.hypot(s.x-exit.x,s.y-exit.y)<=exit.r+22){exit.done=true;s.over=s.won=true;c.working=null;c.objective='任務完成';c.hint='已確認返回';added.push(mission('lena','已確認返回。回收紀錄稍後再說，先整備。'));}
   s.events.push(...added);
   return s;
  },
  result(s){
   if(!s.over)return null;
   const base=Core.result(s)||{},lowe=s.enemies.find(e=>e.id===s.campaign.loweId),destroyed=!!s.campaign.loweId&&!lowe;
   return Object.freeze({...base,mode:'campaign',encounter:'ash-return',won:!!s.won,cargo:!!s.campaign.cargo,rescued:!!s.campaign.rescued,summary:`突破：${destroyed?'擊毀 Löwe':'繞過 Löwe'}；救援：${s.campaign.rescued?'完成':'未執行'}`});
  }
 });
 if(typeof module!=='undefined'&&module.exports)module.exports=Campaign;else root.GameCampaign=Campaign;
})(typeof globalThis!=='undefined'?globalThis:this);

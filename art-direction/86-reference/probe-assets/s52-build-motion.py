import bpy,json,math,struct
from pathlib import Path
from mathutils import Vector,Matrix
OUT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath='/private/tmp/s51-project86-juggernaut/juggernaut-inspected.blend')
stray=bpy.data.objects.get('Cylinder')
if stray and stray.parent and stray.parent.name=='inspection-scale':bpy.data.objects.remove(stray,do_unlink=True)
arm=next(o for o in bpy.data.objects if o.type=='ARMATURE');arm.animation_data_clear();arm.animation_data_create()
for action in list(bpy.data.actions):bpy.data.actions.remove(action)
for p in arm.pose.bones:p.matrix_basis.identity();p.rotation_mode='QUATERNION'
bpy.context.view_layer.update()
scale=arm.matrix_world.to_scale().x
rest={p.name:p.bone.matrix_local.copy() for p in arm.pose.bones}
legs=['L.F.Leg','R.B.Leg','R.F.Leg','L.B.Leg'];phases=[0,.5,.25,.75]
feet={o.parent_bone:o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('Foot.')}
base_mesh={k:o.matrix_world.copy() for k,o in feet.items()}
points=[o.matrix_world@v.co for o in bpy.data.objects if o.type=='MESH' for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)]);hi=Vector([max(v[i] for v in points) for i in range(3)])
def gl(v):return [round(v.x,6),round(v.z,6),round(-v.y,6)]
def bone_pos(name):return gl(arm.matrix_world@rest[name].translation)
cannon=bpy.data.objects['Cannon'];vs=[cannon.matrix_world@v.co for v in cannon.data.vertices];front=min(v.y for v in vs);tip=[v for v in vs if v.y<front+.025];muzzle=sum(tip,Vector())/len(tip)
anchor=bpy.data.objects.new('muzzle_anchor',None);bpy.context.collection.objects.link(anchor);anchor.parent=cannon;anchor.matrix_world=Matrix.Translation(muzzle)
bpy.context.view_layer.update()
DURATION=1.8;STRIDE=.95;DUTY=.75;SPEED=STRIDE/(DURATION*DUTY);LIFT=.34
fps=60;bpy.context.scene.render.fps=fps
moving=['Body']+[leg+s for leg in legs for s in ['.002','.003','.004']]

def reset():
 arm.animation_data.action=None
 for p in arm.pose.bones:p.matrix_basis.identity()
 bpy.context.view_layer.update()

def setbone(name,head,direction=None):
 m=rest[name].copy()
 if direction is not None:
  d=arm.data.bones[name].tail_local-arm.data.bones[name].head_local
  m=d.rotation_difference(direction).to_matrix().to_4x4()@m
 m.translation=head;arm.pose.bones[name].matrix=m;bpy.context.view_layer.update()

def solve(leg,delta,body):
 n=leg+'.002';n2=leg+'.003';foot=leg+'.004'
 h=rest[n].translation+body;k=rest[n2].translation+body;e0=rest[foot].translation+body;e=rest[foot].translation+delta
 a=(k-h).length;b=(e0-k).length;axis=(e-h).normalized();dist=(e-h).length
 assert abs(a-b)+1e-5<dist<a+b-1e-5,(leg,dist,a+b)
 along=(a*a-b*b+dist*dist)/(2*dist)
 bend=(k-h)-axis*(k-h).dot(axis);bend.normalize()
 knee=h+axis*along+bend*math.sqrt(max(0,a*a-along*along))
 setbone(n,h,knee-h);setbone(n2,knee,e-knee);setbone(foot,e)
 return (arm.pose.bones[foot].head-e).length*scale

def smooth(u):return u*u*(3-2*u)
def envelope(t,keys):
 for (t0,v0),(t1,v1) in zip(keys,keys[1:]):
  if t<=t1:return v0+(v1-v0)*smooth(max(0,(t-t0)/(t1-t0)))
 return keys[-1][1]
def footpath(p):
 if p<DUTY:return STRIDE*(p/DUTY-.5),0,True
 u=(p-DUTY)/(1-DUTY);m=STRIDE*(1-DUTY)/DUTY
 y=(2*u**3-3*u*u+1)*STRIDE*.5+(u**3-2*u*u+u)*m+(-2*u**3+3*u*u)*(-STRIDE*.5)+(u**3-u*u)*m
 return y,LIFT*16*u*u*(1-u)*(1-u),False
metrics={};actions={}
for clip,dur in [('idle',2),('walk',1.8),('trot',.8),('recoil',.5),('vault',1.2)]:
 DURATION,STRIDE,DUTY,LIFT,phases=(.8,2.,.6,.48,[0,0,.5,.5]) if clip=='trot' else (1.8,.95,.75,.34,[0,.5,.25,.75]);SPEED=STRIDE/(DURATION*DUTY)
 reset();act=bpy.data.actions.new(clip);act.use_fake_user=True;arm.animation_data.action=act;actions[clip]=act
 records=[];maxerr=0
 for frame in range(1,round(dur*fps)+2):
  t=(frame-1)/fps;bpy.context.scene.frame_set(frame)
  for p in arm.pose.bones:p.matrix_basis.identity()
  body=Vector()
  if clip=='vault':body.z=envelope(t,[(0,0),(.15,-.12),(.42,0),(.64,0),(.91,-.10),(1.2,0)])/scale
  setbone('Body',body)
  for leg,phase in zip(legs,phases):
   delta=Vector();planted=True
   if clip in ['walk','trot']:
    p=(t/DURATION+phase)%1;y,z,planted=footpath(p);delta=Vector((0,y/scale,z/scale))
   if clip=='vault':
    fold=envelope(t,[(0,0),(.16,0),(.42,1),(.63,1),(.86,0),(1.2,0)])
    delta=Vector(((-1 if rest[leg+'.004'].translation.x>0 else 1)*.46*fold/scale,0,(max(body.z*scale,0)+.50*fold)/scale));planted=fold==0
   maxerr=max(maxerr,solve(leg,delta,body))
   if clip in ['walk','trot']:
    f=feet[leg+'.004'];world=arm.matrix_world@arm.pose.bones[leg+'.004'].head
    world.y-=SPEED*t
    meshpoints=[f.matrix_world@v.co for v in f.data.vertices]
    records.append({'frame':frame,'leg':leg,'planted':planted,'world':list(world),'minZ':min(v.z for v in meshpoints)})
  if clip=='recoil':
   amt=envelope(t,[(0,0),(.05,.20),(.10,.17),(.36,.015),(.5,0)])
   setbone('Cannon',rest['Cannon'].translation+Vector((0,amt/scale,0)))
  for name in (['Cannon'] if clip=='recoil' else moving):
   p=arm.pose.bones[name]
   p.keyframe_insert(data_path='location',frame=frame,group=name);p.keyframe_insert(data_path='rotation_quaternion',frame=frame,group=name)
  bpy.context.view_layer.update()
 # Linear samples prevent a Bezier handle from changing the solved plant interval.
 for fc in act.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
 metrics[clip]={'durationSeconds':dur,'ikEndpointMaxErrorWorld':maxerr}
 if clip in ['walk','trot']:
  drift=0;heights=[]
  for leg in legs:
   previous=None
   for r in [r for r in records if r['leg']==leg]:
    if r['planted']:
     heights.append(r['minZ'])
     if previous:drift=max(drift,(Vector(r['world'])-Vector(previous['world'])).length)
     previous=r
    else:previous=None
  metrics[clip].update({'stanceAdjacentFrameWorldDriftMax':drift,'stanceSoleHeightMin':min(heights),'stanceSoleHeightMax':max(heights),'footRecords':records})
 print('BUILT',clip,metrics[clip]['ikEndpointMaxErrorWorld'],flush=True)
DURATION,STRIDE,DUTY,LIFT,phases=1.8,.95,.75,.34,[0,.5,.25,.75];SPEED=STRIDE/(DURATION*DUTY)
# Put each baked action on its own muted NLA track so ACTIONS export discovers all four.
arm.animation_data.action=None
for name,act in actions.items():
 tr=arm.animation_data.nla_tracks.new();tr.name=name;st=tr.strips.new(name,1,act);tr.mute=True
for p in arm.pose.bones:p.matrix_basis.identity()
bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
blend=OUT/'s52-juggernaut-motion.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=OUT/'s52-juggernaut-motion.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True,export_anim_slide_to_zero=True,export_skins=True,export_morph=False)
# Exporter sampling emits constant transforms for unrelated bones. Remove those channels to permit cannon/leg layering.
buf=glb.read_bytes();jsonlen=struct.unpack_from('<I',buf,12)[0];doc=json.loads(buf[20:20+jsonlen]);tail=buf[20+jsonlen:]
for anim in doc.get('animations',[]):
 allowed={'Cannon'} if anim['name']=='recoil' else set(moving)
 anim['channels']=[c for c in anim['channels'] if doc['nodes'][c['target']['node']].get('name') in allowed]
 print('CHANNELS',anim['name'],len(anim['channels']),flush=True)
payload=json.dumps(doc,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
glb.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(payload)+len(tail))+struct.pack('<I4s',len(payload),b'JSON')+payload+tail)
report={'status':'local research motion increment; not final production animation','rights':'Original Project86 asset; local research only; do not publish','coordinateSystem':'glTF right-handed +Y up, +Z forward; Blender source -Y forward','dimensions':{'widthX':hi.x-lo.x,'heightY':hi.z-lo.z,'lengthZ':hi.y-lo.y},'muzzleLocal':gl(muzzle),'turretYawAxisLocal':list(rest['Turret'].to_3x3().inverted()@Vector((0,0,1))),'muzzleBoneRestOffset':list(rest['Cannon'].inverted()@ (arm.matrix_world.inverted()@muzzle)),'muzzleAnchor':'muzzle_anchor','pivots':{n:bone_pos(n) for n in ['Body','Turret','Cannon']},'trot':{'durationSeconds':.8,'strideWorld':2.,'forwardTravelPerCycle':3.3333333333,'nominalSpeedWorldPerSecond':4.1666666667,'stanceFraction':.6,'maxFootLiftWorld':.48,'legPhases':dict(zip(legs,[0,0,.5,.5]))},'walk':{'durationSeconds':DURATION,'strideWorld':STRIDE,'forwardTravelPerCycle':SPEED*DURATION,'nominalSpeedWorldPerSecond':SPEED,'stanceFraction':DUTY,'maxFootLiftWorld':LIFT,'legPhases':dict(zip(legs,phases)),'control':'Baked analytical two-link IK, fixed segment lengths, rest-derived knee bend plane; foot world orientation preserved; linear stance and Hermite swing horizontal path; quartic lift; no runtime IK'},'animations':{k:{**{a:b for a,b in v.items() if a!='footRecords'},'channelMask':['Cannon'] if k=='recoil' else moving,'loop':k in ['walk','trot','idle']} for k,v in metrics.items()},'stopControl':'Crossfade walk to idle in 0.16-0.22 s. idle is the exact original rest pose. Stop blend is runtime responsibility.','vaultControl':'1.2 s, in-place root; Body has only 0.12 launch and 0.10 landing compression; legs fold inward 0.46 and up 0.50. Caller supplies full horizontal and vertical jump trajectory.','limitations':['Foot plant measured on straight level travel at nominal speed, not turns or slopes.','Crawl is first inspectable mechanical motion, not reference-matched final choreography.','Hip swing uses rest-derived bend plane, no verified hard mechanical limits.','Whole Cannon rigid mesh recoils, including attached magazine; no segmented barrel rig.','Idle is a deliberate still mechanical rest pose.','Runtime blending temporarily relaxes foot plant.'],'glbAudit':{'animationChannels':{a['name']:len(a['channels']) for a in doc.get('animations',[])},'externalUris':[o['uri'] for key in ['images','buffers'] for o in doc.get(key,[]) if 'uri' in o]}}
(OUT/'s52-juggernaut-motion.json').write_text(json.dumps(report,indent=2));(OUT/'s52-foot-plant-samples.json').write_text(json.dumps(metrics['walk']['footRecords'],indent=2))
print('REPORT',json.dumps(report),flush=True)

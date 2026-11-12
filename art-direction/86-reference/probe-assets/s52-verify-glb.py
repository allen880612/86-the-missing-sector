import json,struct,bisect
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
out=Path(__file__).resolve().parent
b=(out/'s52-juggernaut-motion.glb').read_bytes();jn=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+jn]);binary=b[28+jn:]
nodes=d['nodes'];parents={ch:i for i,n in enumerate(nodes) for ch in n.get('children',[])}
def acc(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];count={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];fmt={5126:'f',5123:'H',5125:'I'}[a['componentType']];size=struct.calcsize(fmt)*count;start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*count,binary,start+j*v.get('byteStride',size)) for j in range(a['count'])]
def quat(v):return Quaternion((v[3],v[0],v[1],v[2]))
cache={i:acc(i) for a in d['animations'] for s in a['samplers'] for i in [s['input'],s['output']]}
def world(anim,t):
 trs={i:{'translation':n.get('translation',[0,0,0]),'rotation':n.get('rotation',[0,0,0,1]),'scale':n.get('scale',[1,1,1])} for i,n in enumerate(nodes)}
 for c in anim.get('channels',[]):
  sam=anim['samplers'][c['sampler']];ts=[x[0] for x in cache[sam['input']]];vs=cache[sam['output']];k=max(0,min(len(ts)-2,bisect.bisect_right(ts,t)-1)) if len(ts)>1 else 0;u=0 if len(ts)==1 else max(0,min(1,(t-ts[k])/(ts[k+1]-ts[k])))
  path=c['target']['path'];v=vs[k]
  if u:
   if path=='rotation':q=quat(v).slerp(quat(vs[k+1]),u);v=[q.x,q.y,q.z,q.w]
   else:v=[a+(b-a)*u for a,b in zip(v,vs[k+1])]
  trs[c['target']['node']][path]=v
 matrices={}
 def mat(i):
  if i not in matrices:
   n=nodes[i];v=trs[i]
   m=Matrix([n['matrix'][j:j+4] for j in range(0,16,4)]).transposed() if 'matrix' in n else Matrix.LocRotScale(Vector(v['translation']),quat(v['rotation']),Vector(v['scale']))
   matrices[i]=mat(parents[i])@m if i in parents else m
  return matrices[i]
 for i in range(len(nodes)):mat(i)
 return matrices
report={};foot_map={'Foot.1':0,'Foot.3':.5,'Foot.4':.25,'Foot.2':.75}
for name,duration,speed,duty,phases in [('walk',1.8,.95/(1.8*.75),.75,foot_map),('trot',.8,2/(.8*.6),.6,{'Foot.1':0,'Foot.3':0,'Foot.4':.5,'Foot.2':.5})]:
 a=next(a for a in d['animations'] if a['name']==name);prev={};drift=0;minheight=100;maxlift=-100
 for f in range(round(duration*60)+1):
  t=f/60;ms=world(a,t)
  for i,n in enumerate(nodes):
   if n.get('name') not in phases:continue
   phase=(t/duration+phases[n['name']])%1;p=ms[i].translation.copy();p.z+=speed*t
   if phase<duty:
    if i in prev:drift=max(drift,(p-prev[i]).length)
    prev[i]=p
   else:prev.pop(i,None)
   positions=[v for pr in d['meshes'][n['mesh']]['primitives'] for v in acc(pr['attributes']['POSITION'])]
   lowest=min((ms[i]@Vector(v)).y for v in positions);minheight=min(minheight,lowest);maxlift=max(maxlift,lowest)
 assert drift<.0001,(name,drift)
 report[name]={'exportedGLBWorldPlantAdjacentFrameMaxDrift':drift,'soleHeightMin':minheight,'soleHeightMax':maxlift}
recoil=next(a for a in d['animations'] if a['name']=='recoil');mi=next(i for i,n in enumerate(nodes) if n.get('name')=='muzzle_anchor');m0=world(recoil,0)[mi].translation;m1=world(recoil,.05)[mi].translation;report['muzzleRest']=list(m0);report['recoilAnchorDisplacement']=list(m1-m0)
assert abs((m1-m0).length-.2)<1e-4
for a in d['animations']:
 dur=max(d['accessors'][s['input']]['max'][0] for s in a['samplers']);m0=world(a,0);m1=world(a,dur);error=max(max(abs(v) for row in (m0[i]-m1[i]) for v in row) for i in range(len(nodes)));report.setdefault(a['name'],{})['loopMatrixError']=error
(out/'s52-glb-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

metadata=json.loads((out/'s52-juggernaut-motion.json').read_text());metadata['exportedGLBVerification']=report;metadata['removedSourceProp']='Unparented loose Cylinder shell, visibly hovering above turret; removed only in S52.';(out/'s52-juggernaut-motion.json').write_text(json.dumps(metadata,indent=2))

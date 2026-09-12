import bpy, math, random, pathlib, json, struct
from mathutils import Vector
P=pathlib.Path(__file__).resolve().parent
WT=P.parents[2]
# Reuse previously verified metre-scale modelling/material helpers only.
source=(WT/'probe-assets/s54-build-maintenance-bay.py').read_text().split('# Standing rear frame')[0]
source=source.replace('P=pathlib.Path(__file__).resolve().parent', "P=WT/'probe-assets'")
exec(compile(source,str(WT/'probe-assets/s54-build-maintenance-bay.py'),'exec'))
OUT=pathlib.Path(__file__).resolve().parent
FACTORY=pathlib.Path('/Users/wei/Documents/ChatGPT/遊戲練習/assets/model/polyhaven/modular_factory_facade/modular_factory_facade_1k.gltf')
bpy.ops.import_scene.gltf(filepath=str(FACTORY))
templates={o.name:o for o in bpy.context.scene.objects}
for o in templates.values():o.hide_render=True;o.hide_set(True)
assets=[]
def keep(o):assets.append(o);return o
def block(n,p,s,mat=concrete):return keep(box(n,p,s,mat))
def girder(n,a,b,w=.18,h=.28):return keep(beam(n,a,b,w,h))
def pipe(n,a,b,r=.06):return keep(rod(n,a,b,r))
def part(name,x,y,z,angle=0):
 src=templates[name];o=src.copy();o.data=src.data;bpy.context.collection.objects.link(o);o.hide_render=False;o.hide_set(False);o.location=(x,y,z);o.rotation_mode='XYZ';o.rotation_euler=(0,0,angle);o.scale=(1,1,1)
 if name.startswith('wall_'):
  mod=o.modifiers.new('Physical wall reveal thickness','SOLIDIFY');mod.thickness=.28
 assets.append(o);return o

def roof(name,cx,cy,w,d,eave,rise,broken=False):
 # Gabled enclosed roof slabs, explicit ridge and edge thickness.
 for sign in [-1,1]:
  xmin,xmax=(cx-w/2-.22,cx) if sign<0 else (cx,cx+w/2+.22)
  segs=4 if broken and sign<0 else 1
  for seg in range(segs):
   if broken and sign<0 and seg==0:continue
   ya=cy-d/2-.22+(d+.44)*seg/segs;yb=cy-d/2-.22+(d+.44)*(seg+1)/segs
   def z(x):return eave+rise*(1-abs(x-cx)/(w/2))
   vs=[(xmin,ya,z(xmin)),(xmax,ya,z(xmax)),(xmax,yb,z(xmax)),(xmin,yb,z(xmin))]
   o=keep(mesh(name+' metal roof',vs,[(0,1,2,3)],steel));mod=o.modifiers.new('Roof plate thickness','SOLIDIFY');mod.thickness=.075
   # widely spaced standing seams follow actual slope; visible long roof rhythm
   for j in range(int((yb-ya)/1.25)+1):
    yy=ya+j*1.25
    if yy<=yb:girder('Raised roof seam',(xmin,yy,z(xmin)+.025),(xmax,yy,z(xmax)+.025),.035,.05)
 for yy in [cy-d/2,cy+d/2]:
  keep(mesh(name+' solid brick gable',[(cx-w/2,yy,eave),(cx+w/2,yy,eave),(cx,yy,eave+rise)],[(0,1,2)],concrete));o=assets[-1];mod=o.modifiers.new('Gable thickness','SOLIDIFY');mod.thickness=.28
 for xx in [cx-w/2,cx+w/2]:
  girder('Continuous gutter',(xx,cy-d/2,eave),(xx,cy+d/2,eave),.16,.14)
  for yy in [cy-d/2+.3,cy+d/2-.3]:pipe('Rainwater downpipe',(xx,yy,.3),(xx,yy,eave),.085)

def building(name,cx,gz,w,d,floors=2,broken=False):
 cy=-gz;base=.45;h=3*floors
 block(name+' foundation',(cx,cy,.22),(w+.7,d+.7,.44))
 block(name+' interior ground slab',(cx,cy,.46),(w-.2,d-.2,.13))
 # Closed perimeter using real factory wall+window mesh pairs. No standalone facade cards.
 for level in range(floors):
  zz=base+level*3
  for side in [-1,1]:
   yy=cy+side*d/2
   for i in range(int(w/3)):
    xx=cx-w/2+i*3
    angle=0 if side==-1 else math.pi
    pivot=(xx+3,yy) if side==-1 else (xx,yy)
    part('wall_window_centered_large_01',*pivot,zz,angle)
    part('window_centered_large_01',*pivot,zz,angle)
  for side in [-1,1]:
   xx=cx+side*w/2
   for i in range(int(d/3)):
    yy=cy-d/2+i*3
    angle=math.pi/2 if side==1 else -math.pi/2
    pivot=(xx,yy+3) if side==1 else (xx,yy)
    # A contained damaged upper bay, still roofed and with retained structural support.
    if broken and level==floors-1 and i==0 and side==-1:continue
    part('wall_window_centered_large_01',*pivot,zz,angle)
    part('window_centered_large_01',*pivot,zz,angle)
  block(name+' storey band',(cx,cy,zz+2.94),(w+.12,d+.12,.13))
 for xx in [cx-w/2,cx+w/2]:
  for yy in [cy-d/2,cy+d/2]:
   block('Bonded corner pier',(xx,yy,base+h/2),(.48,.48,h))
 for yy in [cy-d/2+3,cy,cy+d/2-3]:
  girder('Interior roof tie',(cx-w/2,yy,base+h),(cx+w/2,yy,base+h))
  for xx in [cx-w/2,cx+w/2]:girder('Roof knee support',(xx,yy,base+h-.8),(xx+(.8 if xx<cx else -.8),yy,base+h))
 roof(name,cx,cy,w,d,base+h,2.2,broken)
 # Factory roof monitor gives a distinct industrial silhouette.
 mw=w*.3;md=d*.55
 block('Ridge monitor body',(cx,cy,base+h+2.30),(mw,md,.75),steel)
 roof('Monitor',cx,cy,mw,md,base+h+2.65,.45)
 # Road-facing loading apron and steps stay well outside central X ±8 corridor.
 facing=1 if cx<0 else -1;px=cx+facing*(w/2+1.25)
 block('Attached loading platform',(px,cy,.36),(2.5,d+.4,.72))
 for j in range(3):block('Loading stair',(px+facing*(1.35+.32*j),cy-d/2+1,.30-.09*j),(.36,2,.60-.18*j))
 # Raised fascia segments and patched deck are visible thickness, not floating sheets.
 for yy in [cy-d/2+1,cy+d/2-1]:
  for step in range(3):block('Apron edge wear',(px+facing*1.18,yy+step*.55,.72),(.22,.42,.08))
 return (cx,cy,w,d,base+h)

building('West long repair shop',-26,-25,12,36,2,True)
building('East equipment shop',27,-35,12,30,2,False)
building('West rear foundry',-26,-76,18,24,3,False)
building('East rear locomotive shed',28,-82,18,30,2,False)
building('Distant main repair hall',0,-101,30,18,3,False)
# A structural canopy links the loading edge to the repair hall, joining existing piers.
for x,za,zb in [(-18.5,-43,-8),(19.5,-50,-20)]:
 ya,yb=-za,-zb
 for yy in [yb,yb+9,yb+18,ya]:
  girder('Loading canopy I column',(x,yy,0),(x,yy,3.75),.22,.3)
  pipe('Diagonal canopy knee',(x,yy,3),(x+(-1.5 if x<0 else 1.5),yy,4),.06)
 girder('Continuous canopy eave',(x,yb,3.75),(x,ya,3.75))
 for yy in range(int(yb),int(ya),3):
  xend=x+(-2 if x<0 else 2);girder('Canopy rafter',(x,yy,3.75),(xend,yy,4.1))
  keep(mesh('Canopy roof segment',[(x,yy,3.77),(xend,yy,4.12),(xend,yy+2.95,4.12),(x,yy+2.95,3.77)],[(0,1,2,3)],steel));mod=assets[-1].modifiers.new('Roof thickness','SOLIDIFY');mod.thickness=.05
# Continuous retaining boundaries, not a row of isolated objects.
for sign in [-1,1]:
 x=sign*20
 for ga,gb in [(-68,-52),(-7,9)]:
  y1,y2=-gb,-ga
  block('Retaining wall foundation',(x,(y1+y2)/2,.38),(1,y2-y1,.76))
  block('Retaining wall cap',(x,(y1+y2)/2,.82),(1.15,y2-y1,.13))
  for yy in range(int(y1),int(y2)+1,3):pipe('Service railing upright',(x,yy,.85),(x,yy,1.65),.035)
  pipe('Service railing top',(x,y1,1.65),(x,y2,1.65),.035)
# Low, irregular front platforms frame the shot without covering player (-4,0,11).
for sign in [-1,1]:
 x=sign*21;cy=-21
 vs=[(x-4,cy-9,0),(x+4,cy-9,0),(x+4,cy+8,0),(x-4,cy+8,0),(x-4,cy-9,.58),(x+4,cy-9,.58),(x+3.4,cy+7.6,.58),(x+2,cy+6.9,.58),(x+.6,cy+8,.58),(x-4,cy+8,.58)]
 fs=[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,9,8,7,6),(3,0,4,9),(4,5,6,7,8,9)]
 keep(mesh('Broken foreground platform',vs,fs,concrete))
 for i in range(15):
  xx=x+random.uniform(-3.6,3.6);yy=cy+random.uniform(7.3,9.5);size=random.uniform(.1,.4)
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(xx,yy,size*.65));o=bpy.context.object;o.name='Platform edge rubble';o.scale=(size,size*.7,size*.65);keep(finish(o,concrete))
# Grouped rear utilities establish depth and full silhouettes.
for cx,cy in [(-39,81),(40,92)]:
 for dx in [-1.7,1.7]:
  for dy in [-1.7,1.7]:girder('Water tower supporting leg',(cx+dx,cy+dy,0),(cx+dx,cy+dy,10),.24,.32)
 for yy in [cy-1.7,cy+1.7]:pipe('Tower cross brace',(cx-1.7,yy,1),(cx+1.7,yy,9),.075)
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=2.5,depth=4,location=(cx,cy,11.5));keep(finish(bpy.context.object,steel))
 for z in [9.5,13.5]:
  bpy.ops.mesh.primitive_torus_add(major_radius=2.5,minor_radius=.08,major_segments=32,minor_segments=6,location=(cx,cy,z));keep(finish(bpy.context.object,steel))
# Delete only hidden original source-layout objects, export the staged environment.
for o in templates.values():bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in assets:o.select_set(True)
bpy.context.view_layer.update()
bounds=[o.matrix_world@Vector(v) for o in assets for v in o.bound_box]
lo=[min(v[i] for v in bounds) for i in range(3)];hi=[max(v[i] for v in bounds) for i in range(3)]
bpy.ops.export_scene.gltf(filepath=str(OUT/'s56-rail-environment.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
r={'units':'metres','gltf_bounds_min':[lo[0],lo[2],-hi[1]],'gltf_bounds_max':[hi[0],hi[2],-lo[1]],'clear_corridor':'X -8 to +8 empty until rear main hall at Z -92','objects':len(assets),'source':['https://polyhaven.com/a/modular_factory_facade','https://polyhaven.com/a/rough_concrete','https://polyhaven.com/a/rusty_metal'],'license':'All source textures and factory mesh CC0; new geometry original project derivation','art_status':'Environment candidate only; independent Godot fixed-camera review required','contents':'Five enclosed halls with roofs, side/rear walls, foundations; attached aprons/canopies; continuous retaining walls; low foreground platforms; rear water towers'}
(OUT/'s56-rail-environment.json').write_text(json.dumps(r,indent=2))
raise SystemExit(0)
# One quick CPU QA, elevated for roof/wall joining inspection.
block('QA-only ground',(0,40,-.15),(110,170,.25))
bpy.ops.object.camera_add(location=(65,-62,58));cam=bpy.context.object;cam.rotation_euler=(Vector((0,32,2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=38;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='SUN',location=(0,-20,50));bpy.context.object.rotation_euler=(.45,-.5,-.45);bpy.context.object.data.energy=2
s=bpy.context.scene;s.world.color=(.3,.3,.3);s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.device='CPU';s.render.resolution_x=1200;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.filepath=str(OUT/'s56-rail-environment-qa.png');bpy.ops.render.render(write_still=True)

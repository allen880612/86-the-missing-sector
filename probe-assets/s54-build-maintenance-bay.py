import bpy, math, random, json, pathlib
from mathutils import Vector
random.seed(54)
P=pathlib.Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,tex):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;s=n.get('Principled BSDF')
 for suffix,slot in [('diff','Base Color'),('nor_gl','Normal'),('arm','Roughness')]:
  t=n.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(P/'s54-structure-textures'/f'{tex}_{suffix}_1k.jpg'),check_existing=True)
  if suffix!='diff':t.image.colorspace_settings.name='Non-Color'
  if suffix=='nor_gl':
   v=n.new('ShaderNodeNormalMap');v.inputs['Strength'].default_value=.55;l.new(t.outputs['Color'],v.inputs['Color']);l.new(v.outputs['Normal'],s.inputs[slot])
  elif suffix=='arm':
   v=n.new('ShaderNodeSeparateColor');l.new(t.outputs['Color'],v.inputs[0]);l.new(v.outputs['Green'],s.inputs['Roughness']);l.new(v.outputs['Blue'],s.inputs['Metallic'])
  else:l.new(t.outputs['Color'],s.inputs[slot])
 return m
steel=material('CC0 weathered steel','rusty_metal');concrete=material('CC0 exposed concrete','rough_concrete')

def finish(o,mat):
 o.data.materials.append(mat)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 # metre-scaled box projection: independent face islands prevent stretching at breaks.
 uv=o.data.uv_layers.new(name='UVMap')
 o.data.update()
 for poly in o.data.polygons:
  axis=max(range(3),key=lambda a:abs(poly.normal[a]));axes=[a for a in range(3) if a!=axis]
  for li in poly.loop_indices:
   v=o.data.vertices[o.data.loops[li].vertex_index].co
   uv.data[li].uv=(v[axes[0]]/.9,v[axes[1]]/.9)
 o.select_set(False)
 return o

def mesh(name,vs,fs,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 return finish(o,mat)

def box(name,loc,size,mat=steel):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;finish(o,mat);return o

def beam(name,a,b,w=.19,h=.3,t=.024):
 # closed rolled I-section extruded on local Z
 xy=[(-w/2,-h/2),(w/2,-h/2),(w/2,-h/2+t),(t/2,-h/2+t),(t/2,h/2-t),(w/2,h/2-t),(w/2,h/2),(-w/2,h/2),(-w/2,h/2-t),(-t/2,h/2-t),(-t/2,-h/2+t),(-w/2,-h/2+t)]
 length=(Vector(b)-Vector(a)).length;vs=[(x,y,z) for z in [-length/2,length/2] for x,y in xy];fs=[tuple(reversed(range(12))),tuple(range(12,24))]+[(i,(i+1)%12,(i+1)%12+12,i+12) for i in range(12)]
 o=mesh(name,vs,fs,steel);o.location=(Vector(a)+Vector(b))/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(Vector(b)-Vector(a)).to_track_quat('Z','Y');return o

def rod(name,a,b,r=.012):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');return finish(o,steel)

def column(name,x,y,h,w=.7):
 pts=[(-.5,-.38),(-.37,-.5),(.4,-.5),(.5,-.32),(.5,.4),(.3,.5),(-.5,.5),(-.5,.1)]
 vs=[(x+px*w,y+py*w,z) for z in [0] for px,py in pts]+[(x+px*w+random.uniform(-.045,.045),y+py*w+random.uniform(-.045,.045),h+random.uniform(-.22,.16)) for px,py in pts]
 vs.append((x+.06,y-.07,h-.17));fs=[tuple(reversed(range(8)))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]+[(i+8,(i+1)%8+8,16) for i in range(8)]
 mesh(name,vs,fs,concrete)
 for dx,dy in [(-.22,-.21),(.22,-.2),(.22,.2),(-.22,.22)]:
  a=(x+dx,y+dy,h-.25);b=(x+dx+.05,y+dy-.06,h+.46);rod(name+' exposed reinforcement',a,b)
  rod(name+' bent reinforcement',b,(b[0]-.18,b[1]-.13,b[2]+.17))

# Standing rear frame and right front post carry the intact roof; left front lost corner.
for x,y in [(-4.65,2.5),(4.65,2.5),(4.65,-2.5)]:
 box('Concrete footing',(x,y,.14),(.92,.92,.28),concrete)
 beam('Standing I column',(x,y,.28),(x,y,4.12),.27,.38,.035)
 box('Column base plate',(x,y,.3),(.55,.55,.045))
 for dx in [-.2,.2]:
  for dy in [-.2,.2]:rod('Anchor bolt',(x+dx,y+dy,.30),(x+dx,y+dy,.4),.032)
column('Left front shattered pier',-4.65,-2.5,2.55,.95)
column('Secondary broken masonry pier',-4.65,.15,1.4,.82)
# Two transverse Warren roof trusses, front left end visibly collapsed.
for y,low in [(2.5,4.05),(-2.5,3.92)]:
 xs=[-4.65,-3.1,-1.55,0,1.55,3.1,4.65]
 bottom=[(x,y,low-(.33 if y<0 and x< -3 else 0)) for x in xs]
 top=[(x,y,4.1+.95*(1-abs(x)/4.65)) for x in xs]
 for i in range(6):
  beam('Truss bottom chord',bottom[i],bottom[i+1],.16,.24)
  beam('Pitched top chord',top[i],top[i+1],.18,.28)
  beam('Warren diagonal',bottom[i] if i%2==0 else top[i],top[i+1] if i%2==0 else bottom[i+1],.10,.13,.016)
 for i in range(1,6):
  beam('Truss vertical',bottom[i],top[i],.09,.12,.015)
  for z in [bottom[i][2],top[i][2]]:
   plate=box('Gusset joint plate',(xs[i],y-.08,z),(.28,.025,.30))
   for dx in [-.08,.08]:rod('Joint rivet',(xs[i]+dx,y-.11,z),(xs[i]+dx,y-.045,z),.026)
for x in [-4.65,-3.1,-1.55,0,1.55,3.1,4.65]:
 z=4.1+.95*(1-abs(x)/4.65)
 if x> -4:beam('Roof purlin',(x,-2.5,z),(x,2.5,z),.11,.16,.018)
beam('Rear eave tie',(-4.65,2.5,3.78),(4.65,2.5,3.78))
beam('Right longitudinal tie',(4.65,-2.5,4.02),(4.65,2.5,4.02))
rod('Rear plane cross brace',(-4.65,2.5,.7),(0,2.5,3.8),.019)
rod('Rear plane cross brace',(0,2.5,.7),(-4.65,2.5,3.8),.019)

def sheet(name,x0,x1,y0,y1,zbase=0,fallen=False):
 nx=40;ny=10;vs=[]
 for j in range(ny+1):
  for i in range(nx+1):
   x=x0+(x1-x0)*i/nx;y=y0+(y1-y0)*j/ny
   if j==0:y+=random.uniform(-.17,.19)
   z=zbase+.045*math.sin(i/nx*(x1-x0)*math.pi*10)
   if not fallen:z+=4.17+.95*(1-abs(x)/4.65)
   else:z+=.15*(j/ny)**2
   vs.append((x,y,z))
 fs=[]
 for j in range(ny):
  for i in range(nx):
   if j==0 and i in [3,4,14,15,16,30]:continue
   q=j*(nx+1)+i;fs.append((q,q+1,q+nx+2,q+nx+1))
 o=mesh(name,vs,fs,steel);m=o.modifiers.new('Visible sheet gauge','SOLIDIFY');m.thickness=.012;bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)
sheet('Torn rear left roof',-4.65,-.18,.8,2.67)
sheet('Torn right roof',.12,4.65,-.2,2.67)
sheet('Hanging front roof remnant',2.7,4.65,-2.6,-1.7)
sheet('Fallen corrugated strip',-4.9,-3.5,-3.05,-1.5,.12,True)
beam('Collapsed I beam',(-4.9,-2.15,.65),(-2.2,-3.02,.16),.22,.34,.03)
# Debris is directed from the broken left corner outward; the central entrance stays clear.
for i in range(32):
 angle=random.uniform(-2.65,-.3);r=random.uniform(.25,1.45);x=-4.65+math.cos(angle)*r;y=-2.5+math.sin(angle)*r
 size=random.uniform(.09,.31)*(1.1-r*.18)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,size*.62));o=bpy.context.object;o.name='Impact concrete debris';o.scale=(size*1.4,size,size*.8)
 for v in o.data.vertices:v.co*=random.uniform(.77,1.18)
 finish(o,concrete)
assets=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT')
for o in assets:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'s54-maintenance-bay.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
coords=[o.matrix_world@Vector(v) for o in assets for v in o.bound_box];lo=[min(v[i] for v in coords) for i in range(3)];hi=[max(v[i] for v in coords) for i in range(3)]
report={'units':'metres','gltf_bounds_min':[lo[0],lo[2],-hi[1]],'gltf_bounds_max':[hi[0],hi[2],-lo[1]],'front_opening':'positive glTF Z; central X -2 to +4 remains clear below truss','source_textures':['https://polyhaven.com/a/rough_concrete','https://polyhaven.com/a/rusty_metal'],'texture_license':'CC0 https://polyhaven.com/license','geometry':'Original derived structure; procedural construction, requires independent engine art review','objects':len(assets),'blender_version':bpy.app.version_string}
(P/'s54-maintenance-bay.json').write_text(json.dumps(report,indent=2))
# PBR preview is technical QA, not the final engine art approval.
box('QA floor',(0,0,-.10),(18,16,.15),concrete)
bpy.ops.object.camera_add(location=(13,-17,13));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=15.5;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(-3,-4,11));bpy.context.object.data.energy=2200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.context.scene.world.color=(.3,.3,.3);s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.device='CPU';s.render.resolution_x=1100;s.render.resolution_y=850;s.render.resolution_percentage=100;s.render.filepath=str(P/'s54-maintenance-bay-qa.png');bpy.ops.render.render(write_still=True)

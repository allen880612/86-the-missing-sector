import bpy, json, math, pathlib
from mathutils import Vector, Matrix
P=pathlib.Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(P/'s57-destroyed-city-reuse.glb'))
bpy.context.view_layer.update()
original=list(bpy.context.scene.objects)
by_name={o.name:o for o in original}
created=[];records=[]
def baked(name,objects):
 result=[]
 for src in objects:
  if src.type!='MESH':continue
  me=src.data.copy();me.transform(src.matrix_world)
  o=bpy.data.objects.new(name+'_'+src.name,me);bpy.context.collection.objects.link(o);result.append(o)
 return result

def bounds(objects):
 vs=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 return Vector([min(v[i] for v in vs) for i in range(3)]),Vector([max(v[i] for v in vs) for i in range(3)])

def place(name,objects,gx,gz,height=None,max_span=None,yaw=0,pitch=0):
 obs=baked(name,objects);lo,hi=bounds(obs);source_size=list(hi-lo);center=(lo+hi)/2
 # Bake source parent/world transforms first; all following transforms are metre-space.
 rotation=Matrix.Rotation(math.radians(yaw),4,'Z')@Matrix.Rotation(math.radians(pitch),4,'X')
 for o in obs:o.data.transform(rotation@Matrix.Translation(-center))
 lo,hi=bounds(obs);size=hi-lo
 if max_span and size.z>max(size.x,size.y)*.8:
  for o in obs:o.data.transform(Matrix.Rotation(math.radians(85),4,'X'))
  lo,hi=bounds(obs);size=hi-lo
 scale=height/size.z if height else max_span/max(size.x,size.y)
 if max_span:scale=min(scale,1.6/size.z)
 transform=Matrix.Translation(Vector((gx,-gz,0))-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))*scale)@Matrix.Scale(scale,4)
 for o in obs:o.data.transform(transform)
 bpy.context.view_layer.update();lo,hi=bounds(obs)
 record={'name':name,'source_nodes':[o.name for o in objects if o.type=='MESH'],'source_world_size_blender':source_size,'uniform_scale_after_world_bake':scale,'bounds_min_godot':[lo.x,lo.z,-hi.y],'bounds_max_godot':[hi.x,hi.z,-lo.y]}
 records.append(record);created.extend(obs)
 return obs
root=by_name['Colonne_3']
place('Rear_Left_Ruined_Building',[root]+list(root.children_recursive),-28.5,-58.5,height=18,yaw=12)
# Three major concrete fracture pieces lead from the factory edge outward.
for name,gx,gz,span,yaw,pitch in [
 ('Débri_1',-21.0,-3.8,3.6,18,7),
 ('Débri_2',-20.7,.1,3.3,-32,0),
 ('Débri_3',-18.0,1.9,2.5,63,-6),
 ('Rock_1',-22.1,3.5,1.4,30,0),
 ('Rock_2',-19.1,4.8,1.25,-60,0),
 ('Rock_3',-16.1,3.2,.8,15,0),
 ('Rock_1',-17.0,.0,1.0,120,0),
 ('Rock_3',-18.8,-2.4,1.15,82,0),
 ('Rock_2',-21.8,-6.0,1.45,11,0),
 ('Rock_3',-16.7,5.3,.65,-40,0)]:
 place('Collapse_'+name,[by_name[name]],gx,gz,max_span=span,yaw=yaw,pitch=pitch)
# Parent objects from the source display layout are never exported.
for o in original:bpy.data.objects.remove(o,do_unlink=True)
for o in created:o.select_set(True)
bpy.context.view_layer.update()
for r in records:
 lo,hi=r['bounds_min_godot'],r['bounds_max_godot']
 if r['name'].startswith('Collapse_'):
  assert hi[1]<=1.6001
  assert lo[0]>=-23 and hi[0]<=-15 and lo[2]>=-7 and hi[2]<=6,(r['name'],lo,hi)
 else:assert lo[0]>=-34 and hi[0]<=-23 and lo[2]>=-65 and hi[2]<=-52,(lo,hi)
 assert abs(lo[1])<1e-4
bpy.ops.export_scene.gltf(filepath=str(P/'s58-collapse-band.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
lo,hi=bounds(created)
report={'file':'s58-collapse-band.glb','units':'metres; Godot Y-up','source_author':'Fleurman','source_url':'https://opengameart.org/content/destroyed-city-assets','license':'CC0 per author submission; existing intake manifest retained','input_glb':'s57-destroyed-city-reuse.glb','geometry_method':'Original source geometry only. Bake complete source world transforms before recentering, uniform scaling, rotation and ground placement. No new rock geometry.','scale_assumption':'Author units are unknown. Requested rear building silhouette fitted uniformly to 18 m. A nominal 3 m storey is a scene design assumption, not a measured author unit or guaranteed floor pitch of this collapsed building.','material_method':'Existing six base-color textures/materials preserved. Source contains no normal or roughness textures; no fabricated PBR claims.','bounds_min_godot':[lo.x,lo.z,-hi.y],'bounds_max_godot':[hi.x,hi.z,-lo.y],'placements':records,'route':'Collapse bounds stay inside X[-23,-15], Z[-7,6]; central X[-8,8] unobstructed. Front-left enemy lane can meet the collapse edge at X[-17,-15]; no navigation/collision mesh authored. Player (-4,0,11) and boss (5,0,-33) remain outside all bounds.','visual_status':'No new render. Final placement/art review is root Godot integration.'}
(P/'s58-collapse-band.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'objects':len(created),'bounds_min_godot':report['bounds_min_godot'],'bounds_max_godot':report['bounds_max_godot']},ensure_ascii=False))

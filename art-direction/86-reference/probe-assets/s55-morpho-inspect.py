import bpy,json
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='/Users/wei/Documents/ChatGPT/遊戲練習/assets/model/project86-source/morpho walk forward anim.fbx',use_anim=True)
report={'version':bpy.app.version_string,'objects':[],'actions':[],'materials':[],'images':[]}
lo=Vector((1e20,)*3);hi=-lo
for o in bpy.context.scene.objects:
 item={'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'dimensions':list(o.dimensions),'scale':list(o.scale)}
 if o.type=='MESH':
  o.data.calc_loop_triangles();item.update(triangles=len(o.data.loop_triangles),vertices=len(o.data.vertices),materials=[m.name if m else None for m in o.data.materials],uvLayers=list(o.data.uv_layers.keys()),vertexGroups=len(o.vertex_groups))
  for b in o.bound_box:
   p=o.matrix_world@Vector(b)
   for j in range(3):lo[j]=min(lo[j],p[j]);hi[j]=max(hi[j],p[j])
 if o.type=='ARMATURE':item['bones']=[b.name for b in o.data.bones]
 report['objects'].append(item)
for a in bpy.data.actions:report['actions'].append({'name':a.name,'range':list(a.frame_range)})
for m in bpy.data.materials:report['materials'].append({'name':m.name,'color':list(m.diffuse_color),'metallic':m.metallic,'roughness':m.roughness})
for i in bpy.data.images:report['images'].append({'name':i.name,'path':i.filepath,'size':list(i.size)})
report['bounds']={'min':list(lo),'max':list(hi),'size':list(hi-lo)}
report['triangles']=sum(x.get('triangles',0) for x in report['objects'])
out=Path('/Users/wei/Documents/ChatGPT/遊戲練習/.worktrees/s45-3d-sortie/art-direction/86-reference/probe-assets')
(out/'s55-morpho-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'s55-morpho-inspected.blend'))
print('S55_SUMMARY',json.dumps({k:report[k] for k in ['bounds','triangles','actions','materials','images']},ensure_ascii=False))

import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path('/Users/wei/Documents/ChatGPT/遊戲練習')
out=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(root/'assets/model/oga-destroyed-city/source/Destroyed_City_Assets.fbx'))
report={'source':'https://opengameart.org/content/destroyed-city-assets','author':'Fleurman','license':'CC0','original_modified':False,'objects':[],'materials':[],'images':[]}
lo=Vector((1e10,)*3);hi=-lo
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 o.data.calc_loop_triangles()
 report['objects'].append(dict(name=o.name,triangles=len(o.data.loop_triangles),vertices=len(o.data.vertices),dimensions=list(o.dimensions),uv_layers=list(o.data.uv_layers.keys()),materials=[m.name if m else None for m in o.data.materials]))
 for b in o.bound_box:
  v=o.matrix_world@Vector(b)
  for j in range(3):lo[j]=min(lo[j],v[j]);hi[j]=max(hi[j],v[j])
for m in bpy.data.materials:
 textures=[n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image] if m.use_nodes else []
 report['materials'].append(dict(name=m.name,color=list(m.diffuse_color),metallic=m.metallic,roughness=m.roughness,textures=textures))
for i in bpy.data.images:report['images'].append(dict(name=i.name,size=list(i.size),path=i.filepath,packed=bool(i.packed_file)))
report['triangles']=sum(x['triangles'] for x in report['objects']);report['bounds']={'min':list(lo),'max':list(hi),'size':list(hi-lo)}
report['material_repair']=[]
for m in bpy.data.materials:
 matches=[i for i in bpy.data.images if Path(i.name).stem.casefold()==m.name.casefold()]
 if len(matches)==1:
  m.use_nodes=True
  shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
  tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=matches[0]
  m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
  report['material_repair'].append({'material':m.name,'image':matches[0].name,'basis':'Unique case-insensitive material/image filename match; original embedded images preserved, base-color connection reconstructed'})
report['import_warning']='Blender reported excess FBX layer data; UV/topology need visual inspection, import success is not proof of fidelity.'
(out/'s57-destroyed-city-inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
bpy.ops.export_scene.gltf(filepath=str(out/'s57-destroyed-city-reuse.glb'),export_format='GLB')
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE_NEXT'
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Intake neutral world');scene.world.color=(.15,.15,.15)
scene.view_settings.view_transform='AgX'
center=(lo+hi)/2;span=max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z)
bpy.ops.object.camera_add(location=center+Vector((.75,-1,.85))*span)
cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span*1.22;cam.data.clip_end=span*10;scene.camera=cam
bpy.ops.object.light_add(type='SUN',location=center+Vector((0,0,span)));sun=bpy.context.object;sun.rotation_euler=(.45,-.6,-.4);sun.data.energy=2
scene.render.filepath=str(out/'s57-destroyed-city-intake.png');bpy.ops.render.render(write_still=True)
print('S57 INTAKE',json.dumps({k:report[k] for k in ['triangles','bounds','images']}))

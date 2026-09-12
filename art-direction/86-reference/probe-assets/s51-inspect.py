import bpy,json
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath='/private/tmp/s51-project86-ameise/Ameise asurada model.fbx',use_anim=True,bake_space_transform=False)
report={'version':bpy.app.version_string,'objects':[], 'actions':[], 'materials':[], 'images':[]}
for o in bpy.context.scene.objects:
    item={'name':o.name,'type':o.type,'parent':o.parent.name if o.parent else None,'dimensions':list(o.dimensions),'scale':list(o.scale),'rotation':list(o.rotation_euler)}
    if o.type=='MESH':
        o.data.calc_loop_triangles()
        item.update(vertices=len(o.data.vertices),triangles=len(o.data.loop_triangles),uvLayers=list(o.data.uv_layers.keys()),vertexGroups=len(o.vertex_groups),materials=[m.name for m in o.data.materials if m])
    if o.type=='ARMATURE':item['bones']=[{'name':b.name,'parent':b.parent.name if b.parent else None,'head':list(b.head_local),'tail':list(b.tail_local)} for b in o.data.bones]
    report['objects'].append(item)
for a in bpy.data.actions:report['actions'].append({'name':a.name,'frames':list(a.frame_range)})
for m in bpy.data.materials:report['materials'].append({'name':m.name,'nodes':[(n.name,n.type) for n in m.node_tree.nodes] if m.use_nodes else []})
for i in bpy.data.images:report['images'].append({'name':i.name,'path':i.filepath,'size':list(i.size)})
Path('/private/tmp/s51-project86-ameise/inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))

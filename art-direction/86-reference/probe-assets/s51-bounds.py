import bpy,json
from mathutils import Vector
from pathlib import Path
for stage in ['original','saved','glb']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if stage=='original':bpy.ops.import_scene.fbx(filepath='/private/tmp/s51-project86-ameise/Ameise asurada model.fbx')
    elif stage=='saved':bpy.ops.wm.open_mainfile(filepath='/private/tmp/s51-project86-ameise/ameise-inspected.blend')
    else:bpy.ops.import_scene.gltf(filepath='/Users/wei/Documents/ChatGPT/遊戲練習/art-direction/86-reference/probe-assets/ameise-reuse-probe.glb')
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    points=[]
    for o in bpy.context.scene.objects:
        if o.type=='MESH':
            ev=o.evaluated_get(deps);me=ev.to_mesh();points.extend(o.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
    print(stage,'root',[(o.name,list(o.location),list(o.scale)) for o in bpy.context.scene.objects if not o.parent],'bounds',[[min(p[i] for p in points),max(p[i] for p in points)] for i in range(3)],flush=True)
